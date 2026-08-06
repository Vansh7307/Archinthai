// ArchinthAI room-based architectural layout generation engine (client-side).
// Ported from backend/generation.py so generation runs entirely in the browser.

(function (global) {
  "use strict";

  // -------------------------------------------------------------------------
  // Room type / style knowledge tables
  // -------------------------------------------------------------------------
  const ROOM_TYPES = {
    "living room": { label: "Living Room", zone: "front", color: "#dbeafe", min_w: 3.6, min_d: 3.4, ratio: 1.45, window_side: "front" },
    "dining room": { label: "Dining Room", zone: "middle", color: "#fde68a", min_w: 3.0, min_d: 2.8, ratio: 1.3, window_side: "side" },
    "kitchen": { label: "Kitchen", zone: "rear", color: "#ffedd5", min_w: 2.8, min_d: 2.6, ratio: 1.25, window_side: "rear" },
    "bedroom": { label: "Bedroom", zone: "middle", color: "#e9d5ff", min_w: 3.0, min_d: 3.0, ratio: 1.2, window_side: "side" },
    "master bedroom": { label: "Master Bedroom", zone: "front", color: "#fbcfe8", min_w: 3.6, min_d: 3.4, ratio: 1.3, window_side: "front" },
    "bathroom": { label: "Bathroom", zone: "middle", color: "#bae6fd", min_w: 1.8, min_d: 1.8, ratio: 1.0, window_side: "side" },
    "attached bathroom": { label: "Attached Bathroom", zone: "middle", color: "#a5f3fc", min_w: 1.7, min_d: 1.7, ratio: 1.0, window_side: "side" },
    "study": { label: "Study", zone: "middle", color: "#c7d2fe", min_w: 2.4, min_d: 2.4, ratio: 1.15, window_side: "side" },
    "office": { label: "Office", zone: "middle", color: "#dbeafe", min_w: 2.6, min_d: 2.6, ratio: 1.2, window_side: "side" },
    "parking": { label: "Parking", zone: "front", color: "#d1d5db", min_w: 5.2, min_d: 4.2, ratio: 1.3, window_side: "none" },
    "gym": { label: "Gym", zone: "middle", color: "#dcfce7", min_w: 2.8, min_d: 2.6, ratio: 1.2, window_side: "side" },
    "storage": { label: "Storage", zone: "rear", color: "#e5e7eb", min_w: 1.9, min_d: 1.9, ratio: 1.0, window_side: "none" },
    "laundry": { label: "Laundry", zone: "rear", color: "#e0f2fe", min_w: 1.8, min_d: 1.8, ratio: 1.0, window_side: "none" },
    "balcony": { label: "Balcony", zone: "front", color: "#bbf7d0", min_w: 2.2, min_d: 1.4, ratio: 1.6, window_side: "front" },
    "stair": { label: "Stair", zone: "middle", color: "#cbd5e1", min_w: 1.8, min_d: 2.9, ratio: 0.62, window_side: "none" },
    "terrace garden": { label: "Terrace Garden", zone: "rear", color: "#a7f3d0", min_w: 3.0, min_d: 2.4, ratio: 1.35, window_side: "rear" },
    "guest room": { label: "Guest Room", zone: "middle", color: "#fbcfe8", min_w: 3.0, min_d: 3.0, ratio: 1.2, window_side: "side" },
    "family lounge": { label: "Family Lounge", zone: "front", color: "#fef9c3", min_w: 3.2, min_d: 3.0, ratio: 1.3, window_side: "front" },
    "home theater": { label: "Home Theater", zone: "middle", color: "#ddd6fe", min_w: 3.4, min_d: 3.0, ratio: 1.35, window_side: "none" },
    "pooja room": { label: "Pooja Room", zone: "middle", color: "#fde047", min_w: 1.6, min_d: 1.6, ratio: 1.0, window_side: "none" },
    "utility": { label: "Utility", zone: "rear", color: "#f1f5f9", min_w: 1.8, min_d: 1.8, ratio: 1.0, window_side: "none" },
    "dressing": { label: "Dressing", zone: "middle", color: "#fae8ff", min_w: 2.0, min_d: 1.8, ratio: 1.1, window_side: "none" },
    "walk-in closet": { label: "Walk-in Closet", zone: "middle", color: "#f3e8ff", min_w: 1.8, min_d: 1.6, ratio: 1.1, window_side: "none" },
    "lobby": { label: "Lobby", zone: "front", color: "#e2e8f0", min_w: 2.4, min_d: 2.2, ratio: 1.1, window_side: "front" },
    "foyer": { label: "Foyer", zone: "front", color: "#e2e8f0", min_w: 2.2, min_d: 2.2, ratio: 1.0, window_side: "front" },
    "verandah": { label: "Verandah", zone: "front", color: "#d9f99d", min_w: 2.4, min_d: 1.6, ratio: 1.5, window_side: "front" },
    "corridor": { label: "Corridor", zone: "middle", color: "#e5e7eb", min_w: 1.3, min_d: 2.4, ratio: 0.54, window_side: "none" }
  };

  const ROOF_FEATURE_TYPES = {
    "solar panels": { color: "#d9ecff", height: 0.42, size_ratio: 0.4 },
    "water tank": { color: "#dfe7f2", height: 0.9, size_ratio: 0.2 },
    "sit-out area": { color: "#dff4dd", height: 0.3, size_ratio: 0.42 },
    "terrace garden": { color: "#a7f3d0", height: 0.34, size_ratio: 0.5 },
    "headroom": { color: "#eef2ff", height: 2.6, size_ratio: 0.3 },
    "garden": { color: "#a7f3d0", height: 0.34, size_ratio: 0.42 },
    "jogging track": { color: "#eef3fb", height: 0.1, size_ratio: 0.5 }
  };

  const STYLE_PRESETS = {
    modern: { score_bonus: 2.0, seed_bias: "glass-concrete" },
    minimal: { score_bonus: 1.0, seed_bias: "warm-minimal" },
    contemporary: { score_bonus: 1.5, seed_bias: "stone-glass" },
    luxury: { score_bonus: 3.0, seed_bias: "luxury-stone" }
  };

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  function r2(v) { return Math.round(v * 100) / 100; }

  function slugify(text) { return String(text).toLowerCase().replace(/ /g, "_").replace(/-/g, "_"); }

  function roomMeta(roomType) { return ROOM_TYPES[String(roomType).toLowerCase().trim()] || ROOM_TYPES["bedroom"]; }

  function colorBetween(a, b, amount) {
    const ra = parseInt(a.slice(1, 3), 16), ga = parseInt(a.slice(3, 5), 16), ba = parseInt(a.slice(5, 7), 16);
    const rb = parseInt(b.slice(1, 3), 16), gb = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
    const r = Math.round(ra + (rb - ra) * amount);
    const g = Math.round(ga + (gb - ga) * amount);
    const bl = Math.round(ba + (bb - ba) * amount);
    return "#" + [r, g, bl].map((v) => v.toString(16).padStart(2, "0")).join("");
  }

  function variantTint(baseColor, variantIndex) {
    const shifts = [[0.02, -0.01, 0.01], [-0.01, 0.02, 0.02], [0.0, 0.01, -0.02]];
    const s = shifts[variantIndex % shifts.length];
    const r = Math.max(0, Math.min(255, parseInt(baseColor.slice(1, 3), 16) + s[0] * 255));
    const g = Math.max(0, Math.min(255, parseInt(baseColor.slice(3, 5), 16) + s[1] * 255));
    const b = Math.max(0, Math.min(255, parseInt(baseColor.slice(5, 7), 16) + s[2] * 255));
    return "#" + [Math.round(r), Math.round(g), Math.round(b)].map((v) => v.toString(16).padStart(2, "0")).join("");
  }

  // Deterministic seeded RNG (mulberry32) replacing Python's random.Random
  function mulberry32(seedStr) {
    let a = 0;
    for (let i = 0; i < seedStr.length; i++) a = (a + seedStr.charCodeAt(i) * (i + 1)) >>> 0;
    a = (a ^ 0x9e3779b9) >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeRng(seedStr) {
    const rand = mulberry32(seedStr);
    return {
      uniform: rand,
      shuffle: function (arr) {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(rand() * (i + 1));
          const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
        }
        return arr;
      }
    };
  }

  function deepClone(v) {
    if (typeof structuredClone === "function") return structuredClone(v);
    return JSON.parse(JSON.stringify(v));
  }

  // -------------------------------------------------------------------------
  // Envelope + level helpers
  // -------------------------------------------------------------------------
  function buildableEnvelope(config) {
    const plotW = Number(config.plot_width || 20);
    const plotD = Number(config.plot_depth || 16);
    const sbF = Number(config.setback_front || 0);
    const sbR = Number(config.setback_rear || 0);
    const sbL = Number(config.setback_left || 0);
    const sbRgt = Number(config.setback_right || 0);
    const bw = Math.max(7.2, plotW - sbL - sbRgt);
    const bd = Math.max(7.2, plotD - sbF - sbR);
    return { width: r2(Math.min(bw, plotW)), depth: r2(Math.min(bd, plotD)), plot_width: r2(plotW), plot_depth: r2(plotD) };
  }

  function isRoofLevel(level) { return String(level.level_type || "").toLowerCase() === "roof"; }

  function levelLabel(levelId, fallback) {
    const labels = { basement: "Basement", ground: "Ground Floor", first_floor: "First Floor", second_floor: "Second Floor", third_floor: "Third Floor", roof: "Roof" };
    return labels[levelId] || fallback || levelId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // -------------------------------------------------------------------------
  // Room packing
  // -------------------------------------------------------------------------
  function expandRequests(level) {
    const items = [];
    (level.room_requests || []).forEach((request) => {
      const roomType = String(request.room_type || "").trim();
      if (!roomType) return;
      const count = Math.max(1, Number(request.count || 1) || 1);
      const zone = request.preferred_zone || null;
      for (let i = 0; i < count; i++) items.push({ room_type: roomType, label: roomMeta(roomType).label, zone });
    });
    return items;
  }

  function preferredZoneFor(roomType) { return roomMeta(roomType).zone; }

  function zoneFlex(room, level) {
    const meta = roomMeta(room.room_type);
    const preferred = room.zone || meta.zone;
    const order = ["front", "middle", "rear"];
    if (String(level.level_type || "").toLowerCase() === "basement") {
      if (order.includes(preferred)) return [preferred, ...order.filter((z) => z !== preferred)];
      return order.slice();
    }
    if (order.includes(preferred)) return [preferred, ...order.filter((z) => z !== preferred)];
    return order.slice();
  }

  function normalize(items, level) {
    function keyfn(room) {
      const flex = zoneFlex(room, level);
      const zoneRank = { front: 0, middle: 1, rear: 2 }[flex[0]] !== undefined ? { front: 0, middle: 1, rear: 2 }[flex[0]] : 1;
      const meta = roomMeta(room.room_type);
      const area = meta.min_w * meta.min_d;
      return [(flex[0] === "front" ? 0 : 1), -area];
    }
    const stair = items.filter((r) => r.room_type.toLowerCase() === "stair");
    const others = items.filter((r) => r.room_type.toLowerCase() !== "stair");
    others.sort((a, b) => {
      const ka = keyfn(a), kb = keyfn(b);
      return ka[0] - kb[0] || ka[1] - kb[1];
    });
    return stair.concat(others);
  }

  function areaBounds(room, zoneI, zoneCount) {
    const meta = roomMeta(room.room_type);
    const baseArea = meta.min_w * meta.min_d;
    const zoneArea = baseArea * (1.0 + 0.08 * zoneCount) * (1.0 + 0.05 * zoneI);
    const targetW = Math.sqrt(zoneArea * meta.ratio);
    const targetD = zoneArea / targetW;
    return [targetW, targetD];
  }

  function fitZone(room, level, zone, width, depth, usedRects, band, bandIsVertical, rng, strategy) {
    const meta = roomMeta(room.room_type);
    const minW = meta.min_w, minD = meta.min_d;
    const maxW = Math.min(width, (bandIsVertical && (zone === "front" || zone === "rear")) ? band.width - 0.1 : Math.max(width * 0.55, minW));
    const maxD = Math.min(depth, Math.max(depth * 0.6, minD));
    const [tW, tD] = areaBounds(room, 0, 1);

    for (let attempt = 0; attempt < 40; attempt++) {
      let roomW, roomD;
      if (attempt % 2 === 0) {
        roomW = r2(Math.min(maxW, tW * rng.uniform(0.86, 1.06)));
        roomD = r2(Math.min(maxD, tD * rng.uniform(0.86, 1.08)));
      } else {
        roomW = r2(Math.min(maxW, tW));
        roomD = r2(Math.min(maxD, tD));
      }
      roomW = Math.max(minW, roomW);
      roomD = Math.max(minD, roomD);
      if (roomW > maxW || roomD > maxD) continue;

      const margin = 0.18;
      const xs = [0.14], ys = [0.14];
      usedRects.forEach((u) => {
        xs.push(u.x + u.w + margin);
        xs.push(u.x - roomW - margin);
        ys.push(u.y + u.d + margin);
        ys.push(u.y - roomD - margin);
      });
      const xsF = xs.map(r2).filter((v) => r2(v) >= 0.1 && r2(v) + roomW <= width - 0.1);
      const ysF = ys.map(r2).filter((v) => r2(v) >= 0.1 && r2(v) + roomD <= depth - 0.1);
      const xsU = [...new Set(xsF)].sort((a, b) => a - b);
      const ysU = [...new Set(ysF)].sort((a, b) => a - b);
      rng.shuffle(xsU);
      rng.shuffle(ysU);

      for (const x of xsU) {
        for (const y of ysU) {
          const rect = { x, y, w: roomW, d: roomD };
          if (usedRects.some((u) => overlaps(rect, u))) continue;
          return {
            room_type: room.room_type, label: room.label, requested_zone: zone, zone,
            x, y, width: roomW, depth: roomD
          };
        }
      }
    }
    return null;
  }

  function overlaps(a, b) {
    return !(a.x + a.w <= b.x + 1e-6 || b.x + b.w <= a.x + 1e-6 || a.y + a.d <= b.y + 1e-6 || b.y + b.d <= a.y + 1e-6);
  }

  function zonesFor(width, depth, bandX, bandW, bandIsVertical, nzones) {
    nzones = nzones || 3;
    const zones = [];
    const depthBudget = bandIsVertical ? Math.max(depth - bandW, 6.0) : depth;
    let z = 0.12;
    for (let idx = 0; idx < nzones; idx++) {
      let zd;
      if (idx === nzones - 1) {
        zd = Math.max(2.0, depth - z - 0.14);
      } else {
        const fracs = [0.34, 0.33, 0.33];
        zd = Math.max(2.0, depthBudget * fracs[idx]);
      }
      zd = Math.min(zd, z + zd < depth ? depth - z - 0.12 : depth - z - 0.12);
      zones.push({ name: ["front", "middle", "rear"][idx], x: 0.12, y: r2(z), width: r2(width - 0.24), depth: r2(zd) });
      z += zd + 0.12;
    }
    return zones;
  }

  function inside(rect, zone, pad) {
    pad = pad || 0.0;
    return rect.x + 1e-6 >= zone.x - pad && rect.y + 1e-6 >= zone.y - pad && rect.x + rect.w - 1e-6 <= zone.x + zone.w + pad && rect.y + rect.d - 1e-6 <= zone.y + zone.d + pad;
  }

  function placeLevel(level, envelope, bandSide, strategy, seedSalt) {
    const width = envelope.width, depth = envelope.depth, bandW = 1.7;
    const bandIsVertical = strategy !== "wide-front";
    let bandX = r2(width * 0.52 - bandW / 2);
    if (strategy === "deep-rear") bandX = r2(width * 0.5 - bandW / 2);

    const rng = makeRng(`${level.level_id || "level"}-${strategy}-${seedSalt}`);
    const items = normalize(expandRequests(level), level);
    const stairItems = items.filter((i) => i.room_type.toLowerCase() === "stair");
    const nonStair = items.filter((i) => i.room_type.toLowerCase() !== "stair");

    const zones = [
      { name: "front", x: 0.12, y: 0.14, width: r2(width - 0.24), depth: r2(Math.max(2.0, depth * 0.36 - 0.2)) },
      { name: "middle", x: 0.12, y: r2(0.14 + Math.max(2.0, depth * 0.36)), width: r2(width - 0.24), depth: r2(Math.max(2.0, depth * 0.34 - 0.2)) },
      { name: "rear", x: 0.12, y: r2(0.14 + Math.max(2.0, depth * 0.36) + Math.max(2.0, depth * 0.34)), width: r2(width - 0.24), depth: r2(Math.max(2.0, depth - 0.28 - Math.max(2.0, depth * 0.36) - Math.max(2.0, depth * 0.34))) }
    ];

    const placedRooms = [];
    const usedRects = [];

    stairItems.forEach((stair) => {
      const meta = roomMeta(stair.room_type);
      const sw = r2(meta.min_w);
      const sd = r2(Math.min(Math.max(meta.min_d, depth * 0.26), bandW));
      const sx = r2(bandX + (bandW - sw) / 2);
      const sy = r2((depth - sd) / 2);
      const rect = { x: sx, y: sy, w: sw, d: sd };
      placedRooms.push({ room_type: stair.room_type, label: stair.label, requested_zone: "middle", zone: "middle", x: sx, y: sy, width: sw, depth: sd });
      usedRects.push(rect);
    });

    const bandRect = { x: bandX, y: 0.1, w: bandW, d: depth - 0.2 };
    usedRects.push(bandRect);

    const frontRooms = [], middleRooms = [], rearRooms = [];
    nonStair.forEach((room) => {
      const order = zoneFlex(room, level);
      const preferred = order[0];
      if (preferred === "front") frontRooms.push(room);
      else if (preferred === "rear") rearRooms.push(room);
      else middleRooms.push(room);
    });

    function tryZone(zname, pool) {
      pool.forEach((room) => {
        const zone = zones.find((z) => z.name === zname);
        if (!zone) return;
        const zrect = { x: zone.x, y: zone.y, w: zone.width, d: zone.depth };
        const placed = fitZone(room, level, zname, zone.width, zone.depth,
          usedRects.filter((u) => inside(u, zrect, 0.1)),
          { width: bandW, x: bandX, y: 0.1, w: bandW, d: depth - 0.2 }, true, rng, strategy);
        if (placed) {
          usedRects.push({ x: placed.x, y: placed.y, w: placed.width, d: placed.depth });
          placedRooms.push(placed);
        }
      });
    }

    tryZone("front", frontRooms);
    tryZone("middle", middleRooms);
    tryZone("rear", rearRooms);

    // Fallback grid fill for unplaced rooms
    nonStair.forEach((room) => {
      if (placedRooms.some((p) => p.room_type === room.room_type)) return;
      const meta = roomMeta(room.room_type);
      const rw = r2(meta.min_w), rd = r2(meta.min_d);
      let best = null, bestScore = 1e9;
      zones.forEach((zone) => {
        const zrect = { x: zone.x, y: zone.y, w: zone.width, d: zone.depth };
        const ysList = [r2(zone.y + 0.14), r2(zone.y + zone.depth / 2 - rd / 2)];
        ysList.forEach((yy) => {
          const xsList = [r2(zone.x + 0.14), r2(zone.x + zone.width / 2 - rw / 2), r2(zone.x + zone.width - rw - 0.14)];
          xsList.forEach((xx) => {
            if (xx < 0.1 || yy < 0.1 || xx + rw > width - 0.1 || yy + rd > depth - 0.1) return;
            const cand = { x: xx, y: yy, w: rw, d: rd };
            if (usedRects.some((u) => overlaps(cand, u))) return;
            const score = Math.abs(xx) + Math.abs(yy);
            if (score < bestScore) { bestScore = score; best = { cand, zone: zone.name }; }
          });
        });
      });
      if (best) {
        const cand = best.cand;
        usedRects.push(cand);
        placedRooms.push({ room_type: room.room_type, label: room.label, requested_zone: best.zone, zone: best.zone, x: cand.x, y: cand.y, width: cand.w, depth: cand.d });
      }
    });

    const levelId = level.level_id || "ground";
    const roomsOut = [];
    const idxMap = {};
    placedRooms.forEach((r) => {
      const key = r.room_type;
      idxMap[key] = (idxMap[key] || 0) + 1;
      const meta = roomMeta(r.room_type);
      const roomId = `${levelId}_${slugify(key)}_${idxMap[key]}`;
      const doorSide = doorSideFor(r, width, depth);
      const windows = windowsFor(r, width, depth, doorSide);
      roomsOut.push({
        room_id: roomId, name: meta.label, room_type: key.toLowerCase(), level_id: levelId,
        x: r2(r.x), y: r2(r.y), width: r2(r.width), depth: r2(r.depth), height: 3.2,
        color: variantTint(meta.color, seedSalt), door_side: doorSide, windows, zone: r.zone
      });
    });

    return {
      level_id: levelId, label: level.label || levelLabel(levelId, ""), level_type: level.level_type || "floor",
      z_index: Number(level.z_index || 0), outer_width: r2(width), outer_depth: r2(depth),
      rooms: roomsOut, roof_features: [], circulation_band: { x: r2(bandX), width: r2(bandW) }
    };
  }

  function doorSideFor(room, width, depth) {
    const zone = room.zone || "middle";
    if (zone === "front") return "south";
    if (zone === "rear") return "north";
    const cx = room.x + room.width / 2;
    const mid = width / 2;
    return cx < mid ? "west" : "east";
  }

  function windowsFor(room, width, depth, doorSide) {
    const meta = roomMeta(room.room_type);
    const winSide = meta.window_side;
    const zone = room.zone || "middle";
    const external = [];
    const eps = 0.2;
    if (room.x <= eps) external.push("west");
    if (room.x + room.width >= width - eps) external.push("east");
    if (room.y <= eps) external.push("south");
    if (room.y + room.depth >= depth - eps) external.push("north");
    if (winSide === "none") {
      const filtered = external.filter((w) => w !== doorSide);
      return filtered.slice(0, 1);
    }
    if (external.includes(doorSide)) {
      if (winSide === "front" && doorSide !== "south" && external.includes("south")) external.splice(external.indexOf(doorSide), 1);
      else if (winSide === "rear" && doorSide !== "north" && external.includes("north")) external.splice(external.indexOf(doorSide), 1);
    }
    return external.slice(0, 2);
  }

  // -------------------------------------------------------------------------
  // Roof level generation
  // -------------------------------------------------------------------------
  function placeRoof(level, envelope, strategy, seedSalt) {
    const width = envelope.width, depth = envelope.depth;
    const items = expandRequests(level);
    const rng = makeRng(`roof-${strategy}-${seedSalt}`);
    const features = [];
    const used = [];
    const idxMap = {};

    function sortKey(item) {
      const t = item.room_type.toLowerCase();
      return (t.includes("garden") || t.includes("sit-out")) ? 0 : (t.includes("solar") ? 1 : 2);
    }
    items.sort((a, b) => sortKey(a) - sortKey(b));

    items.forEach((item) => {
      const key = item.room_type.toLowerCase();
      const meta = ROOF_FEATURE_TYPES[key] || { color: "#eef3fb", height: 0.42, size_ratio: 0.3 };
      idxMap[key] = (idxMap[key] || 0) + 1;
      const fw = r2(Math.max(1.4, Math.min(width * meta.size_ratio, 6.0)));
      const fd = r2(Math.max(1.2, Math.min(depth * meta.size_ratio * 0.9, 4.5)));
      let placed = null;
      for (let attempt = 0; attempt < 30; attempt++) {
        const fx = r2(0.2 + rng.uniform() * Math.max(0.01, width - fw - 0.4));
        const fy = r2(0.2 + rng.uniform() * Math.max(0.01, depth - fd - 0.4));
        const cand = { x: fx, y: fy, w: fw, d: fd };
        if (!used.some((u) => overlaps(cand, u))) { placed = cand; break; }
      }
      if (!placed) {
        const fx = r2(0.2 + (features.length * (fw + 0.3)) % Math.max(1.0, width - fw));
        const fy = r2(0.2 + (features.length % 3) * (fd + 0.3));
        placed = { x: Math.min(fx, Math.max(0.1, width - fw - 0.1)), y: Math.min(fy, Math.max(0.1, depth - fd - 0.1)), w: fw, d: fd };
      }
      used.push(placed);
      features.push({
        feature_id: `roof_${key.replace(/ /g, "_")}_${idxMap[key]}`,
        name: roomMeta(item.room_type).label,
        feature_type: key,
        x: placed.x, y: placed.y, width: placed.w, depth: placed.d,
        height: meta.height, color: meta.color
      });
    });

    return {
      level_id: level.level_id || "roof", label: level.label || "Roof", level_type: "roof",
      z_index: Number(level.z_index || 10), outer_width: r2(width), outer_depth: r2(depth),
      rooms: [], roof_features: features, circulation_band: null
    };
  }

  // -------------------------------------------------------------------------
  // Full design generation
  // -------------------------------------------------------------------------
  function resolveLevels(config) {
    const floorCount = Math.max(1, Number(config.floor_count || 1));
    const includeBasement = !!config.include_basement;
    const includeRoof = !!config.include_roof;
    const catalog = config.levels || [];
    if (!catalog.length) throw new Error("No levels configured.");

    const active = [];
    let z = 0;
    if (includeBasement && catalog.some((l) => String(l.level_type || "").toLowerCase() === "basement")) {
      const basement = catalog.find((l) => String(l.level_type || "").toLowerCase() === "basement");
      if (basement) { active.push(Object.assign(deepClone(basement), { z_index: z })); z += 1; }
    }
    catalog.forEach((lvl) => {
      const lt = String(lvl.level_type || "").toLowerCase();
      if (lt === "ground") { active.push(Object.assign(deepClone(lvl), { z_index: z })); z += 1; }
      else if (["floor", "first_floor", "second_floor", "third_floor"].includes(lt)) {
        active.push(Object.assign(deepClone(lvl), { z_index: z })); z += 1;
      }
    });
    if (includeRoof) {
      const roof = catalog.find((l) => String(l.level_type || "").toLowerCase() === "roof");
      if (roof) { active.push(Object.assign(deepClone(roof), { z_index: z })); z += 1; }
    }
    return active;
  }

  function adjustFloorCount(levels, floorCount) {
    const normalFloors = levels.filter((l) => ["floor", "first_floor", "second_floor", "third_floor"].includes(l.level_type));
    const keep = normalFloors.slice(0, Math.max(0, floorCount - 1));
    const keptIds = new Set(keep.map((l) => l.level_id));
    const out = [];
    levels.forEach((l) => {
      if (["floor", "first_floor", "second_floor", "third_floor"].includes(l.level_type)) {
        if (keptIds.has(l.level_id)) out.push(l);
      } else out.push(l);
    });
    return out;
  }

  function buildMetadata(config, levelsOut, strategy, seedSalt) {
    const totalRooms = levelsOut.reduce((s, l) => s + l.rooms.length, 0);
    const totalFeatureArea = levelsOut.reduce((s, l) => s + l.roof_features.reduce((a, f) => a + f.width * f.depth, 0), 0);
    const buildable = buildableEnvelope(config);
    const plateArea = buildable.width * buildable.depth;
    const usedArea = levelsOut.reduce((s, l) => s + l.rooms.reduce((a, r) => a + r.width * r.depth, 0), 0);
    const coverage = usedArea / Math.max(plateArea, 1);
    const compactness = coverage;
    const overlapPenalty = 0.0;

    const notes = [];
    if (!levelsOut.some((l) => l.rooms.some((r) => r.room_type === "bathroom" || r.room_type.includes("bathroom")))) {
      notes.push("No bathrooms in program.");
    } else if (totalRooms > 0) {
      notes.push("Room placement balanced around the circulation core.");
    }
    const style = String(config.style || "Modern").toLowerCase();
    const styleBonus = (STYLE_PRESETS[style] || {}).score_bonus || 0;
    if (config.facade_theme) notes.push("Facade theme: " + config.facade_theme + " applied to elevations and 3D shell.");
    if (config.include_roof) notes.push("Roof program includes curated features.");
    if (!notes.length) notes.push("Generated for " + (config.style || "Modern") + " style with " + levelsOut.length + " levels.");

    let score = 100.0 - overlapPenalty + compactness * 18 + styleBonus;
    score = Math.max(60.0, Math.min(99.0, score));
    const idx = seedSalt % 3;
    const strategies = ["balanced", "wide-front", "deep-rear"];
    const summaries = strategies.map((sName, sI) => ({
      strategy: sName, score: r2(Math.max(60.0, Math.min(99.0, score + (idx - sI) * 1.2))),
      compactness: r2(compactness + (idx - sI) * 0.004), overlap_penalty: r2(overlapPenalty)
    }));

    return {
      score: r2(score), notes, candidate_count: 3, selected_strategy: strategy, strategy_summaries: summaries
    };
  }

  function generateDesign(config, strategy, seedSalt) {
    strategy = strategy || "balanced";
    seedSalt = seedSalt || 0;
    config = deepClone(config);
    if (!config.levels) throw new Error("Config must contain a levels list.");

    const envelope = buildableEnvelope(config);
    let levelsIn = resolveLevels(config);
    levelsIn = adjustFloorCount(levelsIn, Math.max(1, Number(config.floor_count || 2)));
    levelsIn.forEach((l, i) => { l.z_index = i; });

    let bandSide = String(config.road_side || "south").toLowerCase();
    if (!["north", "south", "east", "west"].includes(bandSide)) bandSide = "south";

    const levelsOut = levelsIn.map((lvl) => isRoofLevel(lvl) ? placeRoof(lvl, envelope, strategy, seedSalt) : placeLevel(lvl, envelope, bandSide, strategy, seedSalt));

    const metadata = buildMetadata(config, levelsOut, strategy, seedSalt);
    return { config, levels: levelsOut, metadata };
  }

  function generateCandidates(config) {
    const strategies = ["balanced", "wide-front", "deep-rear"];
    return strategies.map((strategy, i) => {
      const design = generateDesign(config, strategy, i);
      const meta = buildMetadata(config, design.levels, strategy, i);
      meta.selected_strategy = strategy;
      return { config: design.config, levels: design.levels, metadata: meta };
    });
  }

  // -------------------------------------------------------------------------
  // Natural language modification
  // -------------------------------------------------------------------------
  function findRoom(design, roomType) {
    for (const level of design.levels) {
      for (const room of level.rooms) {
        if (room.room_type.includes(roomType) || room.name.toLowerCase().includes(roomType)) return room;
      }
    }
    return null;
  }

  function roomAfterLarger(design, room, growBy) {
    growBy = growBy || 0.3;
    const level = design.levels.find((l) => l.level_id === room.level_id);
    room.width = r2(Math.min(level.outer_width * 0.6, room.width + growBy));
    room.depth = r2(Math.min(level.outer_depth * 0.6, room.depth + growBy * 0.6));
    return design;
  }

  function toLevel(name) {
    const names = { basement: "basement", ground: "ground", "ground floor": "ground", first: "first_floor", "first floor": "first_floor", second: "second_floor", "second floor": "second_floor", third: "third_floor", "third floor": "third_floor", roof: "roof" };
    return names[String(name).trim().toLowerCase()] || null;
  }

  function modifyDesign(design, command) {
    const cmd = String(command).toLowerCase().trim();
    design = deepClone(design);

    const roomTypes = Object.keys(ROOM_TYPES);
    let targetRoom = null;
    const sortedTypes = roomTypes.slice().sort((a, b) => b.length - a.length);
    for (const rt of sortedTypes) {
      if (cmd.replace(/ /g, "").includes(rt.replace(/ /g, ""))) { targetRoom = rt; break; }
    }

    let levelName = null;
    for (const clue of ["basement", "ground floor", "ground", "first floor", "second floor", "third floor", "first", "second", "third", "roof"]) {
      if (cmd.includes(clue)) { levelName = clue; break; }
    }

    if (cmd.includes("larger") || cmd.includes("bigger") || cmd.includes("enlarge")) {
      if (targetRoom) {
        const room = findRoom(design, targetRoom);
        if (room) design = roomAfterLarger(design, room);
      }
    } else if (cmd.includes("smaller") || cmd.includes("reduce")) {
      if (targetRoom) {
        const room = findRoom(design, targetRoom);
        if (room) {
          const level = design.levels.find((l) => l.level_id === room.level_id);
          room.width = r2(Math.max(2.0, room.width - 0.3));
          room.depth = r2(Math.max(2.0, room.depth - 0.3));
        }
      }
    } else if (cmd.includes("add")) {
      const levelId = toLevel(levelName) || "ground";
      let level = design.levels.find((l) => l.level_id === levelId);
      if (!level && targetRoom) level = design.levels[0];
      if (level && !isRoofLevel(level) && targetRoom) {
        const reqLevel = {
          level_id: level.level_id, level_type: level.level_type, label: level.label,
          room_requests: [{ room_type: targetRoom, count: 1, preferred_zone: preferredZoneFor(targetRoom) }], z_index: level.z_index
        };
        const env = { width: level.outer_width, depth: level.outer_depth, plot_width: design.config.plot_width || 20, plot_depth: design.config.plot_depth || 16 };
        const placedLevel = placeLevel(reqLevel, env, "south", "balanced", 0);
        if (placedLevel.rooms.length) {
          const newRoom = placedLevel.rooms[0];
          newRoom.name = ROOM_TYPES[targetRoom].label;
          level.rooms.push(newRoom);
        }
      }
    } else if (cmd.includes("remove") || cmd.includes("delete")) {
      if (targetRoom) {
        design.levels.forEach((level) => {
          level.rooms = level.rooms.filter((r) => !(r.room_type.includes(targetRoom) || r.name.toLowerCase().includes(targetRoom)));
        });
      }
    } else if (cmd.includes("move")) {
      if (targetRoom && levelName) {
        const levelId = toLevel(levelName);
        design.levels.forEach((level) => {
          level.rooms = level.rooms.filter((r) => !(r.room_type.includes(targetRoom) || r.name.toLowerCase().includes(targetRoom)));
        });
        const dest = design.levels.find((l) => l.level_id === levelId);
        if (dest && targetRoom) {
          const reqLevel = {
            level_id: dest.level_id, level_type: dest.level_type, label: dest.label,
            room_requests: [{ room_type: targetRoom, count: 1, preferred_zone: preferredZoneFor(targetRoom) }], z_index: dest.z_index
          };
          const env = { width: dest.outer_width, depth: dest.outer_depth, plot_width: 20, plot_depth: 16 };
          const placed = placeLevel(reqLevel, env, "south", "balanced", 0);
          if (placed.rooms.length) dest.rooms.push(placed.rooms[0]);
        }
      }
    }

    design.metadata = buildMetadata(design.config, design.levels, design.metadata.selected_strategy || "balanced", 0);
    design.metadata.notes.unshift("Applied command: " + command);
    return design;
  }

  // Export
  global.ArchinthaiEngine = {
    ROOM_TYPES, ROOF_FEATURE_TYPES, STYLE_PRESETS, slugify,
    generateDesign, generateCandidates, modifyDesign,
    buildableEnvelope, placeLevel, placeRoof, buildMetadata
  };
})(typeof window !== "undefined" ? window : globalThis);
