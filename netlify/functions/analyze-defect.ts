import { GoogleGenAI } from '@google/genai';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

if (!getApps().length && PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  initializeApp({
    credential: cert({
      projectId: PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const json = (statusCode: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

function isTransient(error: any) {
  const message = String(error?.message || error || '').toLowerCase();
  const status = Number(error?.status || error?.code || 0);
  return [408, 429, 500, 502, 503, 504].includes(status) ||
    /unavailable|high demand|overloaded|resource exhausted|temporarily|rate limit|timeout/i.test(message);
}

function errorMessage(error: any) {
  const message = String(error?.message || error || 'AI request failed.');
  if (/api key|authentication|unauthorized|permission denied|forbidden/i.test(message)) {
    return 'Gemini API authentication failed. Check GEMINI_API_KEY in Netlify environment variables.';
  }
  if (/quota|resource exhausted|rate limit/i.test(message)) {
    return 'Gemini API quota is exhausted. Use an API key with available quota or retry after the limit resets.';
  }
  if (/high demand|unavailable|overloaded|temporarily/i.test(message)) {
    return 'Gemini is temporarily overloaded. The production endpoint tried multiple stable Flash models; please retry once.';
  }
  return message.slice(0, 500);
}

async function resolveImage(input: unknown) {
  if (typeof input !== 'string' || !input.trim()) return null;
  const value = input.trim();
  const match = value.match(/^data:([a-zA-Z0-9+./-]+);base64,(.+)$/s);
  if (match) return { mimeType: match[1], data: match[2].replace(/[\r\n\s]/g, '') };
  if (/^https?:\/\//i.test(value)) {
    const response = await fetch(value, { headers: { accept: 'image/*' }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    return {
      mimeType: (response.headers.get('content-type') || 'image/jpeg').split(';')[0],
      data: Buffer.from(await response.arrayBuffer()).toString('base64'),
    };
  }
  const clean = value.replace(/^data:image\/[a-zA-Z0-9+./-]+;base64,/, '').replace(/[\r\n\s]/g, '');
  return clean.length > 30 ? { mimeType: 'image/jpeg', data: clean } : null;
}

function parseJson(text: string) {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Gemini returned an invalid analysis response.');
  return JSON.parse(cleaned.slice(start, end + 1));
}

const models = ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.8-flash'];

async function generate(client: GoogleGenAI, contents: any[]) {
  let lastError: any = null;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await client.models.generateContent({
          model,
          contents,
          config: {
            responseMimeType: 'application/json',
            maxOutputTokens: 500,
          },
        });
        return response;
      } catch (error: any) {
        lastError = error;
        console.warn('RoadSetu production Gemini attempt failed', { model, attempt: attempt + 1, status: error?.status, code: error?.code, message: error?.message });
        if (!isTransient(error) || attempt === 1) break;
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }
  }
  throw lastError || new Error('Gemini AI is unavailable.');
}

export default async function handler(request: Request) {
  if (request.method !== 'POST') return json(405, { success: false, error: 'Method not allowed.' });
  if (!GEMINI_API_KEY) return json(503, { success: false, error: 'Gemini API is not configured on the deployed server.' });

  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return json(401, { success: false, error: 'Authentication required.' });

  try {
    if (!getApps().length) return json(500, { success: false, error: 'Firebase Admin is not configured on the deployed server.' });
    await getAuth().verifyIdToken(authHeader.slice(7).trim());
  } catch (error: any) {
    console.error('RoadSetu auth verification failed', error?.message || error);
    return json(401, { success: false, error: 'Invalid or expired Firebase session.' });
  }

  try {
    const body = await request.json();
    const image = await resolveImage(body?.imageBase64 || body?.photoUrl || body?.imageUrl);
    if (!image) return json(400, { success: false, error: 'A valid road image is required for AI analysis.' });

    const client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const prompt = `You are the image-validation gate for a civic road complaint system. Inspect the IMAGE first. The citizen description is context only and must never override what is visible. Determine whether the image clearly shows a physical road defect that a municipal road authority could inspect or repair. A normal intact road, unrelated object, person, building, food, screenshot, document, or unclear image is not a road defect. Return ONLY JSON with exactly these fields: defectDetected (boolean), defectType (one of pothole, road_crack, surface_damage, drainage_failure, debris_or_obstruction, road_marking_damage, other_road_defect, no_road_defect), severity (Critical|High|Medium|Low), hazardScore (0-100), confidence (0-1), aiSummary (string), recommendedAction (string), estimatedRepairDays (integer), suggestedDepartment (string). Use no invented measurements. If evidence is insufficient, set defectDetected=false, defectType=no_road_defect, and confidence below 0.65. Citizen description: ${String(body?.description || '').slice(0, 1000)}. Location: ${String(body?.location?.formattedAddress || body?.location?.city || 'not supplied').slice(0, 300)}.`;

    const response = await generate(client, [
      { inlineData: { mimeType: image.mimeType, data: image.data } },
      prompt,
    ]);

    const raw = parseJson(response.text || '');
    const confidence = Number(raw.confidence);
    const hazardScore = Number(raw.hazardScore);
    const allowedDefects = ['pothole', 'road_crack', 'surface_damage', 'drainage_failure', 'debris_or_obstruction', 'road_marking_damage', 'other_road_defect', 'no_road_defect'];
    const allowedSeverity = ['Critical', 'High', 'Medium', 'Low'];
    const defectType = allowedDefects.includes(raw.defectType) ? raw.defectType : 'no_road_defect';

    return json(200, {
      success: true,
      data: {
        defectDetected: raw.defectDetected === true && defectType !== 'no_road_defect',
        defectType,
        severity: allowedSeverity.includes(raw.severity) ? raw.severity : 'Medium',
        hazardScore: Number.isFinite(hazardScore) ? Math.max(0, Math.min(100, Math.round(hazardScore))) : 0,
        confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
        aiSummary: typeof raw.aiSummary === 'string' ? raw.aiSummary.slice(0, 1000) : '',
        recommendedAction: typeof raw.recommendedAction === 'string' ? raw.recommendedAction.slice(0, 1000) : '',
        estimatedRepairDays: Number.isFinite(Number(raw.estimatedRepairDays)) ? Math.max(0, Math.min(365, Math.round(Number(raw.estimatedRepairDays)))) : 2,
        suggestedDepartment: typeof raw.suggestedDepartment === 'string' ? raw.suggestedDepartment.slice(0, 200) : '',
      },
    });
  } catch (error: any) {
    console.error('RoadSetu production defect analysis failed', { status: error?.status, code: error?.code, message: error?.message });
    return json(isTransient(error) ? 503 : 502, { success: false, error: errorMessage(error), code: error?.code || error?.status || 'AI_ANALYSIS_FAILED' });
  }
}
