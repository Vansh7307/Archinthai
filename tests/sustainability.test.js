// Unit tests for the ArchinthAI Sustainability & Energy Scoring Engine.
const { test } = require('node:test');
const assert = require('node:assert');
const Sustain = require('../static/js/sustainability');

function sampleDesign(overrides = {}) {
  return {
    config: {
      project_name: 'Test',
      style: 'Modern',
      road_side: 'south',
      north_direction: 'up',
      ...overrides.config,
    },
    levels: overrides.levels || [
      {
        level_id: 'ground',
        label: 'Ground Floor',
        level_type: 'ground',
        rooms: [
          { room_id: 'r1', name: 'Living Room', room_type: 'Living Room', windows: ['south', 'north'] },
          { room_id: 'r2', name: 'Kitchen', room_type: 'Kitchen', windows: ['south'] },
        ],
      },
      {
        level_id: 'first_floor',
        label: 'First Floor',
        level_type: 'floor',
        rooms: [
          { room_id: 'r3', name: 'Bedroom', room_type: 'Bedroom', windows: ['north'] },
          { room_id: 'r4', name: 'Bedroom', room_type: 'Bedroom', windows: ['south'] },
        ],
      },
      {
        level_id: 'roof',
        label: 'Roof',
        level_type: 'roof',
        roof_features: [
          { feature_type: 'Solar Panels' },
          { feature_type: 'Terrace Garden' },
        ],
      },
    ],
  };
}

test('returns a score between 0 and 100', () => {
  const result = Sustain.score(sampleDesign(), { glazing: 'double' });
  assert.ok(result.score >= 0 && result.score <= 100);
});

test('returns a grade', () => {
  const result = Sustain.score(sampleDesign(), { glazing: 'double' });
  assert.ok(['A', 'B', 'C', 'D'].includes(result.grade));
});

test('solar + green roof boosts roof score', () => {
  const withFeatures = Sustain.score(sampleDesign(), { glazing: 'double' });
  const without = sampleDesign();
  without.levels[2].roof_features = [];
  const noFeatures = Sustain.score(without, { glazing: 'double' });
  assert.ok(withFeatures.breakdown.roof > noFeatures.breakdown.roof, 'solar roof should score higher');
});

test('triple glazing scores higher than single', () => {
  const design = sampleDesign();
  const single = Sustain.score(design, { glazing: 'single' });
  const triple = Sustain.score(design, { glazing: 'triple' });
  assert.ok(triple.breakdown.glazing > single.breakdown.glazing, 'triple glazing should be better');
});

test('produces findings and recommendations arrays', () => {
  const result = Sustain.score(sampleDesign(), { glazing: 'double' });
  assert.ok(Array.isArray(result.findings) && result.findings.length >= 6);
  assert.ok(Array.isArray(result.recommendations));
});
