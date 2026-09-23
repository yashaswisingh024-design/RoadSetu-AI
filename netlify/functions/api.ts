import express, { Request, Response, NextFunction } from 'express';
import serverless from 'serverless-http';
import { GoogleGenAI } from '@google/genai';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';

const app = express();

app.use(express.json({ limit: '15mb' }));

/* =========================================================
   FIREBASE ADMIN
========================================================= */

let firebaseAdminReady = false;

try {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      'Firebase Admin initialization failed: required environment variables are missing.'
    );
  } else {
    if (!getApps().length) {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }

    firebaseAdminReady = true;
  }
} catch (error: any) {
  console.error('Firebase Admin initialization failed:', {
    code: error?.code,
    message: error?.message,
  });
}

/* =========================================================
   AUTHENTICATION
========================================================= */

interface AuthedRequest extends Request {
  firebaseUser?: {
    uid: string;
    email?: string;
    [key: string]: unknown;
  };
}

async function requireFirebaseUser(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  if (!firebaseAdminReady) {
    console.error(
      'Firebase authentication unavailable: FIREBASE_ADMIN_CONFIG_MISSING'
    );

    return res.status(500).json({
      success: false,
      error: 'Firebase authentication is not configured on the server.',
    });
  }

  const header = req.headers.authorization || '';

  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required.',
    });
  }

  const token = header.slice(7).trim();

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required.',
    });
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);

    req.firebaseUser = decoded;

    return next();
  } catch (error: any) {
    console.error('Firebase Admin verifyIdToken failed:', {
      code: error?.code || 'UNKNOWN_FIREBASE_AUTH_ERROR',
      message: error?.message || String(error),
    });

    return res.status(401).json({
      success: false,
      error: 'Invalid or expired Firebase session.',
      code: error?.code || 'UNKNOWN_FIREBASE_AUTH_ERROR',
    });
  }
}

/* =========================================================
   GEMINI
========================================================= */

let aiClient: GoogleGenAI | null = null;

function getAIClient() {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    try {
      aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
      });
    } catch (error) {
      console.error('Gemini initialization failed:', error);
    }
  }

  return aiClient;
}

/*
 * Use models that are broadly available through the Gemini API.
 *
 * IMPORTANT:
 * Do not use made-up/future model names here.
 */
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

function isTransientGeminiError(error: any) {
  const message = String(error?.message || error || '').toLowerCase();

  const status = Number(
    error?.status ||
      error?.code ||
      error?.response?.status ||
      0
  );

  return (
    status === 408 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    message.includes('unavailable') ||
    message.includes('high demand') ||
    message.includes('resource exhausted') ||
    message.includes('temporarily') ||
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('deadline')
  );
}

function friendlyGeminiError(error: any) {
  const message = String(error?.message || error || '');

  if (/quota|rate limit|resource exhausted/i.test(message)) {
    return 'AI quota is temporarily exhausted.';
  }

  if (/high demand|unavailable|temporarily/i.test(message)) {
    return 'AI service is temporarily busy.';
  }

  if (/timeout|timed out|deadline/i.test(message)) {
    return 'AI analysis timed out.';
  }

  return 'AI analysis is temporarily unavailable.';
}

/* =========================================================
   GEMINI GENERATION
========================================================= */

async function generateGeminiContent(
  client: GoogleGenAI,
  contents: any[]
) {
  let lastError: any = null;

  for (const model of GEMINI_MODELS) {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 15000);

    try {
      console.log(`Attempting Gemini model: ${model}`);

      const response = await client.models.generateContent({
        model,
        contents,
        config: {
          responseMimeType: 'application/json',
          maxOutputTokens: 700,
        },
      });

      console.log(`Gemini model succeeded: ${model}`);

      return response;
    } catch (error: any) {
      lastError = error;

      console.warn(`Gemini model ${model} failed:`, {
        code: error?.code,
        status: error?.status,
        message: error?.message,
      });

      /*
       * If the error is not transient, don't waste time
       * trying every model.
       */
      if (!isTransientGeminiError(error)) {
        throw error;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  const error = new Error(
    friendlyGeminiError(lastError)
  );

  (error as any).code = 'AI_TEMPORARILY_UNAVAILABLE';
  (error as any).status = 503;

  throw error;
}

/* =========================================================
   HEALTH CHECK
========================================================= */

const health = (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    aiConfigured: Boolean(process.env.GEMINI_API_KEY),
    firebaseConfigured: firebaseAdminReady,
    timestamp: new Date().toISOString(),
  });
};

app.get('/api/health', health);
app.get('/health', health);

/* =========================================================
   IP LOCATION
========================================================= */

app.get('/api/ip-location', async (req, res) => {
  try {
    const forwarded = req.headers['x-forwarded-for'];

    const clientIp =
      typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : req.socket.remoteAddress || '';

    const local =
      !clientIp ||
      clientIp === '::1' ||
      clientIp === '127.0.0.1' ||
      clientIp.startsWith('10.') ||
      clientIp.startsWith('192.168.') ||
      clientIp.startsWith('172.');

    const url = local
      ? 'https://ipapi.co/json/'
      : `https://ipapi.co/${clientIp}/json/`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'RoadSetuAI-CivicLocation/1.0',
      },
      signal: AbortSignal.timeout(3500),
    });

    if (response.ok) {
      const data = await response.json();

      if (
        typeof data.latitude === 'number' &&
        typeof data.longitude === 'number'
      ) {
        return res.json({
          success: true,
          source: 'ip',
          latitude: data.latitude,
          longitude: data.longitude,
          city: data.city || '',
          region: data.region || '',
          country: data.country_name || '',
        });
      }
    }
  } catch (error) {
    console.warn('IP geolocation failed:', error);
  }

  return res.json({
    success: false,
    message: 'Unable to resolve IP geolocation',
  });
});

/* =========================================================
   IMAGE RESOLUTION
========================================================= */

async function resolveImage(
  input: string | undefined | null,
  defaultMime = 'image/jpeg'
) {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const value = input.trim();

  const match = value.match(
    /^data:([a-zA-Z0-9+/.-]+);base64,(.+)$/s
  );

  if (match) {
    return {
      mimeType: match[1] || defaultMime,
      data: match[2].replace(/[\r\n\s]/g, ''),
    };
  }

  if (/^https?:\/\//i.test(value)) {
    try {
      const response = await fetch(value, {
        headers: {
          'User-Agent': 'RoadSetuAI-Analyzer/1.0',
          Accept: 'image/*',
        },
        signal: AbortSignal.timeout(9000),
      });

      if (!response.ok) {
        return null;
      }

      return {
        mimeType:
          (response.headers.get('content-type') || defaultMime)
            .split(';')[0]
            .trim(),
        data: Buffer.from(
          await response.arrayBuffer()
        ).toString('base64'),
      };
    } catch (error) {
      console.warn('Remote image fetch failed:', error);
      return null;
    }
  }

  const clean = value
    .replace(
      /^data:image\/[a-zA-Z0-9+.-]+;base64,/,
      ''
    )
    .replace(/[\r\n\s]/g, '');

  return clean.length > 30
    ? {
        mimeType: defaultMime,
        data: clean,
      }
    : null;
}

/* =========================================================
   AI RESULT NORMALIZATION
========================================================= */

const DEFECT_TYPES = [
  'pothole',
  'road_crack',
  'surface_damage',
  'drainage_failure',
  'debris_or_obstruction',
  'road_marking_damage',
  'other_road_defect',
  'no_road_defect',
] as const;

const SEVERITIES = [
  'Critical',
  'High',
  'Medium',
  'Low',
] as const;

function parseAiJson(text: string) {
  const cleaned = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start === -1 || end <= start) {
    throw new Error(
      'AI returned an invalid validation response.'
    );
  }

  return JSON.parse(
    cleaned.slice(start, end + 1)
  );
}

function normalizeDefectResult(raw: any) {
  const defectType = DEFECT_TYPES.includes(
    raw?.defectType
  )
    ? raw.defectType
    : 'no_road_defect';

  const confidence = Number(raw?.confidence);
  const hazardScore = Number(raw?.hazardScore);
  const estimatedRepairDays = Number(
    raw?.estimatedRepairDays
  );

  return {
    defectDetected:
      raw?.defectDetected === true &&
      defectType !== 'no_road_defect',

    defectType,

    severity: SEVERITIES.includes(raw?.severity)
      ? raw.severity
      : 'Medium',

    hazardScore: Number.isFinite(hazardScore)
      ? Math.max(
          0,
          Math.min(100, Math.round(hazardScore))
        )
      : 0,

    confidence: Number.isFinite(confidence)
      ? Math.max(0, Math.min(1, confidence))
      : 0,

    aiSummary:
      typeof raw?.aiSummary === 'string'
        ? raw.aiSummary.trim().slice(0, 1000)
        : '',

    recommendedAction:
      typeof raw?.recommendedAction === 'string'
        ? raw.recommendedAction.trim().slice(0, 1000)
        : '',

    estimatedRepairDays:
      Number.isFinite(estimatedRepairDays)
        ? Math.max(
            0,
            Math.min(
              365,
              Math.round(estimatedRepairDays)
            )
          )
        : 0,

    suggestedDepartment:
      typeof raw?.suggestedDepartment === 'string'
        ? raw.suggestedDepartment.trim().slice(0, 200)
        : '',
  };
}

/* =========================================================
   FALLBACK RESULT
========================================================= */

function getAIUnavailableFallback() {
  return {
    defectDetected: true,
    defectType: 'other_road_defect',
    severity: 'Medium',
    hazardScore: 50,
    confidence: 0,
    aiSummary:
      'AI analysis is temporarily unavailable. The report has been received and requires municipal inspection.',
    recommendedAction:
      'Municipal authority should inspect the reported road condition and determine the appropriate repair action.',
    estimatedRepairDays: 0,
    suggestedDepartment: 'Road Maintenance',
    aiUnavailable: true,
  };
}

/* =========================================================
   ANALYZE ROAD DEFECT
========================================================= */

app.post(
  '/api/analyze-defect',
  requireFirebaseUser,
  async (req: AuthedRequest, res) => {
    try {
      const {
        imageBase64,
        photoUrl,
        imageUrl,
        mimeType = 'image/jpeg',
        description = '',
        location,
      } = req.body || {};

      const client = getAIClient();

      /*
       * IMPORTANT:
       * Do not block the report if the AI key is missing.
       */
      if (!client) {
        console.warn(
          'Gemini client unavailable. Returning fallback analysis.'
        );

        return res.json({
          success: true,
          data: getAIUnavailableFallback(),
        });
      }

      const image = await resolveImage(
        imageBase64 || photoUrl || imageUrl,
        mimeType
      );

      if (!image) {
        return res.status(400).json({
          success: false,
          error:
            'A valid road image is required for AI analysis.',
        });
      }

      const contents: any[] = [
        {
          inlineData: {
            mimeType: image.mimeType,
            data: image.data,
          },
        },

        `
You are the image-validation gate for a civic road complaint system.

Inspect the IMAGE first.

The citizen description is context only and must never override what is visible.

Determine whether the image clearly shows a physical road defect that a municipal road authority could inspect or repair.

A normal intact road, unrelated object, person, building, food, screenshot, document, or unclear image is not a road defect.

Return ONLY valid JSON.

Use exactly these fields:

defectDetected
defectType
severity
hazardScore
confidence
aiSummary
recommendedAction
estimatedRepairDays
suggestedDepartment

defectType must be one of:

pothole
road_crack
surface_damage
drainage_failure
debris_or_obstruction
road_marking_damage
other_road_defect
no_road_defect

severity must be:

Critical
High
Medium
Low

hazardScore must be 0-100.

confidence must be 0-1.

estimatedRepairDays must be an integer.

Do not invent measurements.

If evidence is insufficient:
defectDetected=false
defectType=no_road_defect
confidence below 0.65.

Citizen description:
${String(description).slice(0, 1000)}

Location:
${String(
  location?.formattedAddress ||
    location?.city ||
    'not supplied'
).slice(0, 300)}
`,
      ];

      const response = await generateGeminiContent(
        client,
        contents
      );

      const parsed = parseAiJson(
        response.text || ''
      );

      return res.json({
        success: true,
        data: normalizeDefectResult(parsed),
      });
    } catch (error: any) {
      console.error(
        'AI defect analysis failed:',
        {
          code: error?.code,
          status: error?.status,
          message: error?.message,
        }
      );

      /*
       * CRITICAL HACKATHON FIX:
       *
       * Gemini failure must NOT make the entire
       * civic complaint submission fail.
       *
       * The authority can manually inspect it.
       */

      return res.json({
        success: true,
        data: getAIUnavailableFallback(),
      });
    }
  }
);

/* =========================================================
   VERIFY REPAIR
========================================================= */

app.post(
  '/api/verify-repair',
  requireFirebaseUser,
  async (req: AuthedRequest, res: Response) => {
    try {
      const {
        beforeImageBase64,
        afterImageBase64,
        beforeImage,
        afterImage,
        beforeDescription = '',
        afterDescription = '',
        repairNotes = '',
      } = req.body || {};

      const beforeInput =
        beforeImageBase64 || beforeImage;

      const afterInput =
        afterImageBase64 || afterImage;

      if (!beforeInput || !afterInput) {
        return res.status(400).json({
          success: false,
          error:
            'Both before and after repair images are required.',
        });
      }

      if (beforeInput === afterInput) {
        return res.status(422).json({
          success: false,
          error:
            'Before and after images must be different.',
        });
      }

      const client = getAIClient();

      if (!client) {
        return res.status(503).json({
          success: false,
          error:
            'AI repair verification is not configured on the server.',
        });
      }

      const before =
        await resolveImage(beforeInput);

      const after =
        await resolveImage(afterInput);

      if (!before || !after) {
        return res.status(400).json({
          success: false,
          error:
            'Both submitted images must be valid.',
        });
      }

      const contents: any[] = [
        {
          inlineData: {
            mimeType: before.mimeType,
            data: before.data,
          },
        },

        {
          inlineData: {
            mimeType: after.mimeType,
            data: after.data,
          },
        },

        `
Compare Image 1 (before) and Image 2 (after)
for a municipal road repair.

Notes:

before:
${beforeDescription}

after:
${afterDescription}

repair:
${repairNotes}

Return ONLY valid JSON with:

isComparisonValid
status
overallScore
rejectionReason
details
stages
flags
payoutApproved

Reject a non-road after image.

Do not infer image origin such as Google or AI generation solely from pixels.

Use observable visual evidence only.
`,
      ];

      const response =
        await generateGeminiContent(
          client,
          contents
        );

      return res.json({
        success: true,
        data: parseAiJson(
          response.text || ''
        ),
      });
    } catch (error: any) {
      console.error(
        'Repair verification failed:',
        {
          code: error?.code,
          status: error?.status,
          message: error?.message,
        }
      );

      return res.status(503).json({
        success: false,
        error:
          friendlyGeminiError(error),
      });
    }
  }
);

/* =========================================================
   SERVERLESS EXPORT
========================================================= */

export const handler = serverless(app);
