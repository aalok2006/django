import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import {
  generateProjectsCsv,
  InfrastructureProject,
  PredictionFeatures,
  predictProjectDelay,
  SystemAlert,
} from './src/utils/predictionEngine';
import { INITIAL_ALERTS, INITIAL_PROJECTS } from './src/data/seedProjects';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const CURRENT_SCHEMA_VERSION = 3;

export interface GroundingPlaceLink {
  title: string;
  uri: string;
  sourceType: 'maps' | 'web';
  reviewSnippets?: string[];
}

interface DatabaseSchema {
  schemaVersion: number;
  projects: InfrastructureProject[];
  alerts: SystemAlert[];
  updatedAt: string;
}

function loadDatabase(): DatabaseSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as DatabaseSchema;
      if (
        parsed.schemaVersion === CURRENT_SCHEMA_VERSION &&
        Array.isArray(parsed.projects) &&
        parsed.projects.length > 0
      ) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to read database file, initializing fresh seed:', err);
  }

  const initial: DatabaseSchema = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    projects: structuredClone(INITIAL_PROJECTS),
    alerts: structuredClone(INITIAL_ALERTS),
    updatedAt: new Date().toISOString(),
  };
  saveDatabase(initial);
  return initial;
}

function saveDatabase(db: DatabaseSchema): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    db.schemaVersion = CURRENT_SCHEMA_VERSION;
    db.updatedAt = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist database:', err);
  }
}

/**
 * Extracts Google Maps and Web grounding links + review snippets from GenerateContentResponse
 * as required by the gemini-api skill (groundingChunks.maps.uri & placeAnswerSources.reviewSnippets).
 */
function extractGroundingLinks(response: unknown): GroundingPlaceLink[] {
  const links: GroundingPlaceLink[] = [];
  const seenUris = new Set<string>();

  const candidate = (
    response as {
      candidates?: Array<{
        groundingMetadata?: {
          groundingChunks?: Array<{
            maps?: {
              uri?: string;
              title?: string;
              placeAnswerSources?: {
                reviewSnippets?: Array<{ content?: string; text?: string } | string>;
              };
            };
            web?: {
              uri?: string;
              title?: string;
            };
          }>;
        };
      }>;
    }
  )?.candidates?.[0];

  const chunks = candidate?.groundingMetadata?.groundingChunks;
  if (!Array.isArray(chunks)) return links;

  for (const chunk of chunks) {
    if (chunk.maps?.uri && !seenUris.has(chunk.maps.uri)) {
      seenUris.add(chunk.maps.uri);
      const rawSnippets = chunk.maps.placeAnswerSources?.reviewSnippets;
      const snippets: string[] = [];
      if (Array.isArray(rawSnippets)) {
        for (const item of rawSnippets) {
          if (typeof item === 'string' && item.trim()) {
            snippets.push(item.trim());
          } else if (item && typeof item === 'object') {
            const txt = item.content || item.text;
            if (txt && txt.trim()) snippets.push(txt.trim());
          }
        }
      }
      links.push({
        title: chunk.maps.title || 'Google Maps Place Reference',
        uri: chunk.maps.uri,
        sourceType: 'maps',
        reviewSnippets: snippets.length > 0 ? snippets : undefined,
      });
    } else if (chunk.web?.uri && !seenUris.has(chunk.web.uri)) {
      seenUris.add(chunk.web.uri);
      links.push({
        title: chunk.web.title || chunk.web.uri,
        uri: chunk.web.uri,
        sourceType: 'web',
      });
    }
  }

  return links;
}

/**
 * Builds real-world Google Maps references for an infrastructure corridor when offline or fallback.
 */
function buildRealWorldMapsFallback(
  project: InfrastructureProject | undefined,
  latitude: number,
  longitude: number
): { summary: string; groundingLinks: GroundingPlaceLink[] } {
  const target = project || INITIAL_PROJECTS[0];
  const latStr = latitude.toFixed(4);
  const lngStr = longitude.toFixed(4);

  const summary = [
    `### Real-World Corridor & Administrative Grounding: ${target.code}`,
    `- **Corridor Alignment:** ${target.name} (${target.sector})`,
    `- **Implementing Authority:** ${target.implementingAgency}`,
    `- **Jurisdiction & Revenue District:** ${target.district}, ${target.stateRegion} (\`${latStr}° N, ${lngStr}° E\`)`,
    `- **Right-of-Way Status:** ${target.acquiredAreaHectares} Ha possessed out of ${target.totalAreaHectares} Ha notified (${target.acquisitionProgressPct}% complete; ₹${target.budgetCroresINR.toLocaleString()} Cr outlay).`,
    `- **Field Verification:** Cadastral parcels (${target.parcels.map((p) => `${p.village} [${p.surveyNumber}]`).join(', ')}) fall under the Competent Authority for Land Acquisition (CALA / Special Land Acquisition Officer) in ${target.district}.`,
  ].join('\n');

  const groundingLinks: GroundingPlaceLink[] = [
    {
      title: `${target.name} — Corridor Alignment (${latStr}°N, ${lngStr}°E)`,
      uri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${target.name} ${target.district} ${target.stateRegion}`)}`,
      sourceType: 'maps',
    },
    {
      title: `District Collectorate & CALA Land Acquisition Office — ${target.district}`,
      uri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`District Collector Office ${target.district} ${target.stateRegion}`)}`,
      sourceType: 'maps',
    },
    {
      title: ` Exact Geodetic Pin (${latStr}, ${lngStr}) on Google Maps`,
      uri: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
      sourceType: 'maps',
    },
  ];

  return { summary, groundingLinks };
}

function buildDomainGroundedFallbackReply(
  userMessage: string,
  projects: InfrastructureProject[],
  alerts: SystemAlert[]
): { reply: string; groundingLinks: GroundingPlaceLink[] } {
  const q = userMessage.toLowerCase();
  const sortedByRisk = [...projects].sort(
    (a, b) => b.prediction.delayProbabilityPct - a.prediction.delayProbabilityPct
  );
  const topRisk = sortedByRisk[0];
  const lowestRisk = sortedByRisk[sortedByRisk.length - 1];

  const matchedProject = projects.find(
    (p) =>
      q.includes(p.code.toLowerCase()) ||
      q.includes(p.district.toLowerCase().split(' ')[0]) ||
      q.includes(p.name.toLowerCase().split(' ')[0])
  );

  if (matchedProject) {
    const topFactor = matchedProject.prediction.majorRiskFactors[0];
    const topAction = matchedProject.prediction.preventiveActions[0];
    const fb = buildRealWorldMapsFallback(
      matchedProject,
      matchedProject.coordinates.lat,
      matchedProject.coordinates.lng
    );
    return {
      reply: [
        `### Real-World Corridor Assessment: ${matchedProject.code} (${matchedProject.name})`,
        `- **Implementing Agency:** ${matchedProject.implementingAgency} (${matchedProject.district}, ${matchedProject.stateRegion})`,
        `- **Geodetic Coordinates:** \`${matchedProject.coordinates.lat.toFixed(4)}° N, ${matchedProject.coordinates.lng.toFixed(4)}° E\``,
        `- **Current Delay Probability:** ${matchedProject.prediction.delayProbabilityPct}% (${matchedProject.prediction.riskTier} Risk · Est. +${matchedProject.prediction.predictedDelayDays} days slippage)`,
        `- **Land Possession:** ${matchedProject.acquiredAreaHectares} / ${matchedProject.totalAreaHectares} Ha (${matchedProject.acquisitionProgressPct}%)`,
        `- **Cadastral & Financial Status:** ${matchedProject.features.ownershipVerifiedPct}% ownership verified · ${matchedProject.features.compensationDisbursedPct}% compensation disbursed · ${matchedProject.features.activeLegalDisputesCount} active legal disputes`,
        `- **Primary Bottleneck:** ${topFactor ? `${topFactor.factorName} (${topFactor.explanation})` : 'Schedule variance'}`,
        `- **Recommended Action:** ${topAction ? `${topAction.actionTitle} (Target: ${topAction.targetDepartment}, Est. recovery: −${topAction.expectedDelayReductionDays} days)` : 'Maintain bi-weekly joint survey audit.'}`,
      ].join('\n'),
      groundingLinks: fb.groundingLinks,
    };
  }

  if (q.includes('highest') || q.includes('critical') || q.includes('risk') || q.includes('delay')) {
    const fb = buildRealWorldMapsFallback(
      topRisk,
      topRisk.coordinates.lat,
      topRisk.coordinates.lng
    );
    return {
      reply: [
        `### National Portfolio Delay Risk Summary (${projects.length} Active Corridors)`,
        `1. **Highest Risk Corridor:** **${topRisk.code}** (${topRisk.name}) at **${topRisk.prediction.delayProbabilityPct}% (${topRisk.prediction.riskTier})** with an estimated **+${topRisk.prediction.predictedDelayDays} days** schedule slippage, driven by ${topRisk.features.activeLegalDisputesCount} active court/title disputes and ${100 - topRisk.features.compensationDisbursedPct}% unpaid compensation backlog.`,
        `2. **Secondary Watchlist:** ${sortedByRisk
          .slice(1, 3)
          .map((p) => `**${p.code}** (${p.prediction.delayProbabilityPct}% ${p.prediction.riskTier})`)
          .join(', ')}.`,
        `3. **Best Performing Corridor:** **${lowestRisk.code}** at **${lowestRisk.prediction.delayProbabilityPct}% (${lowestRisk.prediction.riskTier})** with ${lowestRisk.features.ownershipVerifiedPct}% ownership verified.`,
        `\n**Priority Directive:** Convene Special Land Acquisition Lok Adalats for ${topRisk.code} and deposit disputed awards into LARR Authority escrow to vacate interim stay orders.`,
      ].join('\n'),
      groundingLinks: fb.groundingLinks,
    };
  }

  const activeAlerts = alerts.filter((a) => a.status === 'Active');
  const fb = buildRealWorldMapsFallback(
    topRisk,
    topRisk.coordinates.lat,
    topRisk.coordinates.lng
  );
  return {
    reply: [
      `### TerraPulse Policy & Real-World Corridor Intelligence Brief`,
      `- **Monitored Portfolio:** ${projects.length} flagship national corridors (${projects.reduce((s, p) => s + p.totalAreaHectares, 0).toLocaleString()} Ha total, ${projects.reduce((s, p) => s + p.acquiredAreaHectares, 0).toLocaleString()} Ha acquired).`,
      `- **Active Statutory Alerts:** ${activeAlerts.length} unacknowledged alerts across high-risk corridors.`,
      `- **Highest Priority Corridor:** **${topRisk.code}** (${topRisk.prediction.delayProbabilityPct}% delay probability · +${topRisk.prediction.predictedDelayDays}d slippage).`,
      `\nAsk me about any real-world corridor (\`WDFC-JNPT-02\`, \`MAHSR-C3-01\`, \`DME-NH148N\`, \`AURIC-DMIC-02\`, \`JEWAR-NIAL-P2\`, \`MMLP-BLR-01\`, \`PGCIL-BKN-765\`), nearby District Collectorate / CALA offices via Google Maps Grounding, or geotechnical verification standards.`,
    ].join('\n'),
    groundingLinks: fb.groundingLinks,
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));

  const db = loadDatabase();

  // 1. Health & Backend Status
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      engine: 'Express + Scikit-Learn Calibrated Ensemble + Gemini 3.8 Flash (Google Maps Grounding)',
      projectCount: db.projects.length,
      activeAlertCount: db.alerts.filter((a) => a.status === 'Active').length,
      updatedAt: db.updatedAt,
    });
  });

  // 2. Get Full Application State
  app.get('/api/state', (_req, res) => {
    res.json({
      projects: db.projects,
      alerts: db.alerts,
      updatedAt: db.updatedAt,
    });
  });

  // 3. Create New Infrastructure Project
  app.post('/api/projects', (req, res) => {
    try {
      const incoming = req.body as InfrastructureProject;
      if (!incoming || !incoming.code || !incoming.name) {
        res.status(400).json({ error: 'Project code and name are required.' });
        return;
      }

      const prediction = predictProjectDelay(incoming.features);
      const acquisitionProgressPct = Math.round(
        (incoming.acquiredAreaHectares / Math.max(1, incoming.totalAreaHectares)) * 100
      );

      const created: InfrastructureProject = {
        ...incoming,
        acquisitionProgressPct,
        prediction,
        lastUpdated: new Date().toISOString().slice(0, 10),
      };

      db.projects = [created, ...db.projects];

      if (prediction.riskTier === 'Critical' || prediction.riskTier === 'High') {
        const newAlert: SystemAlert = {
          id: `ALT-${Math.floor(910 + Math.random() * 89)}`,
          projectId: created.id,
          projectCode: created.code,
          projectName: created.name,
          category: 'High-Risk Delay',
          severity: prediction.riskTier === 'Critical' ? 'Critical' : 'High',
          title: `New ${prediction.riskTier} Risk Project Flagged (${prediction.delayProbabilityPct}% Delay Prob.)`,
          description: `Initial Scikit-learn assessment estimates +${prediction.predictedDelayDays} days slippage across ${created.features.totalParcels} parcels.`,
          createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
          status: 'Active',
        };
        db.alerts = [newAlert, ...db.alerts];
      }

      saveDatabase(db);
      res.status(201).json({
        project: created,
        projects: db.projects,
        alerts: db.alerts,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 4. Update Project (Parcels, Milestones, or ML Features)
  app.put('/api/projects/:id', (req, res) => {
    const { id } = req.params;
    const updatedIncoming = req.body as InfrastructureProject;
    const idx = db.projects.findIndex((p) => p.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    const prediction = predictProjectDelay(updatedIncoming.features);
    const acquisitionProgressPct = Math.round(
      (updatedIncoming.acquiredAreaHectares /
        Math.max(1, updatedIncoming.totalAreaHectares)) *
        100
    );

    const savedProject: InfrastructureProject = {
      ...updatedIncoming,
      acquisitionProgressPct,
      prediction,
      lastUpdated: new Date().toISOString().slice(0, 10),
    };

    db.projects[idx] = savedProject;
    saveDatabase(db);

    res.json({
      project: savedProject,
      projects: db.projects,
    });
  });

  // 5. Delete Project
  app.delete('/api/projects/:id', (req, res) => {
    const { id } = req.params;
    db.projects = db.projects.filter((p) => p.id !== id);
    db.alerts = db.alerts.filter((a) => a.projectId !== id);
    saveDatabase(db);
    res.json({ projects: db.projects, alerts: db.alerts });
  });

  // 6. On-Demand ML Delay Prediction Endpoint
  app.post('/api/predict', (req, res) => {
    const features = req.body as PredictionFeatures;
    if (!features || typeof features.ownershipVerifiedPct !== 'number') {
      res.status(400).json({ error: 'Valid PredictionFeatures payload required.' });
      return;
    }
    const result = predictProjectDelay(features);
    res.json(result);
  });

  // 7. Update Alert Status
  app.patch('/api/alerts/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body as { status: SystemAlert['status'] };
    const alert = db.alerts.find((a) => a.id === id);
    if (!alert) {
      res.status(404).json({ error: 'Alert not found.' });
      return;
    }
    alert.status = status;
    saveDatabase(db);
    res.json({ alert, alerts: db.alerts });
  });

  // 8. Reset Database to Initial Real-World Seed
  app.post('/api/reset', (_req, res) => {
    db.projects = structuredClone(INITIAL_PROJECTS);
    db.alerts = structuredClone(INITIAL_ALERTS);
    saveDatabase(db);
    res.json({ projects: db.projects, alerts: db.alerts });
  });

  // 9. Backend CSV Report Stream
  app.get('/api/reports/csv', (_req, res) => {
    const csv = generateProjectsCsv(db.projects);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="land_acquisition_delay_report_${new Date().toISOString().slice(0, 10)}.csv"`
    );
    res.send(csv);
  });

  // 10. Dedicated Google Maps Grounding Endpoint (/api/maps-grounding) using gemini-3.8-flash + googleMaps tool
  app.post('/api/maps-grounding', async (req, res) => {
    const {
      projectId,
      query,
      latitude,
      longitude,
    } = req.body as {
      projectId?: string;
      query?: string;
      latitude?: number;
      longitude?: number;
    };

    const project =
      db.projects.find((p) => p.id === projectId) || db.projects[0];
    const lat =
      typeof latitude === 'number' && !Number.isNaN(latitude)
        ? latitude
        : project?.coordinates.lat ?? 19.3919;
    const lng =
      typeof longitude === 'number' && !Number.isNaN(longitude)
        ? longitude
        : project?.coordinates.lng ?? 73.0169;

    const promptText =
      query && query.trim()
        ? query.trim()
        : `Provide real-world geographical, transport connectivity, and nearby District Collectorate / Land Acquisition / Revenue Office details around ${project.name} in ${project.district}, ${project.stateRegion} (near coordinates ${lat.toFixed(4)}, ${lng.toFixed(4)}). Mention key highways, railway junctions, industrial hubs, and administrative landmarks nearby.`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
      const fb = buildRealWorldMapsFallback(project, lat, lng);
      res.json({
        summary: fb.summary,
        groundingLinks: fb.groundingLinks,
        coordinates: { latitude: lat, longitude: lng },
        source: 'real-world-corridor-index',
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      // Use gemini-3.8-flash with googleMaps tool and latLng retrievalConfig.
      // Note: Do NOT set responseMimeType or responseSchema when using googleMaps.
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: promptText,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: {
                latitude: lat,
                longitude: lng,
              },
            },
          },
        },
      });

      const extractedLinks = extractGroundingLinks(response);
      const fb = buildRealWorldMapsFallback(project, lat, lng);

      res.json({
        summary: response.text || fb.summary,
        groundingLinks:
          extractedLinks.length > 0 ? extractedLinks : fb.groundingLinks,
        coordinates: { latitude: lat, longitude: lng },
        source: 'gemini-3.8-flash-google-maps',
      });
    } catch (err) {
      const fb = buildRealWorldMapsFallback(project, lat, lng);
      res.json({
        summary: fb.summary,
        groundingLinks: fb.groundingLinks,
        coordinates: { latitude: lat, longitude: lng },
        source: 'real-world-corridor-index',
        warning: (err as Error).message,
      });
    }
  });

  // 11. Server-Side Gemini AI Chatbot Endpoint (/api/chat) with Google Maps & Search Grounding
  app.post('/api/chat', async (req, res) => {
    const {
      message,
      history = [],
      groundingMode = 'maps',
      latitude,
      longitude,
    } = req.body as {
      message?: string;
      history?: { role: 'user' | 'model'; text: string }[];
      groundingMode?: 'maps' | 'search' | 'portfolio';
      latitude?: number;
      longitude?: number;
    };

    if (!message || !message.trim()) {
      res.status(400).json({ error: 'Message text is required.' });
      return;
    }

    const portfolioContext = db.projects
      .map(
        (p) =>
          `- ${p.code} (${p.name}, ${p.sector}, ${p.district}, ${p.stateRegion} @ ${p.coordinates.lat.toFixed(4)}°N, ${p.coordinates.lng.toFixed(4)}°E): Agency: ${p.implementingAgency} | Acquired ${p.acquiredAreaHectares}/${p.totalAreaHectares} Ha (${p.acquisitionProgressPct}%) | Ownership Verified ${p.features.ownershipVerifiedPct}% | Compensation Paid ${p.features.compensationDisbursedPct}% | Legal Disputes: ${p.features.activeLegalDisputesCount} | Pending Clearances: ${p.features.pendingClearancesCount} -> ML Delay Prob: ${p.prediction.delayProbabilityPct}% (${p.prediction.riskTier} Risk, Est. +${p.prediction.predictedDelayDays} days)`
      )
      .join('\n');

    const systemInstruction = [
      'You are the TerraPulse Infrastructure Land Acquisition & Geotechnical Policy Advisor for government nodal officers (CALA, NHAI, DFCCIL, NHSRCL, NICDC, YEIDA, PGCIL).',
      'Provide concise, authoritative, data-backed answers grounded in real-world Indian infrastructure corridors and the live monitored portfolio below.',
      'When discussing soil or computer vision observations, remind officers that 2D optical photographs provide preliminary surface indicators only and require ASTM/IS laboratory soil testing and borehole surveys.',
      'Format responses cleanly with short bullet points and exact numbers.',
      '',
      'LIVE MONITORED REAL-WORLD CORRIDOR PORTFOLIO:',
      portfolioContext,
    ].join('\n');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
      const fb = buildDomainGroundedFallbackReply(
        message,
        db.projects,
        db.alerts
      );
      res.json({
        reply: fb.reply,
        groundingLinks: fb.groundingLinks,
        source: 'portfolio-intelligence-engine',
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const conversationTranscript = [
        ...history.slice(-6).map((h) => `${h.role === 'user' ? 'Officer' : 'Advisor'}: ${h.text}`),
        `Officer: ${message.trim()}`,
      ].join('\n\n');

      // Note from gemini-api skill: googleMaps cannot be used together with googleSearch in the same request.
      const useMapsTool = groundingMode === 'maps';
      const useSearchTool = groundingMode === 'search';

      const lat =
        typeof latitude === 'number' && !Number.isNaN(latitude)
          ? latitude
          : db.projects[0]?.coordinates.lat ?? 19.3919;
      const lng =
        typeof longitude === 'number' && !Number.isNaN(longitude)
          ? longitude
          : db.projects[0]?.coordinates.lng ?? 73.0169;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: conversationTranscript,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          ...(useMapsTool
            ? {
                tools: [{ googleMaps: {} }],
                toolConfig: {
                  retrievalConfig: {
                    latLng: { latitude: lat, longitude: lng },
                  },
                },
              }
            : useSearchTool
            ? {
                tools: [{ googleSearch: {} }],
              }
            : {}),
        },
      });

      const extractedLinks = extractGroundingLinks(response);
      const fb = buildDomainGroundedFallbackReply(
        message,
        db.projects,
        db.alerts
      );

      res.json({
        reply: response.text || fb.reply,
        groundingLinks:
          extractedLinks.length > 0 ? extractedLinks : fb.groundingLinks,
        source: 'gemini-3.8-flash',
      });
    } catch (err) {
      const errMsg = (err as Error).message || 'Gemini API error';
      const fb = buildDomainGroundedFallbackReply(
        message,
        db.projects,
        db.alerts
      );
      res.json({
        reply: fb.reply,
        groundingLinks: fb.groundingLinks,
        source: 'portfolio-intelligence-engine',
        warning:
          errMsg.includes('API_KEY') || errMsg.includes('403') || errMsg.includes('400')
            ? 'Note: Check your Gemini API key in Settings > Secrets for live LLM generation. Showing deterministic portfolio analysis.'
            : undefined,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TerraPulse full-stack server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
