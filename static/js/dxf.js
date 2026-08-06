// ArchinthAI DXF Export Engine.
//
// Generates AutoCAD-compatible DXF files (R12 text format) for the 2D floor
// plans, so designs can be opened in AutoCAD, BricsCAD, LibreCAD, and other
// CAD/BIM tools. This is the critical "interoperability with the AEC
// industry" feature that makes designs usable by engineers and contractors.

(function (global) {
  "use strict";

  // R12 DXF entity writers
  function dxfHeader() {
    return [
      "0", "SECTION", "2", "HEADER",
      "9", "$ACADVER", "1", "AC1009",
      "9", "$INSUNITS", "70", "6",
      "0", "ENDSEC",
    ].join("\n");
  }

  function dxfTables() {
    return [
      "0", "SECTION", "2", "TABLES",
      "0", "TABLE", "2", "LTYPE", "70", "1",
      "0", "LTYPE", "2", "CONTINUOUS", "70", "0", "3", "", "72", "65", "73", "0", "40", "0.0",
      "0", "ENDTAB",
      "0", "TABLE", "2", "LAYER", "70", "6",
      "0", "LAYER", "2", "WALLS", "70", "0", "62", "7", "6", "CONTINUOUS",
      "0", "LAYER", "2", "ROOMS", "70", "0", "62", "1", "6", "CONTINUOUS",
      "0", "LAYER", "2", "DOORS", "70", "0", "62", "4", "6", "CONTINUOUS",
      "0", "LAYER", "2", "WINDOWS", "70", "0", "62", "5", "6", "CONTINUOUS",
      "0", "LAYER", "2", "DIMENSIONS", "70", "0", "62", "3", "6", "CONTINUOUS",
      "0", "LAYER", "2", "ANNOTATION", "70", "0", "62", "2", "6", "CONTINUOUS",
      "0", "ENDTAB",
      "0", "ENDSEC",
    ].join("\n");
  }

  function dxfEntities(entities) {
    const parts = ["0", "SECTION", "2", "ENTITIES"];
    entities.forEach((ent) => parts.push(ent));
    parts.push("0", "ENDSEC");
    return parts.join("\n");
  }

  function line(x1, y1, x2, y2, layer) {
    return [
      "0", "LINE", "8", layer || "0",
      "10", fmt(x1), "20", fmt(y1), "30", "0.0",
      "11", fmt(x2), "21", fmt(y2), "31", "0.0",
    ].join("\n");
  }

  function rect(x, y, w, h, layer) {
    return [
      line(x, y, x + w, y, layer),
      line(x + w, y, x + w, y + h, layer),
      line(x + w, y + h, x, y + h, layer),
      line(x, y + h, x, y, layer),
    ].join("\n");
  }

  function text(x, y, str, layer, height) {
    return [
      "0", "TEXT", "8", layer || "0",
      "10", fmt(x), "20", fmt(y), "30", "0.0",
      "40", fmt(height || 0.3), "1", sanitize(str || ""),
      "50", "0.0",
    ].join("\n");
  }

  function sanitize(str) {
    return String(str).replace(/[^\x20-\x7E]/g, "").replace(/&/g, "&amp;");
  }

  function fmt(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "0.0";
    return String(Math.round(v * 1000) / 1000);
  }

  /**
   * Build a DXF string for a single level.
   * @param {object} level - level object from design
   * @param {object} opts - { title, scale }
   */
  function levelToDxf(level, opts) {
    opts = opts || {};
    const entities = [];
    const scale = opts.scale || 1;
    const offX = 0, offY = 0;

    // Outer envelope
    entities.push(rect(offX, offY, level.outer_width, level.outer_depth, "WALLS"));

    if (level.level_type === "roof") {
      (level.roof_features || []).forEach((f) => {
        entities.push(rect(f.x, f.y, f.width, f.depth, "ROOMS"));
        entities.push(text(f.x + f.width / 2, f.y + f.depth / 2, f.name, "ANNOTATION", 0.3));
      });
    } else {
      (level.rooms || []).forEach((room) => {
        entities.push(rect(room.x, room.y, room.width, room.depth, "ROOMS"));
        entities.push(text(room.x + room.width / 2, room.y + room.depth / 2,
          `${room.name} ${room.width.toFixed(1)}x${room.depth.toFixed(1)}`, "ANNOTATION", 0.3));

        // Door markers
        const plan = openingPlanForDxf(level, room);
        if (plan.door) drawDoorDxf(entities, room, plan.door);
        (plan.windows || []).forEach((side) => drawWindowDxf(entities, room, side));
      });
    }

    // Dimensions
    entities.push(line(offX, offY - 0.8, level.outer_width, offY - 0.8, "DIMENSIONS"));
    entities.push(text(level.outer_width / 2, offY - 1.1, `${level.outer_width.toFixed(1)} m`, "DIMENSIONS", 0.3));
    entities.push(line(offX - 0.8, offY, offX - 0.8, level.outer_depth, "DIMENSIONS"));
    entities.push(text(offX - 1.2, level.outer_depth / 2, `${level.outer_depth.toFixed(1)} m`, "DIMENSIONS", 0.3));

    // Title
    entities.push(text(offX, level.outer_depth + 1.2,
      `${opts.title || level.label}  |  ArchinthAI  |  Scale 1:${Math.round(scale * 100)}`, "ANNOTATION", 0.4));

    return [dxfHeader(), dxfTables(), dxfEntities(entities), "0", "EOF"].join("\n");
  }

  // Reuse the plan-opening logic concept (simplified, layer-appropriate).
  function openingPlanForDxf(level, room) {
    const eps = 0.18;
    const boundary = {
      north: room.y <= eps,
      south: room.y + room.depth >= level.outer_depth - eps,
      west: room.x <= eps,
      east: room.x + room.width >= level.outer_width - eps,
    };
    let door = room.door_side;
    if (!door || door === "south") {
      const bandMid = level.circulation_band ? level.circulation_band.x + level.circulation_band.width / 2 : level.outer_width / 2;
      if (room.x + room.width <= bandMid) door = "east";
      else if (room.x >= bandMid) door = "west";
      else door = room.zone === "front" ? "south" : "north";
    }
    const windows = [];
    ["north", "south", "west", "east"].forEach((side) => { if (boundary[side]) windows.push(side); });
    if (/bath|storage|utility|laundry/i.test(room.room_type)) return { door, windows: windows.slice(0, 1) };
    return { door, windows: windows.slice(0, 2) };
  }

  function drawDoorDxf(entities, room, side) {
    const cx = room.x + room.width / 2;
    const cy = room.y + room.depth / 2;
    const w = 0.9;
    // Door swing arc
    if (side === "north" || side === "south") {
      const y = side === "north" ? room.y : room.y + room.depth;
      entities.push(line(cx - w / 2, y, cx + w / 2, y, "DOORS"));
      entities.push(arc(cx, y, w, side === "north" ? 180 : 0, side === "north" ? 270 : 90, "DOORS"));
    } else {
      const x = side === "west" ? room.x : room.x + room.width;
      entities.push(line(x, cy - w / 2, x, cy + w / 2, "DOORS"));
      entities.push(arc(x, cy, w, side === "west" ? 270 : 90, side === "west" ? 360 : 180, "DOORS"));
    }
  }

  function drawWindowDxf(entities, room, side) {
    const cx = room.x + room.width / 2;
    const cy = room.y + room.depth / 2;
    const w = 1.2;
    if (side === "north" || side === "south") {
      const y = side === "north" ? room.y : room.y + room.depth;
      entities.push(line(cx - w / 2, y, cx + w / 2, y, "WINDOWS"));
    } else {
      const x = side === "west" ? room.x : room.x + room.width;
      entities.push(line(x, cy - w / 2, x, cy + w / 2, "WINDOWS"));
    }
  }

  function arc(cx, cy, r, startDeg, endDeg, layer) {
    return [
      "0", "ARC", "8", layer || "0",
      "10", fmt(cx), "20", fmt(cy), "30", "0.0",
      "40", fmt(r),
      "50", fmt(startDeg), "51", fmt(endDeg),
    ].join("\n");
  }

  /**
   * Build a full multi-level DXF document.
   * @param {object} design - generated design
   */
  function designToDxf(design) {
    const levels = design.levels || [];
    const entities = [];
    let yOffset = 0;
    const blockH = levels.reduce((m, l) => Math.max(m, l.outer_depth), 0) + 4;

    levels.forEach((level) => {
      const offY = yOffset;
      const scale = 1;
      // Outer envelope
      entities.push(rect(0, offY, level.outer_width, level.outer_depth, "WALLS"));
      if (level.level_type === "roof") {
        (level.roof_features || []).forEach((f) => {
          entities.push(rect(f.x, f.y + offY, f.width, f.depth, "ROOMS"));
          entities.push(text(f.x + f.width / 2, f.y + offY + f.depth / 2, f.name, "ANNOTATION", 0.3));
        });
      } else {
        (level.rooms || []).forEach((room) => {
          entities.push(rect(room.x, room.y + offY, room.width, room.depth, "ROOMS"));
          entities.push(text(room.x + room.width / 2, room.y + offY + room.depth / 2,
            room.name, "ANNOTATION", 0.3));
          const plan = openingPlanForDxf(level, room);
          if (plan.door) drawDoorOffsetDxf(entities, room, plan.door, offY);
          (plan.windows || []).forEach((side) => drawWindowOffsetDxf(entities, room, side, offY));
        });
      }
      entities.push(text(0, offY + level.outer_depth + 1.0, level.label, "ANNOTATION", 0.4));
      yOffset += blockH;
    });

    return [dxfHeader(), dxfTables(), dxfEntities(entities), "0", "EOF"].join("\n");
  }

  function drawDoorOffsetDxf(entities, room, side, offY) {
    const cx = room.x + room.width / 2;
    const cy = room.y + offY + room.depth / 2;
    const w = 0.9;
    if (side === "north" || side === "south") {
      const y = room.y + offY + (side === "north" ? 0 : room.depth);
      entities.push(line(cx - w / 2, y, cx + w / 2, y, "DOORS"));
    } else {
      const x = side === "west" ? room.x : room.x + room.width;
      entities.push(line(x, cy - w / 2, x, cy + w / 2, "DOORS"));
    }
  }

  function drawWindowOffsetDxf(entities, room, side, offY) {
    const cx = room.x + room.width / 2;
    const cy = room.y + offY + room.depth / 2;
    const w = 1.2;
    if (side === "north" || side === "south") {
      const y = room.y + offY + (side === "north" ? 0 : room.depth);
      entities.push(line(cx - w / 2, y, cx + w / 2, y, "WINDOWS"));
    } else {
      const x = side === "west" ? room.x : room.x + room.width;
      entities.push(line(x, cy - w / 2, x, cy + w / 2, "WINDOWS"));
    }
  }

  global.ArchinthaiDxf = {
    levelToDxf,
    designToDxf,
  };
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined" && module.exports) {
  module.exports = global.ArchinthaiDxf;
}
