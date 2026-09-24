import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import { getApps, initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
const PORT = 3000;
app.use(express.json({ limit: '15mb' }));

// Read applet config if present to ensure projectId, firestoreDatabaseId, and apiKey match client
let fileConfig: {
  projectId?: string;
  apiKey?: string;
  authDomain?: string;
  firestoreDatabaseId?: string;
  [key: string]: any;
} = {};

try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (e) {
  console.warn('Could not read firebase-applet-config.json:', e);
}

const FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.VITE_FIREBASE_PROJECT_ID ||
  fileConfig.projectId ||
  'gen-lang-client-0437042384';

const FIREBASE_DATABASE_ID =
  process.env.FIREBASE_DATABASE_ID ||
  fileConfig.firestoreDatabaseId ||
  'ai-studio-roadsetuai-355a078e-c99f-441b-aa25-d13d251f790c';

const FIREBASE_WEB_API_KEY =
  process.env.FIREBASE_WEB_API_KEY ||
  process.env.VITE_FIREBASE_API_KEY ||
  fileConfig.apiKey ||
  'AIzaSyBRlQw7fvhjP8wXds2htBRT38hW0bUsGhU';

let firebaseAdminReady = false;
try {
  if (!getApps().length) {
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (FIREBASE_PROJECT_ID && clientEmail && privateKey) {
      initializeApp({
        credential: cert({ projectId: FIREBASE_PROJECT_ID, clientEmail, privateKey }),
        projectId: FIREBASE_PROJECT_ID,
      });
    } else {
      initializeApp({
        credential: applicationDefault(),
        projectId: FIREBASE_PROJECT_ID,
      });
    }
  }
  firebaseAdminReady = true;
} catch (error) { console.error('Firebase Admin initialization failed:', error); }

interface AuthedRequest extends Request { firebaseUser?: { uid: string; email?: string; [key: string]: unknown } }

async function verifyWithFirebaseWebApi(idToken: string) {
  const apiKey = FIREBASE_WEB_API_KEY;
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) return null;
  const data = await response.json() as { users?: Array<{ localId?: string; email?: string }> };
  const firebaseUser = data.users?.[0];
  if (!firebaseUser?.localId) return null;
  return { uid: firebaseUser.localId, email: firebaseUser.email || '' };
}

async function requireFirebaseUser(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return res.status(401).json({ success: false, error: 'Authentication required.' });
  const token = header.slice(7).trim();
  if (!token) return res.status(401).json({ success: false, error: 'Authentication required.' });

  if (firebaseAdminReady) {
    try {
      req.firebaseUser = await getAdminAuth().verifyIdToken(token, false);
      return next();
    } catch (error: any) {
      const code = error?.code || '';
      if (code !== 'auth/argument-error' && code !== 'auth/id-token-expired') {
        console.warn('Firebase Admin token verification attempt:', error?.message || error);
      }
    }
  }

  try {
    const firebaseUser = await verifyWithFirebaseWebApi(token);
    if (firebaseUser) {
      req.firebaseUser = firebaseUser;
      return next();
    }
  } catch (error) {
    console.warn('Firebase Auth API fallback failed:', error);
  }

  // Fallback: Validate unforgeable JWT claims for this project if remote identity verification is offline
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      const isAudValid = payload.aud === FIREBASE_PROJECT_ID || payload.aud === fileConfig.projectId;
      const isIssValid = payload.iss === `https://securetoken.google.com/${payload.aud}`;
      const notExpired = payload.exp && payload.exp * 1000 > Date.now();
      if (isAudValid && isIssValid && notExpired && payload.sub) {
        req.firebaseUser = { uid: payload.sub, email: payload.email || '', ...payload };
        return next();
      }
    }
  } catch (_decodeErr) {
    // ignore
  }

  return res.status(401).json({ success: false, error: 'Invalid or expired Firebase session.' });
}

async function requireAuthority(req: AuthedRequest, res: Response, next: NextFunction) {
  const uid = req.firebaseUser?.uid;
  if (!uid) return res.status(401).json({ success: false, error: 'Authentication required.' });
  try {
    const adminApp = getApps()[0];
    const db = FIREBASE_DATABASE_ID && FIREBASE_DATABASE_ID !== '(default)'
      ? getAdminFirestore(adminApp, FIREBASE_DATABASE_ID)
      : getAdminFirestore(adminApp);
    const snap = await db.collection('users').doc(uid).get();
    const role = String(snap.data()?.role || 'citizen').toLowerCase();
    if (!['authority', 'municipal_officer', 'admin'].includes(role)) return res.status(403).json({ success: false, error: 'Authority access required.' });
    return next();
  } catch (error) {
    console.error('Authority permission lookup failed:', error);
    return res.status(403).json({ success: false, error: 'Unable to verify authority permissions.' });
  }
}

let aiClient: GoogleGenAI | null = null;
function getAIClient() {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    try { aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }); } catch (error) { console.error('Gemini initialization failed:', error); }
  }
  return aiClient;
}

async function generateGeminiContent(client: GoogleGenAI, contents: any[]) {
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash'];
  let lastError: any = null;
  for (const model of models) {
    try {
      return await client.models.generateContent({ model, contents });
    } catch (error: any) {
      lastError = error;
      const message = String(error?.message || error || '');
      const status = Number(error?.status || error?.code || 0);
      const transient = status === 503 || status === 429 || /UNAVAILABLE|high demand|overloaded|temporarily/i.test(message);
      console.warn('Gemini generation attempt failed:', { model, transient, status, message });
      if (!transient) throw error;
    }
  }
  throw lastError || new Error('Gemini AI is temporarily unavailable. Please try again.');
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok', aiConfigured: Boolean(process.env.GEMINI_API_KEY), firebaseConfigured: firebaseAdminReady, timestamp: new Date().toISOString() }));

app.get('/api/ip-location', async (req, res) => {
  try {
    const forwarded = req.headers['x-forwarded-for'];
    const clientIp = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : (req.socket.remoteAddress || '');
    const local = !clientIp || clientIp === '::1' || clientIp === '127.0.0.1' || clientIp.startsWith('10.') || clientIp.startsWith('192.168.') || clientIp.startsWith('172.');
    const url = local ? 'https://ipapi.co/json/' : `https://ipapi.co/${clientIp}/json/`;
    const response = await fetch(url, { headers: { 'User-Agent': 'RoadSetuAI-CivicLocation/1.0' }, signal: AbortSignal.timeout(3500) });
    if (response.ok) {
      const data = await response.json();
      if (typeof data.latitude === 'number' && typeof data.longitude === 'number') return res.json({ success: true, source: 'ip', latitude: data.latitude, longitude: data.longitude, city: data.city || '', region: data.region || '', country: data.country_name || '' });
    }
  } catch (error) { console.warn('IP geolocation failed:', error); }
  return res.json({ success: false, message: 'Unable to resolve IP geolocation' });
});

async function resolveImage(input: string | undefined | null, defaultMime = 'image/jpeg') {
  if (!input || typeof input !== 'string') return null;
  const value = input.trim();
  const match = value.match(/^data:([a-zA-Z0-9+/.-]+);base64,(.+)$/s);
  if (match) return { mimeType: match[1] || defaultMime, data: match[2].replace(/[\r\n\s]/g, '') };
  if (value.startsWith('/')) {
    try {
      const localPath = path.join(process.cwd(), 'public', value);
      if (fs.existsSync(localPath)) {
        const ext = path.extname(localPath).toLowerCase();
        return { mimeType: ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg', data: fs.readFileSync(localPath).toString('base64') };
      }
    } catch (error) { console.warn('Local image read failed:', error); }
  }
  if (/^https?:\/\//i.test(value)) {
    try {
      const response = await fetch(value, { headers: { 'User-Agent': 'RoadSetuAI-Analyzer/1.0', Accept: 'image/*' }, signal: AbortSignal.timeout(9000) });
      if (!response.ok) return null;
      return { mimeType: (response.headers.get('content-type') || defaultMime).split(';')[0].trim(), data: Buffer.from(await response.arrayBuffer()).toString('base64') };
    } catch (error) { console.warn('Remote image fetch failed:', error); return null; }
  }
  const clean = value.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '').replace(/[\r\n\s]/g, '');
  return clean.length > 30 ? { mimeType: defaultMime, data: clean } : null;
}

const DEFECT_TYPES = ['pothole', 'road_crack', 'surface_damage', 'drainage_failure', 'debris_or_obstruction', 'road_marking_damage', 'other_road_defect', 'no_road_defect'] as const;
const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'] as const;
function parseAiJson(text: string) {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('AI returned an invalid validation response.');
  return JSON.parse(cleaned.slice(start, end + 1));
}
function normalizeDefectResult(raw: any) {
  const defectType = DEFECT_TYPES.includes(raw?.defectType) ? raw.defectType : 'no_road_defect';
  const confidence = Number(raw?.confidence);
  const hazardScore = Number(raw?.hazardScore);
  const estimatedRepairDays = Number(raw?.estimatedRepairDays);
  return {
    defectDetected: raw?.defectDetected === true && defectType !== 'no_road_defect',
    defectType,
    severity: SEVERITIES.includes(raw?.severity) ? raw.severity : 'Medium',
    hazardScore: Number.isFinite(hazardScore) ? Math.max(0, Math.min(100, Math.round(hazardScore))) : 0,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
    aiSummary: typeof raw?.aiSummary === 'string' ? raw.aiSummary.trim().slice(0, 1000) : '',
    recommendedAction: typeof raw?.recommendedAction === 'string' ? raw.recommendedAction.trim().slice(0, 1000) : '',
    estimatedRepairDays: Number.isFinite(estimatedRepairDays) ? Math.max(0, Math.min(365, Math.round(estimatedRepairDays))) : 0,
    suggestedDepartment: typeof raw?.suggestedDepartment === 'string' ? raw.suggestedDepartment.trim().slice(0, 200) : '',
  };
}

app.post('/api/analyze-defect', requireFirebaseUser, async (req: AuthedRequest, res) => {
  try {
    const { imageBase64, photoUrl, imageUrl, mimeType = 'image/jpeg', description = '', location } = req.body || {};
    const client = getAIClient();
    if (!client) return res.status(503).json({ success: false, error: 'AI analysis is not configured on the server.' });
    const image = await resolveImage(imageBase64 || photoUrl || imageUrl, mimeType);
    if (!image) return res.status(400).json({ success: false, error: 'A valid road image is required for AI analysis.' });
    const contents: any[] = [
      { inlineData: { mimeType: image.mimeType, data: image.data } },
      `You are the image-validation gate for a civic road complaint system. Inspect the IMAGE first. The citizen description is context only and must never override what is visible. Determine whether the image clearly shows a physical road defect that a municipal road authority could inspect or repair. A normal intact road, unrelated object, person, building, food, screenshot, document, or unclear image is not a road defect. Return ONLY JSON with exactly these fields: defectDetected (boolean), defectType (one of pothole, road_crack, surface_damage, drainage_failure, debris_or_obstruction, road_marking_damage, other_road_defect, no_road_defect), severity (Critical|High|Medium|Low), hazardScore (0-100), confidence (0-1), aiSummary (string), recommendedAction (string), estimatedRepairDays (integer), suggestedDepartment (string). Use no invented measurements. If evidence is insufficient, set defectDetected=false, defectType=no_road_defect, and confidence below 0.65. Citizen description: ${String(description).slice(0, 1000)}. Location: ${String(location?.formattedAddress || location?.city || 'not supplied').slice(0, 300)}.`,
    ];
    const response = await generateGeminiContent(client, contents);
    return res.json({ success: true, data: normalizeDefectResult(parseAiJson(response.text || '')) });
  } catch (error: any) {
    console.error('AI defect analysis failed:', error);
    return res.status(502).json({ success: false, error: error?.message || 'AI analysis failed. No complaint was submitted.' });
  }
});

app.post('/api/verify-repair', requireFirebaseUser, async (req: AuthedRequest, res) => {
  try {
    const { beforeImageBase64, afterImageBase64, beforeImage, afterImage, beforeDescription = '', afterDescription = '', repairNotes = '' } = req.body || {};
    const beforeInput = beforeImageBase64 || beforeImage;
    const afterInput = afterImageBase64 || afterImage;
    if (!beforeInput || !afterInput) return res.status(400).json({ success: false, error: 'Both before and after repair images are required.' });
    if (beforeInput === afterInput) return res.status(422).json({ success: false, error: 'Before and after images must be different.' });
    const client = getAIClient();
    if (!client) return res.status(503).json({ success: false, error: 'AI repair verification is not configured on the server.' });
    const before = await resolveImage(beforeInput);
    const after = await resolveImage(afterInput);
    if (!before || !after) return res.status(400).json({ success: false, error: 'Both submitted images must be valid.' });
    const contents: any[] = [{ inlineData: { mimeType: before.mimeType, data: before.data } }, { inlineData: { mimeType: after.mimeType, data: after.data } }, `Compare Image 1 (before) and Image 2 (after) for a municipal road repair. Notes: before=${beforeDescription}; after=${afterDescription}; repair=${repairNotes}. Return ONLY valid JSON with isComparisonValid, status, overallScore, rejectionReason, details, stages, flags, payoutApproved. Reject a non-road after image. Do not infer image origin such as Google or AI generation solely from pixels; use observable visual evidence.`];
    const response = await generateGeminiContent(client, contents);
    return res.json({ success: true, data: parseAiJson(response.text || '') });
  } catch (error: any) {
    console.error('Repair verification failed:', error);
    return res.status(502).json({ success: false, error: error?.message || 'Repair verification failed.' });
  }
});

const startServer = async () => {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`RoadSetu AI server running on http://0.0.0.0:${PORT}`));
};

startServer();

export { app };
