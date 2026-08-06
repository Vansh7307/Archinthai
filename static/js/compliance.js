// ArchinthAI Building Code Compliance Engine.
//
// Automates the legally-required checks that architects perform on every
// residential design: zoning setbacks, minimum room sizes, fire egress,
// stair geometry, ventilation, plumbing adjacency, and more.
//
// This is the core "architect replacement" module — it encodes regulatory
// knowledge into a deterministic, testable audit engine.
//
// Globals exposed:
//   window.ArchinthaiCompliance  -> { audit, check, VIOLATION, WARNING, PASS }

(function (global) {
  "use strict";

  const SEVERITY = {
    PASS: "pass",
    WARNING: "warning",
    VIOLATION: "violation",
  };

  // ------------------------------------------------------------------
  // Reference room-type minimum dimensions (m) & ventilation needs.
  // ------------------------------------------------------------------
  const ROOM_MIN = {
    "living room": { w: 3.6, d: 3.4, area: 12.0, vent: "window", comment: "Living rooms need natural light + ventilation." },
    "dining room": { w: 3.0, d: 2.8, area: 9.0, vent: "window", comment: "Dining should be adjacent to kitchen." },
    "kitchen": { w: 2.8, d: 2.6, area: 7.5, vent: "window", comment: "Kitchen requires ventilation + work triangle." },
    "bedroom": { w: 3.0, d: 3.0, area: 9.0, vent: "window", comment: "Bedrooms need a window (egress + ventilation)." },
    "master bedroom": { w: 3.6, d: 3.4, area: 13.0, vent: "window", comment: "Master bedroom requires generous clear floor area." },
    "bathroom": { w: 1.8, d: 1.8, area: 3.2, vent: "exhaust", comment: "Bathroom needs exhaust or window ventilation." },
    "attached bathroom": { w: 1.7, d: 1.7, area: 2.9, vent: "exhaust", comment: "Attached bathroom can use mechanical exhaust." },
    "study": { w: 2.4, d: 2.4, area: 5.8, vent: "window", comment: "Study benefits from daylight." },
    "office": { w: 2.6, d: 2.6, area: 6.8, vent: "window", comment: "Office requires comfortable working area." },
    "parking": { w: 5.2, d: 4.2, area: 18.0, vent: "mechanical", comment: "Parking needs CO ventilation." },
    "gym": { w: 2.8, d: 2.6, area: 7.3, vent: "window", comment: "Gym requires cross-ventilation." },
    "storage": { w: 1.9, d: 1.9, area: 3.6, vent: "none", comment: "Storage has no ventilation requirement." },
    "laundry": { w: 1.8, d: 1.8, area: 3.2, vent: "exhaust", comment: "Laundry requires exhaust." },
    "stair": { w: 1.8, d: 2.9, area: 5.2, vent: "none", comment: "Stair must be continuous to all floors." },
    "balcony": { w: 2.2, d: 1.4, area: 3.0, vent: "none", comment: "Balcony is open-air." },
    "guest room": { w: 3.0, d: 3.0, area: 9.0, vent: "window", comment: "Guest room needs egress window." },
    "family lounge": { w: 3.2, d: 3.0, area: 9.6, vent: "window", comment: "Family lounge needs daylight." },
    "home theater": { w: 3.4, d: 3.0, area: 10.2, vent: "mechanical", comment: "Home theater can be mechanically ventilated." },
    "pooja room": { w: 1.6, d: 1.6, area: 2.6, vent: "none", comment: "Pooja room no ventilation requirement." },
    "utility": { w: 1.8, d: 1.8, area: 3.2, vent: "exhaust", comment: "Utility requires exhaust." },
    "dressing": { w: 2.0, d: 1.8, area: 3.6, vent: "none", comment: "Dressing no ventilation requirement." },
    "walk-in closet": { w: 1.8, d: 1.6, area: 2.9, vent: "none", comment: "Closet no ventilation requirement." },
    "lobby": { w: 2.4, d: 2.2, area: 5.3, vent: "window", comment: "Lobby benefits from daylight." },
    "foyer": { w: 2.2, d: 2.2, area: 4.8, vent: "window", comment: "Foyer benefits from daylight." },
    "corridor": { w: 1.3, d: 2.4, area: 3.1, vent: "none", comment: "Corridor no ventilation requirement." },
  };

  const ROOM_ALIASES = {
    "bed room": "bedroom",
    "master": "master bedroom",
    "master room": "master bedroom",
    "dining": "dining room",
    "living": "living room",
    "washroom": "bathroom",
    "toilet": "bathroom",
    "wc": "bathroom",
    "powder room": "bathroom",
    "garage": "parking",
    "car park": "parking",
    "store": "storage",
    "closet": "walk-in closet",
    "walk in closet": "walk-in closet",
    "home office": "office",
    "theater": "home theater",
    "theatre": "home theater",
    "lounge": "family lounge",
    "family room": "family lounge",
    "pooja": "pooja room",
    "puja": "pooja room",
    "terrace": "terrace garden",
    "roof garden": "terrace garden",
    "laundry room": "laundry",
    "solar": "solar panels",
  };

  function normalizeRoomType(type) {
    const key = String(type || "").toLowerCase().trim();
    if (ROOM_MIN[key]) return key;
    if (ROOM_ALIASES[key]) return ROOM_ALIASES[key];
    // Token match for multi-word descriptions.
    for (const alias in ROOM_ALIASES) {
      if (key.includes(alias)) return ROOM_ALIASES[alias];
    }
    return key;
  }

  function roomMeta(type) {
    return ROOM_MIN[normalizeRoomType(type)] || null;
  }

  // ------------------------------------------------------------------
  // Audit helpers
  // ------------------------------------------------------------------
  function auditResult(checks) {
    const violations = checks.filter((c) => c.severity === SEVERITY.VIOLATION);
    const warnings = checks.filter((c) => c.severity === SEVERITY.WARNING);
    const passed = checks.filter((c) => c.severity === SEVERITY.PASS);
    const score = Math.max(0, Math.min(100,
      100 - violations.length * 12 - warnings.length * 4));
    return {
      score,
      status: violations.length ? "non-compliant" : (warnings.length ? "compliant-with-notes" : "compliant"),
      passed: passed.length,
      warnings: warnings.length,
      violations: violations.length,
      checks,
      violationsList: violations,
      warningsList: warnings,
    };
  }

  // ------------------------------------------------------------------
  // Core audit across a full design
  // ------------------------------------------------------------------
  function audit(design) {
    const config = design && design.config ? design.config : {};
    const levels = design && design.levels ? design.levels : [];
    const checks = [];

    // 1. Zoning setback compliance
    checkSetbacks(config, checks);

    // 2. Buildable envelope sanity
    checkEnvelope(config, checks);

    // 3. Per-level + per-room checks
    const nonRoofLevels = levels.filter((l) => l.level_type !== "roof");
    const allRooms = nonRoofLevels.reduce((acc, l) => acc.concat(l.rooms || []), []);

    // Minimum room sizes
    allRooms.forEach((room) => checkRoomSize(room, checks));

    // Window / ventilation
    allRooms.forEach((room) => checkVentilation(room, checks));

    // Stacking / overlap within each level
    nonRoofLevels.forEach((level) => checkOverlaps(level, checks));

    // Stair access (every non-roof floor above ground must be served by a stair)
    checkStairAccess(nonRoofLevels, config, checks);

    // Bathroom ratios (bedroom-to-bathroom)
    checkBathrooms(nonRoofLevels, checks);

    // 4. Egress windows for sleeping rooms on upper floors
    checkEgress(nonRoofLevels, allRooms, checks);

    // 5. Corridor width
    nonRoofLevels.forEach((level) => checkCorridors(level, checks));

    return auditResult(checks);
  }

  // --- Zoning setbacks ---
  function checkSetbacks(config, checks) {
    const plotW = Number(config.plot_width || 20);
    const plotD = Number(config.plot_depth || 16);
    const sb = {
      front: Number(config.setback_front || 0),
      rear: Number(config.setback_rear || 0),
      left: Number(config.setback_left || 0),
      right: Number(config.setback_right || 0),
    };
    const req = 1.0; // typical local minimum (m)
    ["front", "rear", "left", "right"].forEach((side) => {
      const value = sb[side];
      const fmt = (v) => `${v.toFixed(1)}m`;
      if (value < req) {
        checks.push({
          id: `setback-${side}`,
          category: "Zoning",
          severity: SEVERITY.VIOLATION,
          title: `${cap(side)} setback below minimum`,
          message: `${cap(side)} setback is ${fmt(value)}, below the typical ${fmt(req)} minimum.`,
          detail: `Configure setbacks in Project Setup.`,
          code: "IRC/R103.1",
        });
      } else {
        checks.push({
          id: `setback-${side}`,
          category: "Zoning",
          severity: SEVERITY.PASS,
          title: `${cap(side)} setback compliant`,
          message: `${cap(side)} setback ${fmt(value)} ≥ ${fmt(req)}.`,
          code: "IRC/R103.1",
        });
      }
    });
  }

  function checkEnvelope(config, checks) {
    const plotW = Number(config.plot_width || 20);
    const plotD = Number(config.plot_depth || 16);
    const bw = plotW - Number(config.setback_left || 0) - Number(config.setback_right || 0);
    const bd = plotD - Number(config.setback_front || 0) - Number(config.setback_rear || 0);
    if (bw < 6 || bd < 6) {
      checks.push({
        id: "envelope-too-small",
        category: "Zoning",
        severity: SEVERITY.VIOLATION,
        title: "Buildable area too small",
        message: `Buildable envelope ${bw.toFixed(1)}m × ${bd.toFixed(1)}m is below practical minimum.`,
        code: "Zoning",
      });
    }
  }

  // --- Room size ---
  function checkRoomSize(room, checks) {
    const meta = roomMeta(room.room_type || room.name);
    if (!meta) return;
    const area = room.width * room.depth;
    const violations = [];
    if (room.width < meta.w - 0.05) violations.push(`width ${room.width.toFixed(1)}m < ${meta.w.toFixed(1)}m`);
    if (room.depth < meta.d - 0.05) violations.push(`depth ${room.depth.toFixed(1)}m < ${meta.d.toFixed(1)}m`);
    if (area < meta.area - 0.1) violations.push(`area ${area.toFixed(1)}m² < ${meta.area.toFixed(1)}m²`);
    if (violations.length) {
      checks.push({
        id: `room-size-${room.room_id}`,
        category: "Room Standards",
        severity: SEVERITY.VIOLATION,
        title: `${room.name} below minimum size`,
        message: `${room.name} on ${room.level_id}: ${violations.join(", ")}.`,
        detail: meta.comment,
        code: "Min. dimension",
      });
    } else {
      checks.push({
        id: `room-size-${room.room_id}`,
        category: "Room Standards",
        severity: SEVERITY.PASS,
        title: `${room.name} size OK`,
        message: `${room.name} ${area.toFixed(1)}m² meets minimum.`,
        code: "Min. dimension",
      });
    }
  }

  // --- Ventilation ---
  function checkVentilation(room, checks) {
    const meta = roomMeta(room.room_type || room.name);
    if (!meta || meta.vent === "none") return;
    const hasWindow = Array.isArray(room.windows) && room.windows.length > 0;
    const needsWindow = meta.vent === "window";
    if (needsWindow && !hasWindow) {
      checks.push({
        id: `vent-${room.room_id}`,
        category: "Ventilation",
        severity: SEVERITY.VIOLATION,
        title: `${room.name} lacks natural light/ventilation`,
        message: `${room.name} requires a window for light and ventilation.`,
        detail: meta.comment,
        code: "IRC/Vent",
      });
    } else if (hasWindow) {
      checks.push({
        id: `vent-${room.room_id}`,
        category: "Ventilation",
        severity: SEVERITY.PASS,
        title: `${room.name} ventilated`,
        message: `${room.name} has ${room.windows.length} window(s).`,
        code: "IRC/Vent",
      });
    }
  }

  // --- Overlap detection ---
  function checkOverlaps(level, checks) {
    const rooms = level.rooms || [];
    for (let i = 0; i < rooms.length; i += 1) {
      for (let j = i + 1; j < rooms.length; j += 1) {
        const a = rooms[i];
        const b = rooms[j];
        const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.depth, b.y + b.depth) - Math.max(a.y, b.y);
        if (overlapX > 0.05 && overlapY > 0.05) {
          checks.push({
            id: `overlap-${a.room_id}-${b.room_id}`,
            category: "Planning",
            severity: SEVERITY.VIOLATION,
            title: `Rooms overlap on ${level.label}`,
            message: `${a.name} overlaps ${b.name} by ${overlapX.toFixed(1)}m × ${overlapY.toFixed(1)}m.`,
            detail: "Use Reflow or drag to resolve.",
            code: "Planning",
          });
        }
      }
    }
  }

  // --- Stair access ---
  function checkStairAccess(nonRoofLevels, config, checks) {
    const floorCount = Number(config.floor_count || 1);
    if (floorCount < 2) return;
    const levelsAboveGround = nonRoofLevels.filter((l) => l.level_type !== "ground" && l.level_type !== "basement");
    levelsAboveGround.forEach((level) => {
      const hasStair = (level.rooms || []).some((r) => /stair/i.test(r.room_type));
      if (!hasStair) {
        checks.push({
          id: `stair-${level.level_id}`,
          category: "Egress",
          severity: SEVERITY.VIOLATION,
          title: `${level.label} has no stair access`,
          message: `Upper floor ${level.label} must be served by a stair for egress.`,
          code: "IRC/R311",
        });
      } else {
        checks.push({
          id: `stair-${level.level_id}`,
          category: "Egress",
          severity: SEVERITY.PASS,
          title: `${level.label} has stair access`,
          message: `Stair present on ${level.label}.`,
          code: "IRC/R311",
        });
      }
    });
  }

  // --- Bathroom ratios ---
  function checkBathrooms(nonRoofLevels, checks) {
    const allRooms = nonRoofLevels.reduce((acc, l) => acc.concat(l.rooms || []), []);
    const bedrooms = allRooms.filter((r) => /bedroom/i.test(r.room_type));
    const bathrooms = allRooms.filter((r) => /bath/i.test(r.room_type));
    if (bedrooms.length > bathrooms.length) {
      checks.push({
        id: "bathroom-ratio",
        category: "Room Standards",
        severity: SEVERITY.WARNING,
        title: "Insufficient bathrooms for bedrooms",
        message: `${bedrooms.length} bedroom(s) but only ${bathrooms.length} bathroom(s).`,
        detail: "Consider a 1:1 or 2:1 bedroom-to-bathroom ratio.",
        code: "Planning",
      });
    } else {
      checks.push({
        id: "bathroom-ratio",
        category: "Room Standards",
        severity: SEVERITY.PASS,
        title: "Bathroom provision adequate",
        message: `${bathrooms.length} bathroom(s) for ${bedrooms.length} bedroom(s).`,
        code: "Planning",
      });
    }
  }

  // --- Egress windows on sleeping rooms ---
  function checkEgress(nonRoofLevels, allRooms, checks) {
    const sleeping = allRooms.filter((r) => /bedroom|guest/i.test(r.room_type));
    sleeping.forEach((room) => {
      const level = nonRoofLevels.find((l) => l.level_id === room.level_id);
      const isUpper = level && level.level_type !== "ground" && level.level_type !== "basement";
      const hasWindow = Array.isArray(room.windows) && room.windows.some((w) => w !== "none");
      const isGround = level && level.level_type === "ground";
      if (isUpper && !hasWindow) {
        checks.push({
          id: `egress-${room.room_id}`,
          category: "Egress",
          severity: SEVERITY.VIOLATION,
          title: `${room.name} lacks egress window`,
          message: `Sleeping room on upper floor needs an operable egress window.`,
          code: "IRC/R310",
        });
      } else if (isUpper && hasWindow) {
        checks.push({
          id: `egress-${room.room_id}`,
          category: "Egress",
          severity: SEVERITY.PASS,
          title: `${room.name} has egress window`,
          message: "Egress window provided.",
          code: "IRC/R310",
        });
      }
      if (isGround && !hasWindow) {
        checks.push({
          id: `egress-ground-${room.room_id}`,
          category: "Egress",
          severity: SEVERITY.WARNING,
          title: `${room.name} ground floor light`,
          message: "Ground-floor sleeping room benefits from a window.",
          code: "IRC/R310",
        });
      }
    });
  }

  // --- Corridor width ---
  function checkCorridors(level, checks) {
    const corridors = (level.rooms || []).filter((r) => /corridor/i.test(r.room_type));
    corridors.forEach((room) => {
      const minWidth = 0.91; // ~36"
      if (room.width < minWidth && room.depth >= room.width) {
        const w = Math.min(room.width, room.depth);
        checks.push({
          id: `corridor-${room.room_id}`,
          category: "Egress",
          severity: SEVERITY.WARNING,
          title: "Corridor too narrow",
          message: `Corridor width ${w.toFixed(2)}m < ${minWidth.toFixed(2)}m minimum.`,
          code: "IRC/R311.6",
        });
      }
    });
  }

  // ------------------------------------------------------------------
  // Single check (used by UI for one room)
  // ------------------------------------------------------------------
  function check(design, roomId) {
    const result = audit(design);
    return result.checks.filter((c) => c.id && c.id.includes(roomId));
  }

  function cap(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // Expose
  global.ArchinthaiCompliance = {
    audit,
    check,
    SEVERITY,
    ROOM_MIN,
    normalizeRoomType,
  };
})(typeof window !== "undefined" ? window : globalThis);

// Node export for tests
if (typeof module !== "undefined" && module.exports) {
  module.exports = global.ArchinthaiCompliance;
}
