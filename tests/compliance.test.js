// Unit tests for the ArchinthAI Compliance Engine.
// Uses Node's built-in `node:test` runner (Node >= 18).
const { test } = require('node:test');
const assert = require('node:assert');
const Compliance = require('../static/js/compliance');

// Build a sample valid design object (mirrors engine output shape).
function sampleDesign(overrides = {}) {
  return {
    config: {
      project_name: 'Test',
      plot_width: 20,
      plot_depth: 16,
      style: 'Modern',
      setback_front: 1.5,
      setback_rear: 1.2,
      setback_left: 0.9,
      setback_right: 0.9,
      floor_count: 2,
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
          { room_id: 'r1', name: 'Living Room', room_type: 'Living Room', x: 0, y: 0, width: 5.0, depth: 4.0, windows: ['south'] },
          { room_id: 'r2', name: 'Kitchen', room_type: 'Kitchen', x: 5.2, y: 0, width: 3.2, depth: 3.0, windows: ['south'] },
          { room_id: 'r3', name: 'Bathroom', room_type: 'Bathroom', x: 0, y: 4.2, width: 2.0, depth: 2.0, windows: [] },
          { room_id: 'r4', name: 'Stair', room_type: 'Stair', x: 8.0, y: 4.0, width: 2.0, depth: 3.0, windows: [] },
        ],
      },
      {
        level_id: 'first_floor',
        label: 'First Floor',
        level_type: 'floor',
        outer_width: 18.2,
        outer_depth: 13.9,
        rooms: [
          { room_id: 'r5', name: 'Master Bedroom', room_type: 'Master Bedroom', x: 0, y: 0, width: 4.0, depth: 4.0, windows: ['north'] },
          { room_id: 'r6', name: 'Bedroom', room_type: 'Bedroom', x: 0, y: 4.2, width: 3.2, depth: 3.2, windows: ['north'] },
          { room_id: 'r7', name: 'Attached Bathroom', room_type: 'Attached Bathroom', x: 4.2, y: 0, width: 1.8, depth: 1.8, windows: [] },
          { room_id: 'r8', name: 'Stair', room_type: 'Stair', x: 8.0, y: 4.0, width: 2.0, depth: 3.0, windows: [] },
        ],
      },
    ],
  };
}

test('normalizes room type aliases', () => {
  assert.strictEqual(Compliance.normalizeRoomType('Bed Room'), 'bedroom');
  assert.strictEqual(Compliance.normalizeRoomType('Washroom'), 'bathroom');
  assert.strictEqual(Compliance.normalizeRoomType('Garage'), 'parking');
});

test('flags zero setbacks as violations', () => {
  const design = sampleDesign({ config: {
    setback_front: 0, setback_rear: 0, setback_left: 0, setback_right: 0,
  } });
  const result = Compliance.audit(design);
  const setbackFails = result.violationsList.filter((c) => c.category === 'Zoning' && c.id.startsWith('setback'));
  assert.ok(setbackFails.length >= 4, 'expected 4 zoning setback violations, got ' + setbackFails.length);
});

test('passes adequate setbacks', () => {
  const design = sampleDesign({ config: {
    setback_front: 1.5, setback_rear: 1.2, setback_left: 1.1, setback_right: 1.0,
  } });
  const result = Compliance.audit(design);
  const setbackPasses = result.checks.filter((c) => c.id.startsWith('setback') && c.severity === Compliance.SEVERITY.PASS);
  assert.ok(setbackPasses.length >= 4, 'expected 4 setback passes, got ' + setbackPasses.length);
});

test('detects undersized rooms', () => {
  const levels = JSON.parse(JSON.stringify(sampleDesign().levels));
  levels[0].rooms[1].width = 1.0; // kitchen too small
  const result = Compliance.audit({ config: sampleDesign().config, levels });
  const roomFails = result.violationsList.filter((c) => c.category === 'Room Standards');
  assert.ok(roomFails.length >= 1, 'expected a room-size violation');
});

test('detects missing stairs on upper floors', () => {
  const design = sampleDesign();
  design.levels[1].rooms = design.levels[1].rooms.filter((r) => !/stair/i.test(r.room_type));
  const result = Compliance.audit(design);
  const stairFails = result.violationsList.filter((c) => c.category === 'Egress' && /stair/i.test(c.title));
  assert.ok(stairFails.length >= 1, 'expected stair egress violation');
});

test('detects room overlaps', () => {
  const design = sampleDesign();
  design.levels[0].rooms[0].width = 7.0; // overlap into kitchen
  const result = Compliance.audit(design);
  const overlapFails = result.violationsList.filter((c) => c.category === 'Planning');
  assert.ok(overlapFails.length >= 1, 'expected overlap violation');
});

test('warns on bathroom ratio shortfall', () => {
  const design = sampleDesign();
  const bathrooms = design.levels[0].rooms.filter((r) => /bath/i.test(r.room_type));
  bathrooms.forEach((r) => { r.room_type = 'Storage'; r.name = 'Storage'; });
  const result = Compliance.audit(design);
  const ratioWarn = result.warningsList.find((c) => c.id === 'bathroom-ratio');
  assert.ok(ratioWarn, 'expected bathroom-ratio warning');
});

test('produces a score and status', () => {
  const design = sampleDesign();
  const result = Compliance.audit(design);
  assert.ok(typeof result.score === 'number');
  assert.ok(result.score >= 0 && result.score <= 100);
  assert.ok(['compliant', 'compliant-with-notes', 'non-compliant'].includes(result.status));
});
