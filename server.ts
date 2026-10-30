import http from 'http';
import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { Report, Hotspot, SupportedLang, Category } from './src/types/index.ts';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jxciyjwcejvisrtfrtam.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '-9Yk8Ov8jN3D8vbmelDdVBD78itlGxG40FeI4yp8qkY';
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
import { generateSampleReports } from './src/data/sampleReports.ts';
import {
  calculatePriorityScore,
  determinePriorityBand,
  computeTargetDueDate,
} from './src/utils/priority.ts';
import {
  areCategoriesRelated,
  haversineDistanceMeters,
  isValidCoordinate,
} from './src/utils/geo.ts';
import { detectHotspots } from './src/utils/hotspots.ts';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.resolve(DATA_DIR, 'reports.json');

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// ----------------------------------------------------
// Authentication & Security Setup (Demo Authority)
// ----------------------------------------------------
const SESSION_SECRET = process.env.SESSION_SECRET || 'voxsetu-secure-session-secret-987654';
const DEMO_EMAIL = 'officer@voxsetu.demo';
const DEMO_SALT = crypto.randomBytes(16).toString('hex');
const DEMO_PASSWORD_HASH = crypto.scryptSync('demo1234', DEMO_SALT, 64).toString('hex');

function verifyPassword(password: string): boolean {
  try {
    const hash = crypto.scryptSync(password, DEMO_SALT, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(DEMO_PASSWORD_HASH, 'hex'));
  } catch {
    return false;
  }
}

const loginAttemptsMap = new Map<string, { attempts: number; lockUntil: number }>();

function signSession(email: string): string {
  const payload = Buffer.from(JSON.stringify({ email, role: 'authority', exp: Date.now() + 8 * 3600 * 1000 })).toString('base64');
  const hmac = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return `${payload}.${hmac}`;
}

function verifySession(cookieVal: string): { email: string; role: string } | null {
  if (!cookieVal || typeof cookieVal !== 'string') return null;
  const parts = cookieVal.split('.');
  if (parts.length !== 2) return null;
  const [payload, hmac] = parts;
  const expectedHmac = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expectedHmac, 'hex'))) {
      return null;
    }
    const data = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));
    if (data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

const requireAuthority = (req: Request, res: Response, next: Function) => {
  const sessionCookie = req.cookies?.voxsetu_session;
  const session = verifySession(sessionCookie);
  if (!session || session.role !== 'authority') {
    res.status(401).json({ error: 'Unauthorized. Please sign in as an authority.' });
    return;
  }
  (req as any).user = session;
  next();
};

// ----------------------------------------------------
// Gemini AI Server-Side Setup
// ----------------------------------------------------
let aiClient: GoogleGenAI | null = null;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-3.8-flash';

if (GEMINI_API_KEY) {
  aiClient = new GoogleGenAI({
    apiKey: GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// In-memory caches for free-tier protection
const translationCache = new Map<string, string>();
const hotspotBriefCache = new Map<string, { brief: string; timestamp: number }>();

function callWithTimeout<T>(promise: Promise<T>, ms = 15000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('AI Request Timeout')), ms)
    ),
  ]);
}

async function retry<T>(fn: () => Promise<T>, retries = 2, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    console.warn(`[Retry] Operation failed, retrying in ${delay}ms... (${retries} left)`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return retry(fn, retries - 1, delay * 2);
  }
}

// ----------------------------------------------------
// Storage: In-memory with JSON file persistence
// ----------------------------------------------------
let reports: Report[] = [];

function loadReportsFromDisk(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        reports = parsed;
        console.log(`[Storage] Loaded ${reports.length} reports from disk.`);
        return;
      }
    }
  } catch (err) {
    console.warn('[Storage] Error reading disk file, regenerating sample seed data:', err);
  }

  // Fallback to sample reports
  reports = generateSampleReports();
  saveReportsToDisk();
  console.log(`[Storage] Initialized ${reports.length} seed sample reports.`);
}

function saveReportsToDisk(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(reports, null, 2), 'utf-8');

    // Asynchronously sync with Supabase PostgreSQL
    supabaseAdmin
      .from('voxsetu_reports')
      .upsert(
        reports.map((r) => ({
          id: r.id,
          tracking_code: r.trackingCode,
          category: r.category,
          status: r.status,
          priority_band: r.priorityBand,
          priority_score: r.priorityScore,
          lat: r.lat,
          lon: r.lon,
          data: r,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'id' }
      )
      .then(({ error }) => {
        if (error) {
          console.warn('[Supabase Sync] Table sync notice:', error.message);
        } else {
          console.log('[Supabase Sync] Successfully synchronized reports to Supabase PostgreSQL.');
        }
      })
      .then(null, () => {});
  } catch (err) {
    console.error('[Storage] Error persisting reports:', err);
  }
}

loadReportsFromDisk();

// ----------------------------------------------------
// User Storage: Citizen Accounts Persistent Storage
// ----------------------------------------------------
interface CitizenUser {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  fullName: string;
  phone?: string;
  citizenTrackingId: string;
  role: 'citizen';
  createdAt: string;
}

const USERS_FILE = path.resolve(DATA_DIR, 'users.json');
let users: CitizenUser[] = [];

function loadUsersFromDisk(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(USERS_FILE)) {
      const content = fs.readFileSync(USERS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        users = parsed;
        console.log(`[Users Storage] Loaded ${users.length} citizen users from disk.`);
        return;
      }
    }
  } catch (err) {
    console.warn('[Users Storage] Error reading users file:', err);
  }
  users = [];
}

function saveUsersToDisk(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');

    // Asynchronously sync with Supabase PostgreSQL
    supabaseAdmin
      .from('voxsetu_users')
      .upsert(
        users.map((u) => ({
          id: u.id,
          email: u.email,
          full_name: u.fullName,
          phone: u.phone,
          citizen_tracking_id: u.citizenTrackingId,
          role: u.role,
          data: u,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'id' }
      )
      .then(({ error }) => {
        if (error) {
          console.warn('[Supabase Sync Users] Notice:', error.message);
        } else {
          console.log('[Supabase Sync Users] Synchronized citizen users to Supabase PostgreSQL.');
        }
      })
      .then(null, () => {});
  } catch (err) {
    console.error('[Users Storage] Error persisting users:', err);
  }
}

loadUsersFromDisk();

function signCitizenSession(user: { id: string; email: string; fullName: string; citizenTrackingId: string }): string {
  const payload = Buffer.from(
    JSON.stringify({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      citizenTrackingId: user.citizenTrackingId,
      role: 'citizen',
      exp: Date.now() + 30 * 24 * 3600 * 1000,
    })
  ).toString('base64');
  const hmac = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return `${payload}.${hmac}`;
}

function verifyCitizenSession(cookieVal?: string): { id: string; email: string; fullName: string; citizenTrackingId: string; role: 'citizen' } | null {
  if (!cookieVal || typeof cookieVal !== 'string') return null;
  const parts = cookieVal.split('.');
  if (parts.length !== 2) return null;
  const [payload, hmac] = parts;
  const expectedHmac = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expectedHmac, 'hex'))) {
      return null;
    }
    const data = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));
    if (data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

// ----------------------------------------------------
// SSE (Server-Sent Events) live updates
// ----------------------------------------------------
type SSEClient = {
  id: number;
  res: Response;
};
let sseClients: SSEClient[] = [];
let nextClientId = 1;

function broadcastSSE(eventType: string, data: unknown): void {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.res.write(payload);
    } catch {
      // client dropped
    }
  });
}

app.get('/api/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clientId = nextClientId++;
  sseClients.push({ id: clientId, res });

  // Initial connection handshake
  res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', time: Date.now() })}\n\n`);

  // Heartbeat every 25 seconds
  const interval = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(interval);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(interval);
    sseClients = sseClients.filter((c) => c.id !== clientId);
  });
});

// Helper for generating short non-sequential tracking codes like VS-7K3Q9
function generateTrackingCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = 'VS-';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Ensure uniqueness
  if (reports.some((r) => r.trackingCode === code)) {
    return generateTrackingCode();
  }
  return code;
}

// ----------------------------------------------------
// AI Pipeline Functions
// ----------------------------------------------------
interface AnalysisResult {
  detectedLanguage: string;
  category: Category;
  summary_en: string;
  summary_user: string;
  factors: Report['factors'];
  suspectedSpam: boolean;
  isFallback: boolean;
}

const VALID_CATEGORIES: Category[] = [
  'Waterlogging',
  'Road damage',
  'Garbage',
  'Streetlight',
  'Drainage',
  'Other',
];

function ruleBasedFallbackAnalysis(text: string, lang: string): AnalysisResult {
  const lower = text.toLowerCase();
  let category: Category = 'Other';

  if (lower.includes('water') || lower.includes('flood') || lower.includes('ponding') || lower.includes('rain')) {
    category = 'Waterlogging';
  } else if (lower.includes('road') || lower.includes('pothole') || lower.includes('asphalt') || lower.includes('crater')) {
    category = 'Road damage';
  } else if (lower.includes('garbage') || lower.includes('waste') || lower.includes('trash') || lower.includes('bin') || lower.includes('dump')) {
    category = 'Garbage';
  } else if (lower.includes('light') || lower.includes('wire') || lower.includes('pole') || lower.includes('lamp') || lower.includes('dark')) {
    category = 'Streetlight';
  } else if (lower.includes('drain') || lower.includes('sewage') || lower.includes('manhole') || lower.includes('culvert')) {
    category = 'Drainage';
  }

  const words = text.split(/\s+/).slice(0, 22).join(' ');
  const summary = words.length > 0 ? `${words}...` : 'Civic incident reported by citizen.';

  return {
    detectedLanguage: lang || 'en',
    category,
    summary_en: summary,
    summary_user: summary,
    factors: {
      safetyRisk: { score: 3, reason: 'Rule-based estimate pending detailed inspection.' },
      peopleAffected: { score: 3, reason: 'Assumed moderate urban pedestrian and vehicle impact.' },
      vulnerableLocation: { score: 2, reason: 'Standard municipal zone.' },
      recurrence: { score: 2, reason: 'Initial submission baseline.' },
      durationOrWorsening: { score: 3, reason: 'Unspecified duration; standard priority assigned.' },
    },
    suspectedSpam: false,
    isFallback: true,
  };
}

async function analyzeReportWithGemini(
  text: string,
  userLang: string,
  imageDataUrl?: string
): Promise<AnalysisResult> {
  if (!aiClient) {
    return ruleBasedFallbackAnalysis(text, userLang);
  }

  const systemInstruction = `You are the core AI triage engine for VoxSetu, a civic infrastructure reporting platform.
Your task:
Analyze citizen complaints about urban issues (waterlogging, road damage, garbage, broken streetlights, open drains).
Use strictly what the report states or shows in the photo. Do NOT invent facts or hallucinate damages not reported. If details are missing, assign a middle score (2 or 3) and note in the reason that more information is needed.
Categories must be strictly one of: "Waterlogging", "Road damage", "Garbage", "Streetlight", "Drainage", "Other".
Factors to score (0 to 5) with a 1-sentence reason:
- safetyRisk: danger of bodily injury, electrocution, falling, accidents.
- peopleAffected: scale of public affected (isolated vs heavy pedestrian/transit corridor).
- vulnerableLocation: proximity to schools, hospitals, transit terminals, busy markets.
- recurrence: mentions of repeated failures, broken repairs, habitual dumping.
- durationOrWorsening: how long it has persisted or if conditions are actively deteriorating.
- suspectedSpam: true if gibberish, commercial advertising, or unrelated joke; false for genuine civic issues.

Return strict JSON only.
Translate and output summary_en in English (max 25 words).
Output summary_user in the citizen's selected language: "${userLang}" (max 25 words).
JSON keys must be English.`;

  const promptText = `Citizen report text: "${text}"\nCitizen UI language: "${userLang}".\nAnalyze this civic issue and return the structured JSON.`;

  const contents: unknown[] = [];
  if (imageDataUrl && imageDataUrl.startsWith('data:image/')) {
    const [header, base64Data] = imageDataUrl.split(',');
    const mimeMatch = header.match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    contents.push({
      inlineData: {
        mimeType,
        data: base64Data,
      },
    });
  }
  contents.push({ text: promptText });

  const executeCall = async () => {
    return await callWithTimeout(
      aiClient!.models.generateContent({
        model: GEMINI_MODEL,
        contents: contents as any,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction,
          responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedLanguage: { type: Type.STRING },
            category: { type: Type.STRING },
            summary_en: { type: Type.STRING },
            summary_user: { type: Type.STRING },
            factors: {
              type: Type.OBJECT,
              properties: {
                safetyRisk: {
                  type: Type.OBJECT,
                  properties: {
                    score: { type: Type.NUMBER },
                    reason: { type: Type.STRING },
                  },
                  required: ['score', 'reason'],
                },
                peopleAffected: {
                  type: Type.OBJECT,
                  properties: {
                    score: { type: Type.NUMBER },
                    reason: { type: Type.STRING },
                  },
                  required: ['score', 'reason'],
                },
                vulnerableLocation: {
                  type: Type.OBJECT,
                  properties: {
                    score: { type: Type.NUMBER },
                    reason: { type: Type.STRING },
                  },
                  required: ['score', 'reason'],
                },
                recurrence: {
                  type: Type.OBJECT,
                  properties: {
                    score: { type: Type.NUMBER },
                    reason: { type: Type.STRING },
                  },
                  required: ['score', 'reason'],
                },
                durationOrWorsening: {
                  type: Type.OBJECT,
                  properties: {
                    score: { type: Type.NUMBER },
                    reason: { type: Type.STRING },
                  },
                  required: ['score', 'reason'],
                },
              },
              required: [
                'safetyRisk',
                'peopleAffected',
                'vulnerableLocation',
                'recurrence',
                'durationOrWorsening',
              ],
            },
            suspectedSpam: { type: Type.BOOLEAN },
            spamReason: { type: Type.STRING },
          },
          required: [
            'detectedLanguage',
            'category',
            'summary_en',
            'summary_user',
            'factors',
            'suspectedSpam',
          ],
        },
      },
    })
  );
};

  // Resilient execution with 1 retry
  try {
    let resp;
    try {
      resp = await executeCall();
    } catch (firstErr) {
      console.warn('[Gemini AI] First call failed, retrying once...', firstErr);
      resp = await executeCall();
    }

    const rawJson = (resp.text || '').trim();
    const parsed = JSON.parse(rawJson);

    let cat: Category = 'Other';
    if (VALID_CATEGORIES.includes(parsed.category)) {
      cat = parsed.category as Category;
    }

    return {
      detectedLanguage: parsed.detectedLanguage || userLang,
      category: cat,
      summary_en: parsed.summary_en || text.slice(0, 100),
      summary_user: parsed.summary_user || text.slice(0, 100),
      factors: {
        safetyRisk: {
          score: Math.min(5, Math.max(0, Number(parsed.factors?.safetyRisk?.score) || 2)),
          reason: parsed.factors?.safetyRisk?.reason || 'Evaluated based on report details.',
        },
        peopleAffected: {
          score: Math.min(5, Math.max(0, Number(parsed.factors?.peopleAffected?.score) || 2)),
          reason: parsed.factors?.peopleAffected?.reason || 'Evaluated based on report details.',
        },
        vulnerableLocation: {
          score: Math.min(5, Math.max(0, Number(parsed.factors?.vulnerableLocation?.score) || 2)),
          reason: parsed.factors?.vulnerableLocation?.reason || 'Evaluated based on report details.',
        },
        recurrence: {
          score: Math.min(5, Math.max(0, Number(parsed.factors?.recurrence?.score) || 1)),
          reason: parsed.factors?.recurrence?.reason || 'Evaluated based on report details.',
        },
        durationOrWorsening: {
          score: Math.min(5, Math.max(0, Number(parsed.factors?.durationOrWorsening?.score) || 2)),
          reason: parsed.factors?.durationOrWorsening?.reason || 'Evaluated based on report details.',
        },
      },
      suspectedSpam: Boolean(parsed.suspectedSpam),
      isFallback: false,
    };
  } catch (err) {
    console.error('[Gemini AI] Analysis failed after retry, falling back to rule-based:', err);
    return ruleBasedFallbackAnalysis(text, userLang);
  }
}

async function checkDuplicateWithGemini(
  newReportText: string,
  newReportCategory: string,
  candidates: Report[]
): Promise<{ duplicateOf: string | null; confidence: number; reason: string }> {
  if (!aiClient || candidates.length === 0) {
    return { duplicateOf: null, confidence: 0, reason: 'No AI check performed' };
  }

  try {
    const candidateSummaries = candidates.map((c) => ({
      id: c.id,
      trackingCode: c.trackingCode,
      category: c.category,
      summary: c.summary_en,
      text: c.originalText,
    }));

    const prompt = `Compare this new citizen civic report against existing nearby candidate reports to determine if it is reporting the exact same physical issue/defect.
New report:
Category: ${newReportCategory}
Text: "${newReportText}"

Nearby existing candidates:
${JSON.stringify(candidateSummaries, null, 2)}

Instructions:
- If this new report refers to the exact same physical defect (e.g. the same pothole, same open drain, same uncollected garbage heap), identify the candidate id.
- Assign confidence score between 0.0 and 1.0.
- If confidence >= 0.7, set duplicateOf to that candidate id. Otherwise null.
- Provide a brief 1-sentence reason.`;

    const resp = await callWithTimeout(
      aiClient.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            duplicateOf: { type: Type.STRING, nullable: true },
            confidence: { type: Type.NUMBER },
            reason: { type: Type.STRING },
          },
          required: ['confidence', 'reason'],
        },
      },
    })
  );

    const parsed = JSON.parse(resp.text || '{}');
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;
    const matchId = candidates.some((c) => c.id === parsed.duplicateOf) ? parsed.duplicateOf : null;

    return {
      duplicateOf: confidence >= 0.7 ? matchId : null,
      confidence,
      reason: parsed.reason || 'Candidate comparison completed.',
    };
  } catch (err) {
    console.warn('[Gemini AI] Duplicate check failed:', err);
    return { duplicateOf: null, confidence: 0, reason: 'AI duplicate check error' };
  }
}

async function generateFriendlyCitizenMessage(
  officerNote: string,
  status: string,
  citizenLang: string
): Promise<string> {
  if (!aiClient) return officerNote;

  try {
    const prompt = `You are a municipal communication officer for VoxSetu.
A municipal triage officer updated a citizen's civic complaint:
Status: "${status}"
Internal officer note: "${officerNote}"

Rewrite this officer's note into ONE friendly, respectful, and crystal-clear sentence addressed to the citizen in the target language: "${citizenLang}".
CRITICAL RULES:
- Never add dates, promises, timelines, or facts that are not present in the officer's note.
- Keep it concise (under 25 words).
- If the target language is not English, write the sentence in that language.`;

    const resp = await callWithTimeout(
      aiClient.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      })
    );

    const text = (resp.text || '').trim().replace(/^["']|["']$/g, '');
    return text || officerNote;
  } catch (err) {
    console.warn('[Gemini AI] Friendly message generation failed, using raw note:', err);
    return officerNote;
  }
}

async function analyzeImageWithGemini(
  imageDataUrl: string,
  userLang: string
): Promise<{
  isUnclear: boolean;
  unclearReason: string | null;
  category: Category;
  description_user: string;
  description_en: string;
  isFallback?: boolean;
}> {
  if (!aiClient) {
    return {
      isUnclear: false,
      unclearReason: null,
      category: 'Other',
      description_user: 'A civic problem is visible in the uploaded photo.',
      description_en: 'A civic problem is visible in the uploaded photo.',
      isFallback: true,
    };
  }

  const systemInstruction = `You are a municipal civic inspection AI for VoxSetu.
Your task is to analyze an uploaded photo of a reported civic issue and generate ONE clear, concise sentence describing the visible civic problem for the citizen.

CRITICAL RULES FOR PHOTO ANALYSIS:
1. Generate EXACTLY ONE clear, concise sentence describing the visible civic problem (for example: "A large pothole is visible in the middle of the road.", "A heap of uncollected garbage is overflowing on the roadside.", "An uncovered manhole is present near the pedestrian path.").
2. Describe ONLY what can be seen in the image. Do NOT guess, invent, or mention the cause, fault, responsible department, or exact location.
3. FLAG UNCLEAR, BLURRY, DARK, EXTREMELY CLOSE-UP, OR NON-CIVIC IMAGES: If the photo is too blurry, dark, out of focus, or contains no identifiable civic problem, set "isUnclear": true and ask the citizen to upload a clearer photo in "unclearReason" in language "${userLang}" (for example: "The problem in the photo is unclear. Please upload a clearer photo.").
4. If the photo is clear and shows a civic issue, set "isUnclear": false and "unclearReason": null.
5. Identify the most matching category strictly among: "Waterlogging", "Road damage", "Garbage", "Streetlight", "Drainage", "Other".
6. Return the single-sentence problem description in the citizen's language "${userLang}" ("description_user") and in English ("description_en").

Return strict JSON matching the schema.`;

  const promptText = `Analyze this civic issue photo. Draft description in citizen language "${userLang}". Output structured JSON.`;

  const contents: unknown[] = [];
  if (imageDataUrl && imageDataUrl.startsWith('data:image/')) {
    const [header, base64Data] = imageDataUrl.split(',');
    const mimeMatch = header.match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    contents.push({
      inlineData: {
        mimeType,
        data: base64Data,
      },
    });
  } else {
    throw new Error('Invalid image data URL');
  }
  contents.push({ text: promptText });

  const executeCall = async () => {
    return await callWithTimeout(
      aiClient!.models.generateContent({
        model: GEMINI_MODEL,
        contents: contents as any,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isUnclear: { type: Type.BOOLEAN },
              unclearReason: { type: Type.STRING },
              category: { type: Type.STRING },
              description_user: { type: Type.STRING },
              description_en: { type: Type.STRING },
            },
            required: ['isUnclear', 'category', 'description_user', 'description_en'],
          },
        },
      })
    );
  };

  try {
    let resp;
    try {
      resp = await executeCall();
    } catch (firstErr) {
      console.warn('[Gemini AI] Photo analysis first call failed, retrying once...', firstErr);
      resp = await executeCall();
    }

    const rawJson = (resp.text || '').trim();
    const parsed = JSON.parse(rawJson);

    let cat: Category = 'Other';
    if (VALID_CATEGORIES.includes(parsed.category)) {
      cat = parsed.category as Category;
    }

    return {
      isUnclear: Boolean(parsed.isUnclear),
      unclearReason: parsed.unclearReason || null,
      category: cat,
      description_user: parsed.description_user || parsed.description_en || 'A civic problem is visible in the uploaded photo.',
      description_en: parsed.description_en || 'A civic problem is visible in the uploaded photo.',
      isFallback: false,
    };
  } catch (err) {
    console.warn('[Gemini AI] Photo analysis failed, using fallback:', err);
    return {
      isUnclear: false,
      unclearReason: null,
      category: 'Other',
      description_user: 'A civic problem is visible in the uploaded photo.',
      description_en: 'A civic problem is visible in the uploaded photo.',
      isFallback: true,
    };
  }
}

// ----------------------------------------------------
// Public and Authority Endpoints
// ----------------------------------------------------

// 0. POST /api/analyze-image (Citizen uploads photo -> AI suggests description & category)
app.post('/api/analyze-image', async (req: Request, res: Response) => {
  try {
    const { imageDataUrl, lang } = req.body;

    if (!imageDataUrl || typeof imageDataUrl !== 'string') {
      res.status(400).json({ error: 'Image data URL is required' });
      return;
    }

    const header = imageDataUrl.split(',')[0] || '';
    if (!header.includes('data:image/')) {
      res.status(400).json({
        error: 'Unsupported file format. Please upload a valid image file (JPEG, PNG, WebP, GIF, or HEIC).'
      });
      return;
    }

    const base64Length = imageDataUrl.length - imageDataUrl.indexOf(',') - 1;
    const estimatedBytes = (base64Length * 3) / 4;
    if (estimatedBytes > 12 * 1024 * 1024) {
      res.status(400).json({
        error: 'Selected photo is too large (maximum 10MB). Please select a smaller photo.'
      });
      return;
    }

    const selectedLang: SupportedLang = ['en', 'hi', 'kn', 'te'].includes(lang) ? lang : 'en';

    const result = await analyzeImageWithGemini(imageDataUrl, selectedLang);
    res.json(result);
  } catch (err: any) {
    console.error('Photo analysis error:', err);
    res.status(500).json({
      error: 'Could not analyze photo automatically. You can still type your description manually.'
    });
  }
});

// ----------------------------------------------------
// Citizen Account & Permanent Tracking Registry
// ----------------------------------------------------
const citizenAccountsMap = new Map<string, { token: string; createdAt: string }>();

app.post('/api/citizen/account', (req: Request, res: Response) => {
  const { citizenId, token } = req.body;
  if (!citizenId || typeof citizenId !== 'string') {
    res.status(400).json({ error: 'Citizen ID is required' });
    return;
  }
  const cleanId = citizenId.trim().toUpperCase();
  const accountToken = (typeof token === 'string' && token.trim()) ? token.trim() : `ctok_${Math.random().toString(36).substring(2, 12)}`;

  if (!citizenAccountsMap.has(cleanId)) {
    citizenAccountsMap.set(cleanId, { token: accountToken, createdAt: new Date().toISOString() });
  }

  res.json({
    citizenId: cleanId,
    token: citizenAccountsMap.get(cleanId)?.token || accountToken,
  });
});

// 1. POST /api/reports (Citizen submits report)
app.post('/api/reports', async (req: Request, res: Response) => {
  try {
    const { text, imageDataUrl, category: userCategory, lat, lon, lang, citizenId: reqCitizenId, token: reqToken } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      res.status(400).json({ error: 'Report description is required' });
      return;
    }
    if (text.length > 2000) {
      res.status(400).json({ error: 'Description is too long (maximum 2000 characters)' });
      return;
    }
    if (!isValidCoordinate(lat, lon)) {
      res.status(400).json({ error: 'Valid geographic coordinates are required' });
      return;
    }

    const headerToken = req.headers['x-citizen-token'] as string;
    const citizenToken = reqToken || headerToken || '';
    const citizenSession = verifyCitizenSession(req.cookies?.voxsetu_citizen_session);

    let assignedCitizenId = citizenSession?.citizenTrackingId
      ? citizenSession.citizenTrackingId
      : (typeof reqCitizenId === 'string' && reqCitizenId.trim())
      ? reqCitizenId.trim().toUpperCase()
      : generateTrackingCode();

    // Register or verify citizen account
    if (!citizenAccountsMap.has(assignedCitizenId)) {
      citizenAccountsMap.set(assignedCitizenId, {
        token: citizenToken || `ctok_${Math.random().toString(36).substring(2, 12)}`,
        createdAt: new Date().toISOString(),
      });
    }

    const selectedLang: SupportedLang = ['en', 'hi', 'kn', 'te'].includes(lang) ? lang : 'en';

    // Step 1: AI Analysis
    const analysis = await analyzeReportWithGemini(text, selectedLang, imageDataUrl);
    const finalCategory: Category = userCategory && VALID_CATEGORIES.includes(userCategory)
      ? userCategory
      : analysis.category;

    // Step 2: Priority in CODE
    const { score: initialScore } = calculatePriorityScore(analysis.factors, 0);
    const initialBand = determinePriorityBand(initialScore, analysis.factors.safetyRisk.score);
    const createdAt = new Date().toISOString();
    const targetDueAt = computeTargetDueDate(createdAt, initialBand);
    const trackingCode = assignedCitizenId; // Report uses permanent citizen tracking ID
    const reportId = `rep-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // Step 3: Duplicate Check in CODE
    const nearbyCandidates = reports.filter((r) => {
      if (r.status === 'Resolved' || r.duplicateOf) return false;
      if (!areCategoriesRelated(r.category, finalCategory)) return false;
      const dist = haversineDistanceMeters(lat, lon, r.lat, r.lon);
      return dist <= 150;
    });

    let duplicateOf: string | null = null;
    let duplicateConfidence: number | null = null;
    let duplicateReason: string | null = null;

    if (nearbyCandidates.length > 0) {
      const dupCheck = await checkDuplicateWithGemini(text, finalCategory, nearbyCandidates);
      if (dupCheck.confidence >= 0.7 && dupCheck.duplicateOf) {
        duplicateOf = dupCheck.duplicateOf;
        duplicateConfidence = dupCheck.confidence;
        duplicateReason = dupCheck.reason;

        const parent = reports.find((r) => r.id === duplicateOf);
        if (parent) {
          parent.linkedCount = (parent.linkedCount || 0) + 1;
          const { score: newScore } = calculatePriorityScore(parent.factors, parent.linkedCount);
          parent.priorityScore = newScore;
          parent.priorityBand = determinePriorityBand(newScore, parent.factors.safetyRisk.score);
          parent.statusHistory.push({
            status: parent.status,
            note: `System linked duplicate report under citizen tracking ID ${trackingCode}. Duplicate count: ${parent.linkedCount}`,
            citizenMessage: `Another citizen nearby reported this same issue. Triage urgency elevated.`,
            by: 'System (AI Triage)',
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    const newReport: Report = {
      id: reportId,
      trackingCode,
      citizenId: assignedCitizenId,
      userId: citizenSession?.id,
      originalText: text,
      originalLanguage: analysis.detectedLanguage || selectedLang,
      summary_en: analysis.summary_en,
      summary_user: analysis.summary_user,
      category: finalCategory,
      lat: Number(lat.toFixed(6)),
      lon: Number(lon.toFixed(6)),
      imageDataUrl: imageDataUrl || undefined,
      factors: analysis.factors,
      priorityScore: initialScore,
      priorityBand: initialBand,
      status: 'Submitted',
      assignedTeam: null,
      duplicateOf,
      duplicateConfidence,
      duplicateReason,
      linkedCount: 0,
      affectedCount: 0,
      targetDueAt,
      statusHistory: [
        {
          status: 'Submitted',
          note: 'Citizen report received through VoxSetu web app.',
          citizenMessage: 'Your report was received and analyzed by our AI triage system.',
          by: 'System',
          timestamp: createdAt,
        },
      ],
      resolutionNote: null,
      citizenConfirmed: false,
      reopenCount: 0,
      suspectedSpam: analysis.suspectedSpam,
      isSample: false,
      isFallbackAi: analysis.isFallback,
      createdAt,
    };

    reports.unshift(newReport);
    saveReportsToDisk();

    // Broadcast SSE
    broadcastSSE('report_created', {
      reportId: newReport.id,
      trackingCode: newReport.trackingCode,
      citizenId: newReport.citizenId,
      category: newReport.category,
      priorityBand: newReport.priorityBand,
      duplicateOf: newReport.duplicateOf,
    });

    res.status(201).json({
      trackingCode: newReport.trackingCode,
      citizenId: newReport.citizenId,
      report: {
        id: newReport.id,
        trackingCode: newReport.trackingCode,
        citizenId: newReport.citizenId,
        summary_user: newReport.summary_user,
        summary_en: newReport.summary_en,
        category: newReport.category,
        priorityScore: newReport.priorityScore,
        priorityBand: newReport.priorityBand,
        factors: newReport.factors,
        status: newReport.status,
        targetDueAt: newReport.targetDueAt,
        linkedCount: newReport.linkedCount,
        duplicateOf: newReport.duplicateOf,
        duplicateReason: newReport.duplicateReason,
        isFallbackAi: newReport.isFallbackAi,
      },
    });
  } catch (err: any) {
    console.error('[POST /api/reports] Error:', err);
    res.status(500).json({ error: 'Failed to process report: ' + (err.message || 'Server error') });
  }
});

// Auth API Endpoints
app.post('/api/auth/login', (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  let record = loginAttemptsMap.get(ip);
  if (record && record.lockUntil > now) {
    const waitSecs = Math.ceil((record.lockUntil - now) / 1000);
    res.status(429).json({ error: 'too_many_attempts', retryAfter: waitSecs });
    return;
  }

  const { email, password } = req.body;
  if (!email || !password || email.trim().toLowerCase() !== DEMO_EMAIL || !verifyPassword(password)) {
    if (!record) {
      record = { attempts: 1, lockUntil: 0 };
    } else {
      record.attempts += 1;
    }
    if (record.attempts >= 5) {
      record.lockUntil = now + 60 * 1000;
      record.attempts = 0;
      loginAttemptsMap.set(ip, record);
      res.status(429).json({ error: 'too_many_attempts', retryAfter: 60 });
      return;
    }
    loginAttemptsMap.set(ip, record);
    res.status(401).json({ error: 'invalid_login' });
    return;
  }

  loginAttemptsMap.delete(ip);

  console.log(`[Auth] Authority login attempt: ${email} from ${ip}`);
  const token = signSession(DEMO_EMAIL);

  res.cookie('voxsetu_session', token, {
    httpOnly: true,
    sameSite: 'none',
    secure: true,
    maxAge: 8 * 3600 * 1000,
  });

  console.log(`[Auth] Authority login successful: ${email}`);
  res.json({ success: true, email: DEMO_EMAIL, role: 'authority' });
});

app.post('/api/auth/logout', (_req: Request, res: Response) => {
  res.clearCookie('voxsetu_session');
  res.json({ success: true });
});

app.get('/api/auth/me', (req: Request, res: Response) => {
  const sessionCookie = req.cookies?.voxsetu_session;
  const session = verifySession(sessionCookie);
  if (!session) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  res.json({ email: session.email, role: session.role });
});

// Citizen Authentication API Endpoints
app.post('/api/auth/citizen/register', (req: Request, res: Response) => {
  const { email, password, fullName, phone } = req.body;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ error: 'invalid_email', message: 'Please provide a valid email address.' });
    return;
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ error: 'invalid_password', message: 'Password must be at least 6 characters long.' });
    return;
  }
  if (!fullName || typeof fullName !== 'string' || fullName.trim().length === 0) {
    res.status(400).json({ error: 'invalid_fullname', message: 'Please provide your full name.' });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();
  const existingUser = users.find((u) => u.email === cleanEmail);

  if (existingUser) {
    res.status(400).json({
      error: 'email_taken',
      message: 'An account with this email address already exists. Please sign in instead.',
    });
    return;
  }

  // Hash password using salted scrypt
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex');
  const citizenTrackingId = generateTrackingCode();

  const newUser: CitizenUser = {
    id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    email: cleanEmail,
    passwordHash,
    salt,
    fullName: fullName.trim(),
    phone: phone ? String(phone).trim() : undefined,
    citizenTrackingId,
    role: 'citizen',
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveUsersToDisk();

  // Register in citizen accounts map
  citizenAccountsMap.set(citizenTrackingId, {
    token: `ctok_${newUser.id}`,
    createdAt: newUser.createdAt,
  });

  const token = signCitizenSession(newUser);

  res.cookie('voxsetu_citizen_session', token, {
    httpOnly: true,
    sameSite: 'none',
    secure: true,
    maxAge: 30 * 24 * 3600 * 1000,
  });

  res.status(201).json({
    success: true,
    user: {
      id: newUser.id,
      email: newUser.email,
      fullName: newUser.fullName,
      citizenTrackingId: newUser.citizenTrackingId,
    },
  });
});

app.post('/api/auth/citizen/login', (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'missing_fields', message: 'Email and password are required.' });
    return;
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const user = users.find((u) => u.email === cleanEmail);

  if (!user) {
    res.status(401).json({ error: 'invalid_credentials', message: 'Invalid email address or password.' });
    return;
  }

  try {
    const checkHash = crypto.scryptSync(password, user.salt, 64).toString('hex');
    if (!crypto.timingSafeEqual(Buffer.from(checkHash, 'hex'), Buffer.from(user.passwordHash, 'hex'))) {
      res.status(401).json({ error: 'invalid_credentials', message: 'Invalid email address or password.' });
      return;
    }
  } catch {
    res.status(401).json({ error: 'invalid_credentials', message: 'Invalid email address or password.' });
    return;
  }

  const token = signCitizenSession(user);

  res.cookie('voxsetu_citizen_session', token, {
    httpOnly: true,
    sameSite: 'none',
    secure: true,
    maxAge: 30 * 24 * 3600 * 1000,
  });

  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      citizenTrackingId: user.citizenTrackingId,
    },
  });
});

app.post('/api/auth/citizen/logout', (_req: Request, res: Response) => {
  res.clearCookie('voxsetu_citizen_session');
  res.json({ success: true });
});

app.get('/api/auth/citizen/me', (req: Request, res: Response) => {
  const sessionCookie = req.cookies?.voxsetu_citizen_session;
  const session = verifyCitizenSession(sessionCookie);

  if (!session) {
    res.json({ authenticated: false, user: null });
    return;
  }

  res.json({
    authenticated: true,
    user: {
      id: session.id,
      email: session.email,
      fullName: session.fullName,
      citizenTrackingId: session.citizenTrackingId,
    },
  });
});

// 2. GET /api/reports (Full list for Authority view - protected by requireAuthority)
app.get('/api/reports', requireAuthority, (req: Request, res: Response) => {
  res.json(reports);
});

// 3. GET /api/similar (Nearby reports for citizen prompt before submit)
app.get('/api/similar', (req: Request, res: Response) => {
  const lat = parseFloat(req.query.lat as string);
  const lon = parseFloat(req.query.lon as string);
  const category = req.query.category as string;

  if (isNaN(lat) || isNaN(lon)) {
    res.status(400).json({ error: 'Invalid coordinates' });
    return;
  }

  const similar = reports
    .filter((r) => {
      if (r.status === 'Resolved' || r.duplicateOf) return false;
      if (category && !areCategoriesRelated(r.category, category)) return false;
      const d = haversineDistanceMeters(lat, lon, r.lat, r.lon);
      return d <= 150;
    })
    .slice(0, 5)
    .map((r) => ({
      id: r.id,
      trackingCode: r.trackingCode,
      citizenId: r.citizenId,
      summary_en: r.summary_en,
      summary_user: r.summary_user,
      category: r.category,
      lat: r.lat,
      lon: r.lon,
      distanceMeters: Math.round(haversineDistanceMeters(lat, lon, r.lat, r.lon)),
      affectedCount: r.affectedCount,
      priorityBand: r.priorityBand,
      status: r.status,
    }));

  res.json(similar);
});

// 4. GET /api/track/:code (View reports for a citizen permanent tracking ID)
app.get('/api/track/:code', (req: Request, res: Response) => {
  const queryCode = (req.params.code || '').trim().toUpperCase();
  if (!queryCode) {
    res.status(400).json({ error: 'Tracking code or citizen ID is required' });
    return;
  }

  // Find all reports associated with this trackingCode or citizenId
  const matchingReports = reports.filter(
    (r) =>
      (r.citizenId && r.citizenId.toUpperCase() === queryCode) ||
      (r.trackingCode && r.trackingCode.toUpperCase() === queryCode) ||
      (r.id && r.id.toUpperCase() === queryCode)
  );

  if (matchingReports.length === 0) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }

  const targetCitizenId = matchingReports[0].citizenId || matchingReports[0].trackingCode;

  // Access Control: Verify token, citizen session, or authority officer session
  const officerSessionCookie = req.cookies?.voxsetu_session;
  const isAuthority = Boolean(verifySession(officerSessionCookie)?.role === 'authority');

  const citizenSessionCookie = req.cookies?.voxsetu_citizen_session;
  const citizenSession = verifyCitizenSession(citizenSessionCookie);
  const isOwnCitizenSession = Boolean(
    citizenSession &&
      (citizenSession.citizenTrackingId.toUpperCase() === targetCitizenId.toUpperCase() ||
        matchingReports.some((r) => r.userId === citizenSession.id))
  );

  const reqToken = (req.headers['x-citizen-token'] as string) || (req.query.token as string) || '';
  const registeredAccount = citizenAccountsMap.get(targetCitizenId);

  // Require authorization via authority officer session, matching citizen session, or matching token
  if (registeredAccount && registeredAccount.token && !isAuthority && !isOwnCitizenSession) {
    if (!reqToken || reqToken !== registeredAccount.token) {
      res.status(403).json({
        error: 'unauthorized_citizen_access',
        message: "Access restricted: You do not have permission to view another citizen's reports.",
      });
      return;
    }
  }

  // Map each report with its resolved active status (following parent duplicate if merged)
  const mappedReports = matchingReports.map((rep) => {
    let parentReport: Report | null = null;
    if (rep.duplicateOf) {
      parentReport = reports.find((r) => r.id === rep.duplicateOf) || null;
    }
    const active = parentReport || rep;

    return {
      id: rep.id,
      trackingCode: rep.trackingCode,
      citizenId: rep.citizenId || targetCitizenId,
      isMergedDuplicate: Boolean(rep.duplicateOf),
      parentTrackingCode: parentReport?.trackingCode || null,
      summary_user: rep.summary_user,
      summary_en: rep.summary_en,
      originalText: rep.originalText,
      category: rep.category,
      priorityBand: active.priorityBand,
      priorityScore: active.priorityScore,
      status: active.status,
      assignedTeam: active.assignedTeam,
      statusHistory: active.statusHistory,
      targetDueAt: active.targetDueAt,
      linkedCount: active.linkedCount,
      affectedCount: active.affectedCount,
      citizenConfirmed: active.citizenConfirmed,
      reopenCount: active.reopenCount,
      imageDataUrl: rep.imageDataUrl,
      createdAt: rep.createdAt,
      lastUpdated: active.statusHistory[active.statusHistory.length - 1]?.timestamp || active.createdAt,
    };
  });

  const primary = mappedReports[0];

  res.json({
    citizenId: targetCitizenId,
    totalReportsCount: mappedReports.length,
    reports: mappedReports,

    // Backward compatibility fields for single-report views
    trackingCode: primary.trackingCode,
    isMergedDuplicate: primary.isMergedDuplicate,
    parentTrackingCode: primary.parentTrackingCode,
    summary_user: primary.summary_user,
    summary_en: primary.summary_en,
    category: primary.category,
    priorityBand: primary.priorityBand,
    priorityScore: primary.priorityScore,
    status: primary.status,
    assignedTeam: primary.assignedTeam,
    statusHistory: primary.statusHistory,
    targetDueAt: primary.targetDueAt,
    linkedCount: primary.linkedCount,
    affectedCount: primary.affectedCount,
    citizenConfirmed: primary.citizenConfirmed,
    reopenCount: primary.reopenCount,
    createdAt: primary.createdAt,
    lastUpdated: primary.lastUpdated,
  });
});

// 5. PATCH /api/reports/:id/status (Authority updates status)
app.patch('/api/reports/:id/status', requireAuthority, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, note, assignedTeam, resolutionNote } = req.body;

  const report = reports.find((r) => r.id === id);
  if (!report) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }

  if (status === 'Resolved' && (!resolutionNote || resolutionNote.trim().length === 0)) {
    res.status(400).json({ error: 'Resolution note is required when resolving an issue.' });
    return;
  }

  const effectiveNote = note?.trim() || `Status updated to ${status}.`;

  // AI Step 5: rewrite officer's note into friendly citizen message in citizen's language
  const citizenMessage = await generateFriendlyCitizenMessage(
    effectiveNote,
    status,
    report.originalLanguage || 'en'
  );

  report.status = status;
  if (assignedTeam !== undefined) {
    report.assignedTeam = assignedTeam;
  }
  if (resolutionNote !== undefined) {
    report.resolutionNote = resolutionNote;
  }

  const historyEntry = {
    status,
    note: effectiveNote,
    citizenMessage,
    by: 'Authority Officer',
    timestamp: new Date().toISOString(),
  };
  report.statusHistory.push(historyEntry);

  saveReportsToDisk();

  broadcastSSE('status_changed', {
    reportId: report.id,
    trackingCode: report.trackingCode,
    status: report.status,
    citizenMessage,
    timestamp: historyEntry.timestamp,
  });

  res.json({ success: true, report, citizenMessage });
});

// 6. POST /api/track/:code/affected ("I'm affected too")
app.post('/api/track/:code/affected', (req: Request, res: Response) => {
  const code = (req.params.code || '').trim().toUpperCase();
  const report = reports.find((r) => r.trackingCode.toUpperCase() === code);
  if (!report) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }

  // Update on target or parent if duplicate
  const target = report.duplicateOf ? reports.find((r) => r.id === report.duplicateOf) || report : report;
  target.affectedCount = (target.affectedCount || 0) + 1;

  saveReportsToDisk();

  broadcastSSE('affected_incremented', {
    trackingCode: target.trackingCode,
    affectedCount: target.affectedCount,
  });

  res.json({ success: true, affectedCount: target.affectedCount });
});

// 7. POST /api/track/:code/info (Citizen adds more info / photo)
app.post('/api/track/:code/info', (req: Request, res: Response) => {
  const code = (req.params.code || '').trim().toUpperCase();
  const { note, imageDataUrl } = req.body;

  if (!note && !imageDataUrl) {
    res.status(400).json({ error: 'Note or photo is required' });
    return;
  }

  const report = reports.find((r) => r.trackingCode.toUpperCase() === code);
  if (!report) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }

  const target = report.duplicateOf ? reports.find((r) => r.id === report.duplicateOf) || report : report;

  const historyEntry = {
    status: target.status,
    note: `Citizen update: ${note || 'Additional photo attached'}`,
    citizenMessage: `You provided additional information: ${note || 'Photo attached'}.`,
    by: 'Citizen',
    timestamp: new Date().toISOString(),
  };

  target.statusHistory.push(historyEntry);
  if (imageDataUrl && !target.imageDataUrl) {
    target.imageDataUrl = imageDataUrl;
  }

  saveReportsToDisk();

  broadcastSSE('citizen_info_added', {
    trackingCode: target.trackingCode,
    historyEntry,
  });

  res.json({ success: true, statusHistory: target.statusHistory });
});

// 8. POST /api/track/:code/confirm (Citizen confirms resolved)
app.post('/api/track/:code/confirm', (req: Request, res: Response) => {
  const code = (req.params.code || '').trim().toUpperCase();
  const report = reports.find((r) => r.trackingCode.toUpperCase() === code);
  if (!report) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }

  const target = report.duplicateOf ? reports.find((r) => r.id === report.duplicateOf) || report : report;
  target.citizenConfirmed = true;
  target.statusHistory.push({
    status: target.status,
    note: 'Citizen confirmed issue resolution.',
    citizenMessage: 'Thank you! You confirmed this civic issue has been resolved satisfactorily.',
    by: 'Citizen',
    timestamp: new Date().toISOString(),
  });

  saveReportsToDisk();

  broadcastSSE('citizen_confirmed', {
    trackingCode: target.trackingCode,
  });

  res.json({ success: true });
});

// 9. POST /api/track/:code/reopen (Citizen reopens issue)
app.post('/api/track/:code/reopen', (req: Request, res: Response) => {
  const code = (req.params.code || '').trim().toUpperCase();
  const { reason } = req.body;

  const report = reports.find((r) => r.trackingCode.toUpperCase() === code);
  if (!report) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }

  const target = report.duplicateOf ? reports.find((r) => r.id === report.duplicateOf) || report : report;
  target.status = 'Reopened';
  target.reopenCount = (target.reopenCount || 0) + 1;
  target.citizenConfirmed = false;

  const entry = {
    status: 'Reopened' as const,
    note: `Citizen reopened issue: ${reason || 'Issue recurring or incomplete repair.'}`,
    citizenMessage: `You reopened this report. Our triage team will review it again promptly.`,
    by: 'Citizen',
    timestamp: new Date().toISOString(),
  };

  target.statusHistory.push(entry);

  saveReportsToDisk();

  broadcastSSE('report_reopened', {
    trackingCode: target.trackingCode,
    reopenCount: target.reopenCount,
  });

  res.json({ success: true, status: target.status, reopenCount: target.reopenCount });
});

// 10. Authority Duplicate Unlink & Confirm
app.post('/api/reports/:id/unlink', requireAuthority, (req: Request, res: Response) => {
  const { id } = req.params;
  const report = reports.find((r) => r.id === id);
  if (!report) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }

  const oldParentId = report.duplicateOf;
  report.duplicateOf = null;
  report.duplicateConfidence = null;
  report.duplicateReason = null;

  if (oldParentId) {
    const parent = reports.find((r) => r.id === oldParentId);
    if (parent) {
      parent.linkedCount = Math.max(0, (parent.linkedCount || 1) - 1);
      const { score: newScore } = calculatePriorityScore(parent.factors, parent.linkedCount);
      parent.priorityScore = newScore;
      parent.priorityBand = determinePriorityBand(newScore, parent.factors.safetyRisk.score);
    }
  }

  saveReportsToDisk();
  broadcastSSE('report_unlinked', { reportId: report.id });
  res.json({ success: true, report });
});

app.post('/api/reports/:id/confirm-duplicate', requireAuthority, (req: Request, res: Response) => {
  const { id } = req.params;
  const { parentId } = req.body;

  const report = reports.find((r) => r.id === id);
  const parent = reports.find((r) => r.id === parentId);

  if (!report || !parent) {
    res.status(404).json({ error: 'Report or parent not found' });
    return;
  }

  report.duplicateOf = parent.id;
  report.duplicateConfidence = 1.0;
  report.duplicateReason = 'Confirmed manually by authority triage officer.';

  parent.linkedCount = (parent.linkedCount || 0) + 1;
  const { score: newScore } = calculatePriorityScore(parent.factors, parent.linkedCount);
  parent.priorityScore = newScore;
  parent.priorityBand = determinePriorityBand(newScore, parent.factors.safetyRisk.score);

  saveReportsToDisk();
  broadcastSSE('duplicate_confirmed', { reportId: report.id, parentId: parent.id });
  res.json({ success: true, report, parent });
});

// 11. GET /api/hotspots
app.get('/api/hotspots', requireAuthority, (req: Request, res: Response) => {
  const hotspots = detectHotspots(reports);
  // Attach cached briefs if available
  hotspots.forEach((hs) => {
    const cached = hotspotBriefCache.get(hs.id);
    if (cached) {
      hs.brief = cached.brief;
      hs.briefCachedAt = new Date(cached.timestamp).toISOString();
    }
  });
  res.json(hotspots);
});

// 12. POST /api/hotspots/brief (Action brief with Gemini)
app.post('/api/hotspots/brief', requireAuthority, async (req: Request, res: Response) => {
  const { hotspotId } = req.body;
  if (!hotspotId) {
    res.status(400).json({ error: 'hotspotId is required' });
    return;
  }

  const cached = hotspotBriefCache.get(hotspotId);
  if (cached) {
    res.json({ brief: cached.brief, cached: true });
    return;
  }

  const hotspots = detectHotspots(reports);
  const hs = hotspots.find((h) => h.id === hotspotId);
  if (!hs) {
    res.status(404).json({ error: 'Hotspot not found' });
    return;
  }

  if (!aiClient) {
    const fallbackBrief = `Likely infrastructure bottleneck: ${hs.reports.length} related issues around (${hs.center.lat.toFixed(3)}, ${hs.center.lon.toFixed(3)}). Fix highest priority issues (${hs.reports.slice(0, 2).map((r) => r.trackingCode).join(', ')}) first to mitigate immediate safety hazards.`;
    hotspotBriefCache.set(hotspotId, { brief: fallbackBrief, timestamp: Date.now() });
    res.json({ brief: fallbackBrief, cached: false });
    return;
  }

  try {
    const reportFacts = hs.reports.map((r) => ({
      code: r.trackingCode,
      category: r.category,
      summary: r.summary_en,
      priority: r.priorityBand,
    }));

    const prompt = `You are an urban incident commander for VoxSetu.
Here are the computed cluster facts for a civic hotspot:
- Hotspot ID: ${hs.id}
- Center: ${hs.center.lat.toFixed(4)}, ${hs.center.lon.toFixed(4)} (Radius: ${hs.radiusMeters}m)
- Total reports: ${hs.totalReportsCount} (Trend: ${hs.trend})
- Categories: ${JSON.stringify(hs.categoryCounts)}
- Reports:
${JSON.stringify(reportFacts, null, 2)}

Provide an action brief for city authorities in UNDER 60 WORDS:
- What is happening?
- What to fix first?
- Why?
Rules:
- Phrase root causes as "likely" (e.g. "likely culvert blockage").
- Cite specific report tracking codes (e.g. VS-HOT-02).
- Keep strictly under 60 words.`;

    const brief = await retry(async () => {
      const resp = await callWithTimeout(
        aiClient!.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        })
      );
      return (resp.text || '').trim();
    }, 2);

    hotspotBriefCache.set(hotspotId, { brief, timestamp: Date.now() });
    res.json({ brief, cached: false });
  } catch (err: any) {
    console.warn('[Gemini AI] Hotspot brief generation failed after retries:', err);
    
    // Improved deterministic fallback
    const topCategories = Object.entries(hs.categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([cat]) => cat.toLowerCase());
    const dominant = topCategories[0] || 'infrastructure';
    const urgentCodes = hs.reports
      .filter(r => r.priorityBand === 'critical' || r.priorityBand === 'high')
      .slice(0, 2)
      .map(r => r.trackingCode);
      
    const fallbackBrief = `Cluster of ${hs.totalReportsCount} ${dominant} reports detected. ${
      urgentCodes.length > 0 ? `Priority inspection required for ${urgentCodes.join(', ')}. ` : ''
    }Likely localized infrastructure failure. Dispatch field team to coordinate (${hs.center.lat.toFixed(3)}, ${hs.center.lon.toFixed(3)}).`;
    
    // Cache the fallback briefly (5 minutes) so we don't hammer the AI if it's down
    hotspotBriefCache.set(hotspotId, { brief: fallbackBrief, timestamp: Date.now() });
    res.json({ brief: fallbackBrief, cached: false, isFallback: true });
  }
});

// 13. POST /api/translate (Server-side translation with cache)
app.post('/api/translate', async (req: Request, res: Response) => {
  const { text, lang } = req.body;
  if (!text || !lang) {
    res.status(400).json({ error: 'text and lang are required' });
    return;
  }

  const cacheKey = `${text.trim()}___${lang}`;
  if (translationCache.has(cacheKey)) {
    res.json({ translatedText: translationCache.get(cacheKey)!, cached: true });
    return;
  }

  if (lang === 'en' || !aiClient) {
    res.json({ translatedText: text, cached: false });
    return;
  }

  try {
    const langNames: Record<string, string> = {
      hi: 'Hindi',
      kn: 'Kannada',
      te: 'Telugu',
      en: 'English',
    };
    const targetName = langNames[lang] || lang;

    const prompt = `Translate this civic municipal update text into natural, polite ${targetName}:
"${text}"
Output only the translated text, no quotes or preamble.`;

    const resp = await callWithTimeout(
      aiClient.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      })
    );

    const translatedText = (resp.text || '').trim().replace(/^["']|["']$/g, '');
    translationCache.set(cacheKey, translatedText);
    res.json({ translatedText, cached: false });
  } catch (err) {
    console.warn('[Gemini AI] Translation failed:', err);
    res.json({ translatedText: text, fallback: true });
  }
});

// 15. POST /api/transcribe (Multimodal audio transcription with Gemini)
app.post('/api/transcribe', async (req: Request, res: Response) => {
  try {
    const { audioDataUrl, lang } = req.body;
    if (!audioDataUrl || !audioDataUrl.startsWith('data:audio/')) {
      res.status(400).json({ error: 'Valid audio data URL is required' });
      return;
    }

    if (!aiClient) {
      res.status(500).json({ error: 'AI client not initialized' });
      return;
    }

    const [header, base64Data] = audioDataUrl.split(',');
    const mimeMatch = header.match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'audio/webm';

    const prompt = `Listen to this recorded audio message reporting a civic infrastructure issue (in English, Hindi, Kannada, or Telugu). Accurately transcribe and translate/transcribe the spoken words into clear written text describing the municipal issue. Output ONLY the transcribed text without quotes or preamble.`;

    const contents = [
      {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      },
      { text: prompt },
    ];

    const resp = await callWithTimeout(
      aiClient.models.generateContent({
        model: GEMINI_MODEL,
        contents: contents as any,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      })
    );

    const transcript = (resp.text || '').trim().replace(/^["']|["']$/g, '');
    res.json({ transcript });
  } catch (err: any) {
    console.error('[POST /api/transcribe] Error:', err);
    res.status(500).json({ error: 'Audio transcription failed: ' + (err.message || 'Server error') });
  }
});

// 14. POST /api/reset-demo (Reseed demo data)
app.post('/api/reset-demo', requireAuthority, (req: Request, res: Response) => {
  reports = generateSampleReports();
  hotspotBriefCache.clear();
  saveReportsToDisk();

  broadcastSSE('demo_reset', { count: reports.length });
  res.json({ success: true, count: reports.length });
});

// ----------------------------------------------------
// Frontend Mounting (Vite in dev, static dist in prod)
// ----------------------------------------------------
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const server = http.createServer(app);

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Handle WebSocket upgrades for Vite HMR
    server.on('upgrade', (req, socket, head) => {
      // Route HMR traffic to Vite. We check for /@vite/hmr which is configured in vite.config.ts
      if (req.url && (req.url.includes('/@vite/hmr') || req.url.startsWith('/@vite'))) {
        vite.ws.handleUpgrade(req, socket, head);
      }
    });
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[VoxSetu Server] Running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[VoxSetu Server] Fatal startup error:', err);
  process.exit(1);
});
