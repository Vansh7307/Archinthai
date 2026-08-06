// ArchinthAI Sustainability & Energy Scoring Engine.
//
// Evaluates passive-design qualities of a generated building: solar
// orientation, window-to-wall ratio, daylighting, cross-ventilation,
// thermal mass, glazing performance, and roof features (solar, green roof).
// Produces a 0-100 sustainability score with recommendations.

(function (global) {
  "use strict";

  const CARDINALS = {
    north: { solar: 0.35, daylight: 0.5, label: "North" },
    south: { solar: 0.6, daylight: 0.9, label: "South" },
    east: { solar: 0.75, daylight: 0.95, label: "East" },
    west: { solar: 0.55, daylight: 0.8, label: "West" },
  };

  const GLAZING_U = {
    "single": 5.8,
    "double": 2.7,
    "triple": 1.6,
    "low-e": 1.8,
  };

  function score(design, opts) {
    opts = opts || {};
    const config = design.config || {};
    const levels = design.levels || [];
    const findings = [];
    let total = 0;
    const weights = {
      orientation: 0.22,
      daylight: 0.2,
      glazing: 0.16,
      ventilation: 0.14,
      thermalMass: 0.1,
      roof: 0.18,
    };

    // ---- Orientation ----
    const roadSide = String(config.road_side || "south").toLowerCase();
    const northDir = String(config.north_direction || "up").toLowerCase();
    // Determine the true solar exposure of the primary facade.
    const primary = resolvePrimaryFacade(roadSide, northDir);
    const orientScore = CARDINALS[primary] ? CARDINALS[primary].solar : 0.5;
    total += orientScore * weights.orientation;
    findings.push(find(`Orientation`, orientScore, primary,
      primary === "south" || primary === "east"
        ? "Excellent solar orientation for daylight & passive warmth."
        : "Consider rotating the plan to maximize south/east exposure."));

    // ---- Daylight / window-to-wall ----
    const allRooms = levels.reduce((a, l) => a.concat(l.rooms || []), []);
    const litRooms = allRooms.filter((r) => Array.isArray(r.windows) && r.windows.length > 0);
    const occupancyRooms = allRooms.filter((r) => /living|bedroom|study|office|dining|family|kitchen|lounge/i.test(r.room_type));
    const daylit = occupancyRooms.filter((r) => Array.isArray(r.windows) && r.windows.length >= 1);
    const daylightRatio = occupancyRooms.length ? daylit.length / occupancyRooms.length : 0;
    total += daylightRatio * weights.daylight;
    findings.push(find(`Daylight`, daylightRatio, `${daylit.length}/${occupancyRooms.length} occupied rooms daylit`,
      daylightRatio >= 0.8 ? "Good daylight penetration." : "Increase window area in occupied rooms."));

    // ---- Glazing ----
    const glazingType = String(opts.glazing || "double").toLowerCase();
    const uValue = GLAZING_U[glazingType] || GLAZING_U.double;
    const glazingScore = Math.max(0, Math.min(1, (5.8 - uValue) / (5.8 - 1.4)));
    total += glazingScore * weights.glazing;
    findings.push(find(`Glazing`, glazingScore, `${glazingType} glazing (U=${uValue.toFixed(2)})`,
      uValue <= 2.7 ? "Good thermal performance." : "Upgrade to double or low-e glazing."));

    // ---- Cross ventilation ----
    const ventLevels = levels.filter((lv) => {
      const front = (lv.rooms || []).some((r) => Array.isArray(r.windows) && (r.windows.includes("south") || r.windows.includes("north")));
      const back = (lv.rooms || []).some((r) => Array.isArray(r.windows) && (r.windows.includes("north") || r.windows.includes("south")));
      return front && back;
    });
    const ventRatio = levels.length ? ventLevels.length / levels.length : 0;
    total += ventRatio * weights.ventilation;
    findings.push(find(`Cross-ventilation`, ventRatio, `${ventLevels.length}/${levels.length} floors have front-back airflow`,
      ventRatio >= 0.6 ? "Good passive cooling potential." : "Align windows on opposite facades for cross-ventilation."));

    // ---- Thermal mass ----
    const style = String(config.style || "modern").toLowerCase();
    const thermal = style.includes("luxury") || style.includes("contemporary") ? 0.7 : 0.55;
    total += thermal * weights.thermalMass;
    findings.push(find(`Thermal mass`, thermal, `${cap(style)} construction`,
      thermal >= 0.6 ? "High thermal mass helps regulate temperature." : "Medium thermal mass — consider insulated concrete."));

    // ---- Roof features ----
    const roof = levels.find((l) => l.level_type === "roof");
    const hasSolar = roof && (roof.roof_features || []).some((f) => /solar/i.test(f.feature_type));
    const hasGreen = roof && (roof.roof_features || []).some((f) => /garden|sit-out|terrace/i.test(f.feature_type));
    let roofScore = 0.3;
    if (hasSolar) roofScore += 0.35;
    if (hasGreen) roofScore += 0.2;
    roofScore = Math.min(1, roofScore);
    total += roofScore * weights.roof;
    findings.push(find(`Roof strategy`, roofScore, `${[hasSolar ? "solar" : null, hasGreen ? "green roof" : null].filter(Boolean).join(" + ") || "no features"}`,
      hasSolar && hasGreen ? "Excellent: solar + green roof." : "Add solar panels or a green roof to improve."));

    const finalScore = Math.round(total * 100);
    return {
      score: finalScore,
      grade: gradeFor(finalScore),
      findings,
      breakdown: {
        orientation: Math.round(orientScore * 100),
        daylight: Math.round(daylightRatio * 100),
        glazing: Math.round(glazingScore * 100),
        ventilation: Math.round(ventRatio * 100),
        thermalMass: Math.round(thermal * 100),
        roof: Math.round(roofScore * 100),
      },
      recommendations: findings.filter((f) => f.score < 0.6).map((f) => f.recommendation),
    };
  }

  function resolvePrimaryFacade(roadSide, northDir) {
    // Map road side + north direction to a true cardinal primary facade.
    // northDir 'up' means north is toward top of plan.
    const rot = { up: 0, right: 1, down: 2, left: 3 }[northDir] || 0;
    const order = ["north", "east", "south", "west"];
    const baseIdx = order.indexOf(roadSide);
    if (baseIdx < 0) return "south";
    const idx = (baseIdx - rot + 4) % 4;
    return order[idx];
  }

  function find(topic, scoreVal, detail, recommendation) {
    return { topic, score: scoreVal, detail, recommendation };
  }

  function gradeFor(score) {
    if (score >= 85) return "A";
    if (score >= 70) return "B";
    if (score >= 50) return "C";
    return "D";
  }

  function cap(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  global.ArchinthaiSustainability = { score, gradeFor };
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined" && module.exports) {
  module.exports = global.ArchinthaiSustainability;
}
