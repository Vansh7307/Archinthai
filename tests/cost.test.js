// Unit tests for the ArchinthAI Cost Estimation Engine.
const { test } = require('node:test');
const assert = require('node:assert');
const Cost = require('../static/js/cost');

function sampleDesign(overrides = {}) {
  return {
    config: {
      project_name: 'Test',
      plot_width: 20,
      plot_depth: 16,
      style: 'Modern',
      ...overrides.config,
    },
    levels: overrides.levels || [
      {
        level_id: 'ground',
        label: 'Ground Floor',
        level_type: 'ground',
        outer_width: 18.2,
        outer_depth: 13.9,
        rooms: [
          { room_id: 'r1', name: 'Living Room', room_type: 'Living Room', width: 5.0, depth: 4.0 },
          { room_id: 'r2', name: 'Kitchen', room_type: 'Kitchen', width: 3.2, depth: 3.0 },
          { room_id: 'r3', name: 'Bathroom', room_type: 'Bathroom', width: 2.0, depth: 2.0 },
        ],
      },
      {
        level_id: 'first_floor',
        label: 'First Floor',
        level_type: 'floor',
        outer_width: 18.2,
        outer_depth: 13.9,
        rooms: [
          { room_id: 'r5', name: 'Master Bedroom', room_type: 'Master Bedroom', width: 4.0, depth: 4.0 },
          { room_id: 'r6', name: 'Attached Bathroom', room_type: 'Attached Bathroom', width: 1.8, depth: 1.8 },
        ],
      },
    ],
  };
}

test('computes built area from levels', () => {
  const result = Cost.estimate(sampleDesign(), { class: 'standard', region: 'india', finish: 'standard' });
  const expected = Math.round(18.2 * 13.9 * 2);
  assert.strictEqual(result.summary.builtArea, expected);
});

test('produces a cost range with low <= high', () => {
  const result = Cost.estimate(sampleDesign(), { class: 'standard', region: 'india', finish: 'standard' });
  assert.ok(result.summary.costRange[0] > 0);
  assert.ok(result.summary.costRange[0] <= result.summary.costRange[1]);
});

test('luxury class costs more than economy', () => {
  const design = sampleDesign();
  const economy = Cost.estimate(design, { class: 'economy', region: 'india', finish: 'basic' });
  const luxury = Cost.estimate(design, { class: 'luxury', region: 'india', finish: 'luxury' });
  assert.ok(luxury.summary.costRange[0] > economy.summary.costRange[1], 'luxury should exceed economy');
});

test('regional factor reduces cost', () => {
  const design = sampleDesign();
  const us = Cost.estimate(design, { class: 'standard', region: 'us', finish: 'standard' });
  const india = Cost.estimate(design, { class: 'standard', region: 'india', finish: 'standard' });
  assert.ok(india.summary.costRange[1] < us.summary.costRange[1], 'india should be cheaper than US');
});

test('includes contingency in totals', () => {
  const result = Cost.estimate(sampleDesign(), { class: 'standard', region: 'india', finish: 'standard' });
  assert.ok(result.summary.contingency > 0);
  assert.ok(result.summary.totalWithContingency[0] > result.summary.costRange[0]);
});

test('produces line items and level breakdown', () => {
  const result = Cost.estimate(sampleDesign(), { class: 'standard', region: 'india', finish: 'standard' });
  assert.ok(Array.isArray(result.lines) && result.lines.length >= 5);
  assert.ok(Array.isArray(result.levelBreakdown) && result.levelBreakdown.length === 2);
});
