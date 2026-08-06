// ArchinthAI AI Architect Engine.
//
// Pluggable LLM integration (OpenAI / Anthropic / Gemini) that does the
// "intelligence" layer of architectural work:
//   1. Natural-language brief -> structured room program
//   2. Design rationale generation (why this design suits the brief)
//   3. Architect critique (review + improvement suggestions)
//
// Works fully offline with a deterministic rule-based fallback when no
// API key is configured, so the app always functions.

(function (global) {
  "use strict";

  const PROVIDERS = {
    openai: {
      name: "OpenAI",
      url: (key) => "https://api.openai.com/v1/chat/completions",
      headers: (key) => ({
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      }),
      body: (messages, model) => ({ model: model || "gpt-4o-mini", messages }),
      extract: (data) => data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content,
    },
    anthropic: {
      name: "Anthropic",
      url: () => "https://api.anthropic.com/v1/messages",
      headers: (key) => ({
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      }),
      body: (messages, model) => ({ model: model || "claude-3-5-sonnet-latest", max_tokens: 1024, messages }),
      extract: (data) => data.content && data.content[0] && data.content[0].text,
    },
    gemini: {
      name: "Google Gemini",
      url: (key) => `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
      headers: () => ({ "Content-Type": "application/json" }),
      body: (messages, model) => {
        const text = messages.map((m) => `${m.role}: ${m.content}`).join("\n\n");
        return { contents: [{ parts: [{ text }] }] };
      },
      extract: (data) => data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.map((p) => p.text).join(""),
    },
  };

  const DEFAULT_CONFIG = {
    provider: "openai",
    model: "",
    apiKey: "",
    temperature: 0.7,
  };

  function getConfig() {
    const runtime = (typeof window !== "undefined") ? window.ARCHINTHAI_AI : null;
    const stored = {};
    try {
      const raw = (typeof localStorage !== "undefined") ? localStorage.getItem("archinthai-ai-config") : null;
      if (raw) Object.assign(stored, JSON.parse(raw));
    } catch (e) { /* ignore */ }
    return Object.assign({}, DEFAULT_CONFIG, runtime || {}, stored || {});
  }

  function configured() {
    const cfg = getConfig();
    return !!(cfg.apiKey && cfg.provider && PROVIDERS[cfg.provider]);
  }

  async function chat(messages) {
    const cfg = getConfig();
    if (!cfg.apiKey || !PROVIDERS[cfg.provider]) {
      throw new Error("AI not configured. Add an API key in Settings.");
    }
    const provider = PROVIDERS[cfg.provider];
    const res = await fetch(provider.url(cfg.apiKey), {
      method: "POST",
      headers: provider.headers(cfg.apiKey),
      body: JSON.stringify(provider.body(messages, cfg.model)),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AI request failed (${res.status}): ${text.slice(0, 300)}`);
    }
    const data = await res.json();
    const text = provider.extract(data);
    if (!text) throw new Error("AI returned an empty response.");
    return text.trim();
  }

  async function generateText(prompt, system) {
    const messages = [];
    if (system) messages.push({ role: "system", content: system });
    messages.push({ role: "user", content: prompt });
    return chat(messages);
  }

  // ------------------------------------------------------------------
  // 1. Natural-language brief -> structured room program
  // ------------------------------------------------------------------
  const ROOM_OPTIONS = [
    "Living Room","Dining Room","Kitchen","Bedroom","Master Bedroom","Bathroom",
    "Attached Bathroom","Study","Office","Parking","Gym","Storage","Balcony",
    "Stair","Terrace Garden","Guest Room","Family Lounge","Home Theater",
    "Pooja Room","Utility","Laundry","Walk-in Closet","Dressing","Lobby","Corridor",
  ];

  function parseRoomProgram(text) {
    const lower = text.toLowerCase();
    const program = [];

    // Detect level keywords
    const hasBasement = /basement|cellar|parking below|lower level/i.test(lower);
    const hasRoof = /roof|terrace|penthouse|roof garden/i.test(lower);
    const floorMatch = lower.match(/(\d+)[ -]*(floor|storey|story|level)/i);
    const floorCount = floorMatch ? Math.min(8, Math.max(1, parseInt(floorMatch[1], 10))) : (hasBasement ? 2 : 1);

    // Detect rooms mentioned
    ROOM_OPTIONS.forEach((room) => {
      const key = room.toLowerCase();
      const re = new RegExp(`\\b(${key.replace(/ /g, "[ -]?")})\\b`, "i");
      if (re.test(lower)) {
        // Count via "N room" or "room x N"
        const countMatch = lower.match(new RegExp(`(\\d+)\\s+(?:x\\s*)?${key.replace(/ /g, "[ -]?")}`, "i"));
        const count = countMatch ? Math.min(6, parseInt(countMatch[1], 10)) : 1;
        program.push({ room_type: room, count, preferred_zone: guessZone(room) });
      }
    });

    // Always ensure a stair if multiple floors
    if (floorCount > 1 && !program.some((r) => /stair/i.test(r.room_type))) {
      program.push({ room_type: "Stair", count: 1, preferred_zone: "middle" });
    }

    return { program, floorCount, hasBasement, hasRoof, rawText: text };
  }

  function guessZone(room) {
    const r = room.toLowerCase();
    if (/(living|family|lobby|foyer|verandah|entry|parking)/.test(r)) return "front";
    if (/(kitchen|utility|laundry|storage|terrace|dining)/.test(r)) return "rear";
    return "middle";
  }

  // LLM-backed parsing when configured, else rule-based.
  async function understandBrief(text) {
    if (!configured()) return parseRoomProgram(text);
    const system = "You are ArchinthAI, an expert architectural brief analyst. " +
      "Parse the client's brief into a JSON room program. Respond ONLY with valid JSON: " +
      '{"program":[{"room_type":"...","count":N,"preferred_zone":"front|middle|rear"}],"floorCount":N,"hasBasement":bool,"hasRoof":bool,"summary":"one-line brief summary"}';
    try {
      const raw = await generateText(text, system);
      const json = JSON.parse(extractJson(raw));
      if (json && Array.isArray(json.program) && json.program.length) {
        return Object.assign({ rawText: text }, json);
      }
      throw new Error("Invalid program JSON");
    } catch (e) {
      console.warn("LLM brief parse failed, using rule-based.", e);
      return parseRoomProgram(text);
    }
  }

  // ------------------------------------------------------------------
  // 2. Design rationale
  // ------------------------------------------------------------------
  function localRationale(design) {
    const cfg = design.config || {};
    const meta = design.metadata || {};
    const levels = design.levels || [];
    const rooms = levels.reduce((a, l) => a + (l.rooms || []).length, 0);
    const sea = (meta.selected_strategy || "balanced").replace(/-/g, " ");
    return [
      `This ${cfg.style} residence is planned across ${levels.length} level(s) using a ${sea} strategy.`,
      `The program distributes ${rooms} room(s) to balance public zones (front) with private and service zones (rear).`,
      `Circulation is anchored around a central stair core, keeping floor plates efficient and egress simple.`,
      `Windows are placed on external facades to maximize daylight and cross-ventilation (score ${(meta.score || 0).toFixed(1)}).`,
    ].join(" ");
  }

  async function designRationale(design) {
    if (!configured()) return localRationale(design);
    const summary = summarizeDesign(design);
    const system = "You are ArchinthAI, a senior residential architect. " +
      "Explain the design rationale behind a generated plan in 3-4 concise, professional sentences. " +
      "Mention zoning, circulation, daylight, and the strategy.";
    try {
      return await generateText(`Design summary:\n${summary}`, system);
    } catch (e) {
      return localRationale(design);
    }
  }

  // ------------------------------------------------------------------
  // 3. Architect critique
  // ------------------------------------------------------------------
  function localCritique(design) {
    const issues = [];
    const cfg = design.config || {};
    const levels = design.levels || [];
    const rooms = levels.reduce((a, l) => a.concat(l.rooms || []), []);

    // bathroom ratio
    const bdr = rooms.filter((r) => /bedroom/i.test(r.room_type)).length;
    const bath = rooms.filter((r) => /bath/i.test(r.room_type)).length;
    if (bdr > bath) issues.push(`Bedroom-to-bathroom ratio is ${bdr}:${bath}; consider adding a bathroom.`);

    // ventilation
    const noWindow = rooms.filter((r) => /living|bedroom|study|office|dining/i.test(r.room_type) && !(Array.isArray(r.windows) && r.windows.length));
    if (noWindow.length) issues.push(`${noWindow.length} occupied room(s) lack a window — add glazing for daylight & code compliance.`);

    // parking
    const hasParking = rooms.some((r) => /parking|garage/i.test(r.room_type));
    if (!hasParking) issues.push("No parking provided; clients often expect at least one car space.");

    // storage
    const hasStorage = rooms.some((r) => /storage|utility|laundry/i.test(r.room_type));
    if (!hasStorage) issues.push("Consider a storage/utility room for practical living.");

    if (!issues.length) {
      return ["The plan is well-balanced: good room zoning, adequate bathrooms, and proper ventilation."];
    }
    return issues;
  }

  async function architectCritique(design) {
    if (!configured()) return localCritique(design);
    const summary = summarizeDesign(design);
    const system = "You are ArchinthAI, a principal architect performing a design review. " +
      "List 3-5 concise, actionable issues OR improvements for the following residential plan. " +
      "Focus on zoning, circulation, daylight, compliance, and livability. Return as a JSON array of strings.";
    try {
      const raw = await generateText(`Plan:\n${summary}`, system);
      const arr = JSON.parse(extractJson(raw));
      if (Array.isArray(arr) && arr.length) return arr;
      throw new Error("bad array");
    } catch (e) {
      return localCritique(design);
    }
  }

  // ------------------------------------------------------------------
  // Smart refinement (LLM) — convert a command into a structured op
  // ------------------------------------------------------------------
  async function smartRefine(command, design) {
    if (!configured()) return null;
    const system = "You are ArchinthAI. Convert a user's natural-language architectural command into a " +
      'structured JSON operation. Valid ops: "resize" (delta +/-, roomId or roomType, grow>0), ' +
      '"add" (roomType, levelId), "remove" (roomType), "move" (roomType, levelId). ' +
      'Respond ONLY with JSON like {"op":"resize","roomType":"kitchen","delta":0.5}.';
    try {
      const raw = await generateText(command, system);
      const op = JSON.parse(extractJson(raw));
      return op && op.op ? op : null;
    } catch (e) {
      return null;
    }
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------
  function extractJson(text) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end >= start) return text.slice(start, end + 1);
    const aStart = text.indexOf("[");
    const aEnd = text.lastIndexOf("]");
    if (aStart >= 0 && aEnd >= aStart) return text.slice(aStart, aEnd + 1);
    return text;
  }

  function summarizeDesign(design) {
    const cfg = design.config || {};
    const levels = (design.levels || []).map((l) => ({
      level: l.label,
      type: l.level_type,
      size: `${l.outer_width.toFixed(1)}m x ${l.outer_depth.toFixed(1)}m`,
      rooms: (l.rooms || []).map((r) => `${r.name} (${r.width.toFixed(1)}x${r.depth.toFixed(1)})`),
    }));
    return JSON.stringify({ config: cfg, levels }, null, 1);
  }

  global.ArchinthaiAI = {
    PROVIDERS,
    getConfig,
    configured,
    chat,
    generateText,
    understandBrief,
    parseRoomProgram,
    designRationale,
    localRationale,
    architectCritique,
    localCritique,
    smartRefine,
    ROOM_OPTIONS,
  };
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined" && module.exports) {
  module.exports = global.ArchinthaiAI;
}
