// ArchinthAI Construction Cost Estimation Engine.
//
// Produces professional-level quantity take-off and cost estimates from a
// generated design, using per-unit rates by construction class, finish level,
// and a regional cost factor. This is the "quantity surveyor" role automated.

(function (global) {
  "use strict";

  // Per-square-meter base rates (USD / m²) by construction class.
  const BASE_RATES = {
    economy: { low: 620, high: 780, label: "Economy" },
    standard: { low: 820, high: 1080, label: "Standard" },
    premium: { low: 1150, high: 1500, label: "Premium" },
    luxury: { low: 1650, high: 2200, label: "Luxury" },
  };

  // Regional cost factors (multiplier on base).
  const REGION_FACTORS = {
    "north-america": 1.0,
    "united-states": 1.0,
    "us": 1.0,
    "europe": 0.95,
    "uk": 1.05,
    "australia": 1.1,
    "middle-east": 0.85,
    "asia": 0.62,
    "india": 0.45,
    "south-america": 0.55,
    "africa": 0.5,
    default: 0.8,
  };

  // Finish-level uplift per built area.
  const FINISH_UPLIFT = {
    basic: 1.0,
    standard: 1.0,
    premium: 1.18,
    luxury: 1.42,
  };

  // Per-fixture / per-feature costs (USD).
  const FIXTURE_COSTS = {
    bathroom: 4200,
    "attached bathroom": 3800,
    kitchen: 9500,
    parking: 1800,
    "water tank": 900,
    "solar panels": 4200,
    "terrace garden": 2600,
    "sit-out area": 2100,
    gym: 3200,
    "home theater": 4800,
  };

  /**
   * Estimate construction cost for a design.
   * @param {object} design - Generated design {config, levels, metadata}
   * @param {object} opts - { class: 'standard', region: 'india', finish: 'standard' }
   * @returns {object} cost report
   */
  function estimate(design, opts) {
    opts = opts || {};
    const config = design.config || {};
    const levels = design.levels || [];

    const buildClass = String(opts.class || "standard").toLowerCase();
    const region = String(opts.region || "india").toLowerCase();
    const finish = String(opts.finish || "standard").toLowerCase();

    const rate = BASE_RATES[buildClass] || BASE_RATES.standard;
    const regionFactor = REGION_FACTORS[region] || REGION_FACTORS.default;
    const finishUplift = FINISH_UPLIFT[finish] || 1.0;

    // --- Quantity take-off ---
    let builtArea = 0; // total slab area (all levels)
    let roomCount = 0;
    let wallLength = 0;
    const levelBreakdown = levels.map((level) => {
      const levelArea = level.outer_width * level.outer_depth;
      builtArea += levelArea;
      const rooms = (level.rooms || []).length;
      roomCount += rooms;
      // estimate wall length from room perimeters
      let levelWalls = 0;
      (level.rooms || []).forEach((r) => {
        levelWalls += 2 * (r.width + r.depth);
      });
      wallLength += levelWalls;
      return {
        level: level.label,
        area: round(levelArea),
        rooms,
        wallLength: round(levelWalls),
      };
    });

    // --- Cost lines ---
    const baseCost = builtArea * rate.low;
    const baseCostHigh = builtArea * rate.high;
    const finishAdj = finishUplift;
    const regionAdj = regionFactor;

    const lines = [];

    // Structure & shell
    lines.push(costLine("Structure & shell", builtArea * 0.38 * rate.low, builtArea * 0.38 * rate.high, "× " + `${builtArea.toFixed(0)} m²`));

    // Finishes
    lines.push(costLine("Finishes & interiors", builtArea * 0.30 * rate.low * finishAdj, builtArea * 0.30 * rate.high * finishAdj, "finish ×" + finishUplift.toFixed(2)));

    // MEP (mechanical, electrical, plumbing)
    lines.push(costLine("MEP (M&E + plumbing)", builtArea * 0.18 * rate.low, builtArea * 0.18 * rate.high, "electrical/plumbing"));

    // Doors & windows
    lines.push(costLine("Doors & windows", builtArea * 0.10 * rate.low, builtArea * 0.10 * rate.high, "fenestration"));

    // Fixtures & features
    let fixtureTotal = 0;
    levels.forEach((level) => {
      (level.rooms || []).forEach((room) => {
        const key = normalizeName(room.room_type || room.name);
        if (FIXTURE_COSTS[key]) fixtureTotal += FIXTURE_COSTS[key];
      });
      (level.roof_features || []).forEach((f) => {
        const key = normalizeName(f.feature_type);
        if (FIXTURE_COSTS[key]) fixtureTotal += FIXTURE_COSTS[key];
      });
    });
    lines.push(costLine("Fixtures & special features", fixtureTotal, fixtureTotal * 1.25, "bathrooms, kitchen, solar, etc."));

    // Sum base (before regional factor)
    const subtotalLow = lines.reduce((s, l) => s + l.low, 0);
    const subtotalHigh = lines.reduce((s, l) => s + l.high, 0);

    // Regional adjustment
    const totalLow = subtotalLow * regionFactor;
    const totalHigh = subtotalHigh * regionFactor;

    // Cost per m²
    const perM2Low = builtArea ? totalLow / builtArea : 0;
    const perM2High = builtArea ? totalHigh / builtArea : 0;

    // Contingency (≈8%)
    const contingency = (totalLow + totalHigh) / 2 * 0.08;

    return {
      summary: {
        builtArea: round(builtArea),
        roomCount,
        estimatedWallLength: round(wallLength),
        buildClass: (BASE_RATES[buildClass] || BASE_RATES.standard).label,
        finish,
        region,
        regionFactor: round(regionFactor),
        costRange: [round(totalLow), round(totalHigh)],
        costPerM2Range: [round(perM2Low), round(perM2High)],
        contingency: round(contingency),
        totalWithContingency: [round(totalLow + contingency), round(totalHigh + contingency)],
      },
      lines,
      levelBreakdown,
      currency: "USD",
    };
  }

  function costLine(name, low, high, note) {
    return { name, low: round(low), high: round(high), note };
  }

  function normalizeName(name) {
    return String(name || "").toLowerCase().trim().replace(/\s+/g, " ");
  }

  function round(v) {
    return Math.round(v);
  }

  global.ArchinthaiCost = {
    estimate,
    BASE_RATES,
    REGION_FACTORS,
  };
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined" && module.exports) {
  module.exports = global.ArchinthaiCost;
}
