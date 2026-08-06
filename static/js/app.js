const STORAGE_KEY = 'archinthai-studio-pro';
const DRAFT_KEY = 'archinthai-studio-pro-draft';

const state = {
  design: null,
  candidates: [],
  activeCandidateIndex: 0,
  activeLevelId: null,
  templates: [],
  exploded: false,
  shellVisible: false,
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  rootGroup: null,
  history: [],
  future: [],
  planView: null,
  drag: null,
  furnitureDrag: null,
  selectedRoomId: null,
  autosaveTimer: null,
  threeMode: 'webgl',
  cutawayMode: false,
  isolateActiveLevel: false,
  activeElevation: 'front',
  reliable3D: true,
  fallbackCamera: { yaw: -0.72, pitch: 0.48, zoom: 1, panX: 0, panY: 0 },
  // Furniture
  furnitureLibrary: null,
  activeFurnitureCat: 'seating',
  selectedFurnitureId: null,
  placingFurniture: false,
  // Cloud
  cloudEnabled: false,
};

const levelCatalog = [
  { level_id: 'basement', label: 'Basement', level_type: 'basement', room_requests: [
    { room_type: 'Parking', count: 1 }, { room_type: 'Storage', count: 1 }, { room_type: 'Laundry', count: 1 },
  ] },
  { level_id: 'ground', label: 'Ground Floor', level_type: 'ground', room_requests: [
    { room_type: 'Living Room', count: 1 }, { room_type: 'Dining Room', count: 1 }, { room_type: 'Kitchen', count: 1 },
    { room_type: 'Bathroom', count: 1 }, { room_type: 'Stair', count: 1 },
  ] },
  { level_id: 'first_floor', label: 'First Floor', level_type: 'floor', room_requests: [
    { room_type: 'Master Bedroom', count: 1 }, { room_type: 'Bedroom', count: 2 }, { room_type: 'Attached Bathroom', count: 2 }, { room_type: 'Balcony', count: 1 },
  ] },
  { level_id: 'second_floor', label: 'Second Floor', level_type: 'floor', room_requests: [
    { room_type: 'Guest Room', count: 1 }, { room_type: 'Study', count: 1 }, { room_type: 'Bathroom', count: 1 },
  ] },
  { level_id: 'third_floor', label: 'Third Floor', level_type: 'floor', room_requests: [
    { room_type: 'Office', count: 1 }, { room_type: 'Terrace Garden', count: 1 },
  ] },
  { level_id: 'roof', label: 'Roof', level_type: 'roof', room_requests: [
    { room_type: 'Solar Panels', count: 1 }, { room_type: 'Water Tank', count: 1 }, { room_type: 'Sit-out Area', count: 1 },
  ] },
];

const el = (id) => document.getElementById(id);
const planCanvas = el('planCanvas');
const ctx = planCanvas.getContext('2d');
const elevationCanvas = el('elevationCanvas');
const elevationCtx = elevationCanvas ? elevationCanvas.getContext('2d') : null;
const levelsContainer = el('levelsContainer');
const levelTemplate = el('levelTemplate');
const roomTemplate = el('roomTemplate');

function deepClone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const raw = await res.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
  if (!res.ok) throw new Error(data?.detail ? (typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)) : data?.raw || `HTTP ${res.status}`);
  return data;
}

function toast(message, isError = false) {
  const node = el('toast');
  node.textContent = message;
  node.style.borderColor = isError ? 'rgba(255,180,191,.32)' : 'rgba(255,255,255,.12)';
  node.style.color = isError ? '#ffd6dd' : '#eef4ff';
  node.classList.add('show');
  clearTimeout(node._timer);
  node._timer = setTimeout(() => node.classList.remove('show'), 2600);
}

function setStatus(message, isError = false) {
  const status = el('statusText');
  status.textContent = message;
  status.style.color = isError ? '#ffb4bf' : '';
  toast(message, isError);
}


function serializeStudioState() {
  return {
    config: collectConfig(),
    design: state.design,
    candidates: state.candidates,
    activeCandidateIndex: state.activeCandidateIndex,
    activeLevelId: state.activeLevelId,
  };
}

function updateAutosaveBadge(message, stateClass = '') {
  const badge = el('autosaveBadge');
  badge.textContent = message;
  badge.className = `autosave-badge ${stateClass}`.trim();
}

function queueAutosave() {
  clearTimeout(state.autosaveTimer);
  updateAutosaveBadge('Auto-save pending…', 'pending');
  state.autosaveTimer = setTimeout(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...serializeStudioState(), saved_at: new Date().toISOString() }));
      updateAutosaveBadge('Draft auto-saved', 'saved');
    } catch (err) {
      console.warn('Autosave failed', err);
      updateAutosaveBadge('Auto-save failed', 'error');
    }
  }, 500);
}

function restoreDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return false;
  try {
    const payload = JSON.parse(raw);
    if (payload.config) applyConfigToUI(payload.config);
    state.candidates = [];
    state.design = null;
    state.activeCandidateIndex = 0;
    state.activeLevelId = null;
    if (payload.design) {
      updateAutosaveBadge('Draft config restored • click Load to reopen saved design', 'saved');
    } else {
      updateAutosaveBadge(payload.saved_at ? `Draft restored • ${new Date(payload.saved_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}` : 'Draft restored', 'saved');
    }
    return true;
  } catch (err) {
    console.warn('Draft restore failed', err);
    updateAutosaveBadge('Draft restore failed', 'error');
    return false;
  }
}

function reflowActiveLevel() {
  const level = activeLevel();
  if (!state.design || !level || level.level_type === 'roof') return setStatus('Choose a non-roof level first.', true);
  pushHistory();
  solveLevelConstraints(level, level.rooms.find((r) => r.room_id === state.selectedRoomId) || null);
  drawPlan();
  renderInventory();
  renderThree();
  queueAutosave();
  setStatus(`Reflowed ${level.label}.`);
}

async function optimizeCurrentDesign() {
  if (!state.design) return setStatus('Generate a design first.', true);
  const button = el('optimizeDesignBtn');
  const sourceConfig = deepClone(state.design.config || collectConfig());
  try {
    pushHistory();
    button.disabled = true;
    button.textContent = 'Optimizing...';
    setStatus('Replanning from the current room program...');
    // Use the local client-side engine (no backend required)
    const candidates = window.ArchinthaiEngine.generateCandidates(sourceConfig);
    if (!Array.isArray(candidates) || !candidates.length) throw new Error('No optimized layouts returned.');
    state.candidates = candidates;
    state.activeCandidateIndex = candidates.reduce((best, c, idx) => Number(c?.metadata?.score || 0) > Number(candidates[best]?.metadata?.score || 0) ? idx : best, 0);
    state.design = structuredClone(candidates[state.activeCandidateIndex]);
    state.activeLevelId = state.design.levels.find((level) => level.level_id === state.activeLevelId)?.level_id || state.design.levels[0]?.level_id || null;
    renderDesign();
    renderCandidates();
    queueAutosave();
    setStatus(`Optimized layout selected: ${state.design.metadata.selected_strategy}.`);
  } catch (err) {
    console.error(err);
    setStatus(`Optimize failed: ${err.message}`, true);
  } finally {
    button.disabled = false;
    button.textContent = 'Optimize';
  }
}

function pushHistory() {
  if (!state.design) return;
  state.history.push(JSON.stringify(state.design));
  if (state.history.length > 25) state.history.shift();
  state.future = [];
}

function undoDesign() {
  if (!state.history.length) return setStatus('Nothing to undo.', true);
  if (state.design) state.future.push(JSON.stringify(state.design));
  state.design = JSON.parse(state.history.pop());
  state.activeLevelId = state.design.levels[0]?.level_id || null;
  renderDesign();
  queueAutosave();
  setStatus('Undo applied.');
}

function redoDesign() {
  if (!state.future.length) return setStatus('Nothing to redo.', true);
  if (state.design) state.history.push(JSON.stringify(state.design));
  state.design = JSON.parse(state.future.pop());
  state.activeLevelId = state.design.levels[0]?.level_id || null;
  renderDesign();
  queueAutosave();
  setStatus('Redo applied.');
}

function createRoomRow(name = '', count = 1, zone = '') {
  const row = roomTemplate.content.firstElementChild.cloneNode(true);
  row.querySelector('.room-name').value = name;
  row.querySelector('.room-count').value = count;
  row.querySelector('.room-zone').value = zone;
  row.querySelector('.remove-room-btn').addEventListener('click', () => row.remove());
  return row;
}

function buildEditableLevels(templateLevels = null) {
  const floorCount = Number(el('floorCount').value);
  const includeBasement = el('includeBasement').checked;
  const includeRoof = el('includeRoof').checked;
  const levels = templateLevels ? structuredClone(templateLevels) : structuredClone(levelCatalog);
  levelsContainer.innerHTML = '';

  levels.forEach((level) => {
    const shouldShow =
      (level.level_id === 'basement' && includeBasement) ||
      level.level_id === 'ground' ||
      (level.level_id === 'roof' && includeRoof) ||
      (['first_floor', 'second_floor', 'third_floor'].includes(level.level_id) && ['first_floor', 'second_floor', 'third_floor'].indexOf(level.level_id) < floorCount - 1);

    if (!shouldShow) return;

    const card = levelTemplate.content.firstElementChild.cloneNode(true);
    card.dataset.levelId = level.level_id;
    card.dataset.levelType = level.level_type;
    card.querySelector('.level-title').textContent = level.label;
    card.querySelector('.level-type').textContent = level.level_type.toUpperCase();
    const list = card.querySelector('.rooms-list');

    (level.room_requests || []).forEach((room) => list.appendChild(createRoomRow(room.room_type, room.count, room.preferred_zone || '')));
    card.querySelector('.add-room-btn').addEventListener('click', () => list.appendChild(createRoomRow('', 1, '')));
    card.querySelector('.quick-add-btn').addEventListener('click', () => {
      const quickRoom = el('quickRoomSelect').value;
      if (!quickRoom) return setStatus('Choose a quick-add room type first.', true);
      list.appendChild(createRoomRow(quickRoom, 1, ''));
    });
    levelsContainer.appendChild(card);
  });
}

function collectConfig() {
  const levels = [...levelsContainer.querySelectorAll('.level-card')].map((card) => ({
    level_id: card.dataset.levelId,
    label: card.querySelector('.level-title').textContent,
    level_type: card.dataset.levelType,
    enabled: true,
    room_requests: [...card.querySelectorAll('.room-row')].map((row) => {
      const rawCount = parseInt(row.querySelector('.room-count').value, 10);
      return ({
        room_type: row.querySelector('.room-name').value.trim(),
        count: Number.isFinite(rawCount) && rawCount > 0 ? rawCount : 1,
        preferred_zone: row.querySelector('.room-zone').value || null,
      });
    }).filter((item) => item.room_type),
  }));

  return {
    project_name: el('projectName').value.trim() || 'ArchinthAI Project',
    plot_width: Number(el('plotWidth').value),
    plot_depth: Number(el('plotDepth').value),
    style: el('style').value,
    facade_theme: el('facadeTheme').value,
    road_side: el('roadSide').value,
    north_direction: el('northDirection').value,
    setback_front: Number(el('setbackFront').value),
    setback_rear: Number(el('setbackRear').value),
    setback_left: Number(el('setbackLeft').value),
    setback_right: Number(el('setbackRight').value),
    include_basement: el('includeBasement').checked,
    floor_count: Number(el('floorCount').value),
    include_roof: el('includeRoof').checked,
    levels,
  };
}

function validateConfig(config) {
  if (!config.levels.length) throw new Error('Add at least one level.');
  const buildableW = config.plot_width - config.setback_left - config.setback_right;
  const buildableD = config.plot_depth - config.setback_front - config.setback_rear;
  if (buildableW < 7.2 || buildableD < 7.2) throw new Error('Setbacks leave too little buildable area.');
  if (!config.levels.some((level) => level.room_requests.length || level.level_type === 'roof')) {
    throw new Error('Add rooms before generating.');
  }
}

async function generateDesign() {
  const button = el('generateBtn');
  try {
    const config = collectConfig();
    validateConfig(config);
    button.disabled = true;
    button.textContent = 'Generating...';
    setStatus('Generating candidate designs...');
    // Use the local client-side engine (no backend required)
    let candidates;
    try {
      candidates = window.ArchinthaiEngine.generateCandidates(config);
    } catch (candidateErr) {
      console.warn('Candidate generation failed, falling back to single generation.', candidateErr);
      const design = window.ArchinthaiEngine.generateDesign(config, 'balanced', 0);
      candidates = [design];
    }
    state.candidates = Array.isArray(candidates) ? candidates : [];
    state.activeCandidateIndex = candidates.reduce((best, c, idx) => c.metadata.score > candidates[best].metadata.score ? idx : best, 0);
    state.design = structuredClone(candidates[state.activeCandidateIndex]);
    state.activeLevelId = state.design.levels[0]?.level_id || null;
    state.history = [];
    state.future = [];
    renderDesign();
    queueAutosave();
    renderCandidates();
    setStatus(`Generated ${candidates.length} candidate layouts.`);
  } catch (err) {
    console.error(err);
    setStatus(`Generate failed: ${err.message}`, true);
  } finally {
    button.disabled = false;
    button.textContent = 'Generate Design';
  }
}

async function applyCommand() {
  if (!state.design) return setStatus('Generate a design first.', true);
  const command = el('commandInput').value.trim();
  if (!command) return setStatus('Enter a command first.', true);
  const button = el('applyCommandBtn');
  try {
    pushHistory();
    button.disabled = true;
    button.textContent = 'Applying...';
    // Use the local client-side engine (no backend required)
    const design = window.ArchinthaiEngine.modifyDesign(state.design, command);
    state.design = design;
    renderDesign();
    queueAutosave();
    setStatus(`Applied: ${command}`);
  } catch (err) {
    console.error(err);
    setStatus(`Command failed: ${err.message}`, true);
  } finally {
    button.disabled = false;
    button.textContent = 'Apply';
  }
}

function renderDesign() {
  if (!state.design) { clearThreeContainer(); return; }
  const viewerHeading = document.querySelector('.viewer-card h2');
  if (viewerHeading) viewerHeading.textContent = getViewerTitle();
  el('scoreValue').textContent = Number(state.design.metadata.score || 0).toFixed(1);
  el('strategyValue').textContent = state.design.metadata.selected_strategy;
  el('levelCountValue').textContent = state.design.levels.length;
  renderTabs();
  renderElevationTabs();
  drawPlan();
  drawElevation();
  drawNotes();
  renderInventory();
  renderThree();
}

function renderTabs() {
  const tabs = el('floorTabs');
  tabs.innerHTML = '';
  state.design.levels.forEach((level) => {
    const btn = document.createElement('button');
    btn.className = `tab ${level.level_id === state.activeLevelId ? 'active' : ''}`;
    btn.textContent = level.label;
    btn.addEventListener('click', () => {
      state.activeLevelId = level.level_id;
      renderTabs();
      drawPlan();
      drawElevation();
      renderInventory();
      renderThree();
    });
    tabs.appendChild(btn);
  });
}


function renderElevationTabs() {
  const wrap = el('elevationTabs');
  if (!wrap) return;
  const views = ['front', 'rear', 'left', 'right'];
  wrap.innerHTML = '';
  views.forEach((view) => {
    const btn = document.createElement('button');
    btn.className = `tab ${state.activeElevation === view ? 'active' : ''}`;
    btn.textContent = view[0].toUpperCase() + view.slice(1);
    btn.addEventListener('click', () => {
      state.activeElevation = view;
      renderElevationTabs();
      drawElevation();
    });
    wrap.appendChild(btn);
  });
}

function drawElevation() {
  if (!elevationCtx || !elevationCanvas) return;
  elevationCtx.clearRect(0, 0, elevationCanvas.width, elevationCanvas.height);
  elevationCtx.fillStyle = '#eef4ff';
  elevationCtx.fillRect(0, 0, elevationCanvas.width, elevationCanvas.height);
  renderElevationTabs();
  if (!state.design) {
    elevationCtx.fillStyle = '#45628f';
    elevationCtx.font = '600 20px Inter, sans-serif';
    elevationCtx.textAlign = 'center';
    elevationCtx.fillText('Elevation preview will appear after you click Generate Design.', elevationCanvas.width / 2, elevationCanvas.height / 2);
    return;
  }

  const config = state.design.config || {};
  const activeView = state.activeElevation || 'front';
  const roadSide = (config.road_side || 'south').toLowerCase();
  const sideMap = { front: roadSide, rear: ({north:'south', south:'north', east:'west', west:'east'})[roadSide] || 'north', left: ({north:'west', south:'east', east:'north', west:'south'})[roadSide] || 'west', right: ({north:'east', south:'west', east:'south', west:'north'})[roadSide] || 'east' };
  const visibleSide = sideMap[activeView] || 'south';
  const occupiedLevels = state.design.levels.filter((lvl) => lvl.level_type !== 'roof');
  const roofLevel = state.design.levels.find((lvl) => lvl.level_type === 'roof');
  const levelCount = occupiedLevels.length || 1;
  const baseMetric = Math.max(8, ...occupiedLevels.map((l) => (visibleSide === 'north' || visibleSide === 'south') ? l.outer_width : l.outer_depth));
  const totalH = levelCount * 3.35 + 1.7;
  const groundY = elevationCanvas.height - 70;
  const pad = 54;
  const scale = Math.min((elevationCanvas.width - pad * 2) / baseMetric, (elevationCanvas.height - 120) / totalH);
  const buildW = baseMetric * scale;
  const x0 = (elevationCanvas.width - buildW) / 2;
  const style = String(config.style || 'Modern').toLowerCase();
  const theme = String(config.facade_theme || '').toLowerCase();
  let wallColor = '#f7f8fb', accent = '#4b6b93', glass = 'rgba(150,196,255,.62)', rail = '#6b7280', frame = '#405b84';
  if (style.includes('luxury') || theme.includes('stone')) { wallColor = '#faf5ef'; accent = '#8a6b56'; glass = 'rgba(179,212,248,.58)'; rail = '#74665d'; frame = '#635249'; }
  if (style.includes('minimal') || theme.includes('white')) { wallColor = '#fbfdff'; accent = '#324e79'; frame = '#3d5474'; }
  if (theme.includes('wood')) { accent = '#8b5a3c'; frame = '#744b30'; }

  const sky = elevationCtx.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, '#f8fbff'); sky.addColorStop(1, '#edf3ff');
  elevationCtx.fillStyle = sky; elevationCtx.fillRect(0, 0, elevationCanvas.width, groundY);
  elevationCtx.fillStyle = '#d8e6c6'; elevationCtx.fillRect(0, groundY, elevationCanvas.width, elevationCanvas.height - groundY);
  elevationCtx.fillStyle = '#bbcdb1'; elevationCtx.fillRect(0, groundY + 24, elevationCanvas.width, 6);
  const isRoadView = activeView === 'front';
  if (isRoadView) {
    elevationCtx.fillStyle = '#c4cad4';
    elevationCtx.fillRect(0, groundY + 30, elevationCanvas.width, 36);
    elevationCtx.strokeStyle = 'rgba(118,128,142,.4)';
    elevationCtx.setLineDash([18, 12]);
    elevationCtx.beginPath(); elevationCtx.moveTo(20, groundY + 48); elevationCtx.lineTo(elevationCanvas.width - 20, groundY + 48); elevationCtx.stroke(); elevationCtx.setLineDash([]);
  }

  const leftSet = Number(config.setback_left || 0);
  const rightSet = Number(config.setback_right || 0);
  elevationCtx.strokeStyle = 'rgba(37,79,142,.18)';
  elevationCtx.setLineDash([8,8]); elevationCtx.lineWidth = 2;
  elevationCtx.strokeRect(x0 - leftSet * scale, groundY - totalH * scale, buildW + (leftSet + rightSet) * scale, totalH * scale);
  elevationCtx.setLineDash([]);

  function roomTouchingSide(room, level) {
    const eps = 0.32;
    if (visibleSide === 'south') return room.y <= eps;
    if (visibleSide === 'north') return room.y + room.depth >= level.outer_depth - eps;
    if (visibleSide === 'west') return room.x <= eps;
    return room.x + room.width >= level.outer_width - eps;
  }
  function projectRoom(room, level) {
    if (visibleSide === 'south' || visibleSide === 'north') {
      return { start: room.x / level.outer_width, span: room.width / level.outer_width };
    }
    return { start: room.y / level.outer_depth, span: room.depth / level.outer_depth };
  }

  occupiedLevels.forEach((level, idx) => {
    const y = groundY - (idx + 1) * 3.35 * scale;
    const floorH = 3.1 * scale;
    roundRectCtx(elevationCtx, x0, y, buildW, floorH, idx === 0 ? 12 : 8);
    elevationCtx.fillStyle = wallColor; elevationCtx.fill();
    elevationCtx.strokeStyle = 'rgba(36,64,114,.18)'; elevationCtx.lineWidth = 1.6; elevationCtx.stroke();
    elevationCtx.fillStyle = accent; elevationCtx.fillRect(x0, y + floorH - 4, buildW, 4);

    const visibleRooms = (level.rooms || []).filter((room) => roomTouchingSide(room, level));
    const windows = visibleRooms.filter((r) => !/stair|storage|laundry|water tank|solar/i.test(r.room_type));
    const doorRoom = idx === 0 ? visibleRooms.find((r) => /living|foyer|entry|parking|guest/i.test(r.room_type)) || visibleRooms[0] : null;
    windows.forEach((room) => {
      const proj = projectRoom(room, level);
      const sx = x0 + proj.start * buildW;
      const sw = Math.max(28, proj.span * buildW);
      if (/balcony|terrace/i.test(room.room_type)) {
        const bx = sx + sw * 0.1;
        const bw = sw * 0.8;
        elevationCtx.fillStyle = accent;
        elevationCtx.fillRect(bx, y + floorH * 0.68, bw, 8);
        elevationCtx.strokeStyle = rail; elevationCtx.lineWidth = 2;
        elevationCtx.strokeRect(bx, y + floorH * 0.5, bw, floorH * 0.22);
        for (let k = 1; k < 4; k += 1) {
          elevationCtx.beginPath();
          elevationCtx.moveTo(bx + k * (bw / 4), y + floorH * 0.5);
          elevationCtx.lineTo(bx + k * (bw / 4), y + floorH * 0.72);
          elevationCtx.stroke();
        }
      }
      const glazingCount = Math.max(1, Math.min(3, Math.round(sw / 80)));
      for (let k = 0; k < glazingCount; k += 1) {
        const ww = Math.min(28, sw * 0.22);
        const gap = (sw - glazingCount * ww) / (glazingCount + 1);
        const wx = sx + gap + k * (ww + gap);
        const wy = y + floorH * 0.24;
        const wh = floorH * 0.34;
        elevationCtx.fillStyle = glass;
        elevationCtx.fillRect(wx, wy, ww, wh);
        elevationCtx.strokeStyle = frame; elevationCtx.lineWidth = 1.4; elevationCtx.strokeRect(wx, wy, ww, wh);
        elevationCtx.beginPath(); elevationCtx.moveTo(wx + ww / 2, wy); elevationCtx.lineTo(wx + ww / 2, wy + wh); elevationCtx.stroke();
      }
    });

    if (doorRoom) {
      const proj = projectRoom(doorRoom, level);
      const dx = x0 + proj.start * buildW + Math.max(10, proj.span * buildW * 0.16);
      const dw = Math.min(44, Math.max(22, proj.span * buildW * 0.24));
      elevationCtx.fillStyle = '#6a4b3a';
      elevationCtx.fillRect(dx, y + floorH * 0.44, dw, floorH * 0.52);
      elevationCtx.strokeStyle = '#4d3529'; elevationCtx.strokeRect(dx, y + floorH * 0.44, dw, floorH * 0.52);
      elevationCtx.strokeStyle = frame; elevationCtx.lineWidth = 2;
      elevationCtx.beginPath(); elevationCtx.arc(dx, y + floorH * 0.96, dw, -Math.PI/2, -0.05); elevationCtx.stroke();
    }

    const stairRoom = (level.rooms || []).find((room) => /stair/i.test(room.room_type));
    if (stairRoom) {
      const proj = projectRoom(stairRoom, level);
      const sx = x0 + proj.start * buildW + proj.span * buildW * 0.16;
      const sw = Math.max(18, proj.span * buildW * 0.32);
      elevationCtx.fillStyle = 'rgba(255,255,255,.26)';
      elevationCtx.fillRect(sx, y + floorH * 0.16, sw, floorH * 0.68);
      elevationCtx.strokeStyle = 'rgba(55,79,122,.4)'; elevationCtx.lineWidth = 1.2;
      for (let step = 0; step < 5; step += 1) {
        const yy = y + floorH * 0.8 - step * floorH * 0.12;
        elevationCtx.beginPath(); elevationCtx.moveTo(sx + 4, yy); elevationCtx.lineTo(sx + sw - 4, yy); elevationCtx.stroke();
      }
    }

    if (style.includes('modern')) { elevationCtx.fillStyle = accent; elevationCtx.fillRect(x0 + buildW * 0.08, y + floorH * 0.08, buildW * 0.06, floorH * 0.88); }
    if (style.includes('minimal')) { elevationCtx.fillStyle = 'rgba(255,255,255,.65)'; elevationCtx.fillRect(x0 + buildW * 0.72, y + floorH * 0.14, buildW * 0.16, floorH * 0.08); }
  });

  const topY = groundY - levelCount * 3.35 * scale;
  elevationCtx.fillStyle = accent;
  if (style.includes('minimal')) {
    elevationCtx.beginPath();
    elevationCtx.moveTo(x0 - 6, topY + 4);
    elevationCtx.lineTo(x0 + buildW * 0.48, topY - 26);
    elevationCtx.lineTo(x0 + buildW + 10, topY + 4);
    elevationCtx.closePath();
    elevationCtx.fill();
  } else {
    elevationCtx.fillRect(x0 - 4, topY - 8, buildW + 8, 8);
    elevationCtx.fillStyle = wallColor;
    elevationCtx.fillRect(x0 + buildW * 0.68, topY - 36, buildW * 0.16, 28);
    elevationCtx.strokeStyle = accent;
    elevationCtx.strokeRect(x0 + buildW * 0.68, topY - 36, buildW * 0.16, 28);
  }
  if (roofLevel) {
    const features = roofLevel.roof_features || [];
    features.slice(0, 3).forEach((feature, idx) => {
      const fx = x0 + buildW * (0.16 + idx * 0.22);
      elevationCtx.fillStyle = /garden|sit-out/i.test(feature.feature_type) ? '#9bc88d' : '#dfe7f2';
      elevationCtx.fillRect(fx, topY - 18 - idx * 2, 38, 14);
      elevationCtx.strokeStyle = frame; elevationCtx.strokeRect(fx, topY - 18 - idx * 2, 38, 14);
    });
  }

  elevationCtx.fillStyle = '#17325d'; elevationCtx.font = '700 20px Inter, sans-serif'; elevationCtx.textAlign = 'left';
  elevationCtx.fillText(`${activeView.toUpperCase()} ELEVATION`, 34, 34);
  elevationCtx.font = '500 13px Inter, sans-serif';
  elevationCtx.fillText(`Visible side: ${visibleSide.toUpperCase()} • Road side: ${roadSide.toUpperCase()} • Style: ${config.style || 'Modern'}`, 34, 56);
} 

function roundRectCtx(ctx2, x, y, w, h, r) {
  const rr = Math.min(r, w/2, h/2);
  ctx2.beginPath();
  ctx2.moveTo(x+rr, y);
  ctx2.arcTo(x+w, y, x+w, y+h, rr);
  ctx2.arcTo(x+w, y+h, x, y+h, rr);
  ctx2.arcTo(x, y+h, x, y, rr);
  ctx2.arcTo(x, y, x+w, y, rr);
  ctx2.closePath();
}

function activeLevel() {
  if (!state.design) return null;
  return state.design.levels.find((level) => level.level_id === state.activeLevelId) || state.design.levels[0] || null;
}

function activeLevelIndex() {
  if (!state.design) return -1;
  return state.design.levels.findIndex((level) => level.level_id === state.activeLevelId);
}

function viewerLevelVisible(level, index) {
  if (!state.isolateActiveLevel) return true;
  const active = activeLevel();
  if (!active) return true;
  return level.level_id === active.level_id;
}

function getViewerTitle() {
  const bits = [];
  if (state.cutawayMode) bits.push('Cutaway');
  if (state.isolateActiveLevel) bits.push('Isolate floor');
  if (!bits.length) return '3D conceptual model';
  return `3D conceptual model • ${bits.join(' • ')}`;
}

function drawPlan() {
  ctx.clearRect(0, 0, planCanvas.width, planCanvas.height);
  ctx.fillStyle = '#eef4ff';
  ctx.fillRect(0, 0, planCanvas.width, planCanvas.height);
  if (!state.design) return;
  const level = activeLevel();
  if (!level) return;

  const sheetPad = 32;
  const padding = 84;
  const scale = Math.min((planCanvas.width - padding * 2) / level.outer_width, (planCanvas.height - padding * 2) / level.outer_depth);
  const ox = (planCanvas.width - level.outer_width * scale) / 2;
  const oy = (planCanvas.height - level.outer_depth * scale) / 2;
  const wall = Math.max(8, scale * 0.14);
  state.planView = { scale, ox, oy, wall, levelId: level.level_id };

  drawSheet();
  drawGrid();
  ctx.save();
  ctx.translate(ox, oy);

  drawOuterEnvelope(level, scale, wall);

  if (level.level_type === 'roof') {
    level.roof_features.forEach((feature) => drawRoofFeature(feature, scale));
  } else {
    const topology = buildLevelTopology(level);
    drawCirculation(level, scale);
    drawCirculationGraph(level, topology, scale);
    level.rooms.forEach((room) => drawArchitecturalRoom(level, room, scale, wall));
    drawTopologyWalls(topology, scale, wall);
    drawTopologyOpenings(topology, scale, wall);
    drawCoreAnnotations(level, scale);
  }

  drawNorthArrow(level, scale);
  ctx.restore();
  drawDimensions(level, ox, oy, scale);
  drawTitle(level);

  function drawSheet() {
    ctx.save();
    ctx.fillStyle = '#f9fbff';
    roundRect(sheetPad / 2, sheetPad / 2, planCanvas.width - sheetPad, planCanvas.height - sheetPad, 24);
    ctx.fill();
    ctx.strokeStyle = 'rgba(38,84,160,.12)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawGrid() {
    ctx.save();
    ctx.strokeStyle = 'rgba(70,100,160,.07)';
    ctx.lineWidth = 1;
    for (let x = sheetPad; x < planCanvas.width - sheetPad; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, sheetPad);
      ctx.lineTo(x, planCanvas.height - sheetPad);
      ctx.stroke();
    }
    for (let y = sheetPad; y < planCanvas.height - sheetPad; y += 28) {
      ctx.beginPath();
      ctx.moveTo(sheetPad, y);
      ctx.lineTo(planCanvas.width - sheetPad, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawOuterEnvelope(level, scale, wall) {
    const w = level.outer_width * scale;
    const d = level.outer_depth * scale;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, d);
    ctx.fillStyle = '#0f274f';
    ctx.fillRect(0, 0, w, wall);
    ctx.fillRect(0, d - wall, w, wall);
    ctx.fillRect(0, 0, wall, d);
    ctx.fillRect(w - wall, 0, wall, d);
    ctx.strokeStyle = '#29477a';
    ctx.lineWidth = 1.25;
    ctx.strokeRect(0, 0, w, d);
  }

  function drawArchitecturalRoom(level, room, scale, wall) {
    const x = room.x * scale;
    const y = room.y * scale;
    const w = room.width * scale;
    const d = room.depth * scale;
    const inset = wall * 0.6;

    ctx.save();
    ctx.fillStyle = mixWithWhite(room.color || '#dbeafe', 0.86);
    ctx.fillRect(x + inset, y + inset, Math.max(0, w - inset * 2), Math.max(0, d - inset * 2));

    if (/bath|laundry|utility/i.test(room.room_type)) {
      ctx.strokeStyle = 'rgba(82,126,200,.18)';
      ctx.lineWidth = 1;
      for (let sx = x + inset; sx < x + w - inset; sx += 10) {
        ctx.beginPath();
        ctx.moveTo(sx, y + inset);
        ctx.lineTo(sx - Math.min(18, d - inset * 2), y + d - inset);
        ctx.stroke();
      }
    }
    if (/balcony|terrace/i.test(room.room_type)) {
      ctx.strokeStyle = 'rgba(76,142,91,.25)';
      ctx.lineWidth = 1;
      for (let sy = y + inset; sy < y + d - inset; sy += 10) {
        ctx.beginPath();
        ctx.moveTo(x + inset, sy);
        ctx.lineTo(x + w - inset, sy);
        ctx.stroke();
      }
    }

    ctx.strokeStyle = 'rgba(55,85,138,.08)';
    ctx.lineCap = 'butt';
    ctx.setLineDash([5, 6]);
    ctx.lineWidth = 0.9;
    ctx.strokeRect(x + inset * 0.65, y + inset * 0.65, Math.max(0, w - inset * 1.3), Math.max(0, d - inset * 1.3));
    ctx.setLineDash([]);

    if (/stair/i.test(room.room_type)) drawStairs(x, y, w, d);

    const centerX = x + w / 2;
    const centerY = y + d / 2 - 8;
    if (w > 72 && d > 48) {
      ctx.fillStyle = '#14305a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.max(11, Math.min(18, Math.min(w, d) / 7.5))}px Inter, sans-serif`;
      wrapTextCentered(room.name, centerX, centerY, w - 20, 18);
      ctx.fillStyle = 'rgba(20,48,90,.74)';
      ctx.font = '12px Inter, sans-serif';
      ctx.fillText(`${room.width.toFixed(1)}m × ${room.depth.toFixed(1)}m`, centerX, y + d - 18);
    }
    if (room.room_id === state.selectedRoomId) {
      ctx.strokeStyle = '#2f6bff';
      ctx.lineWidth = 2.4;
      ctx.strokeRect(x + inset * 0.42, y + inset * 0.42, Math.max(0, w - inset * 0.84), Math.max(0, d - inset * 0.84));
      const hs = Math.max(8, Math.min(16, scale * 0.34));
      ctx.fillStyle = '#2f6bff';
      ctx.fillRect(x + w - hs * 1.25, y + d - hs * 1.25, hs, hs);
    }
    ctx.restore();
  }

  function drawOpenings(level, scale, wall) {
    const filterValue = (el('roomFilterInput')?.value || '').trim().toLowerCase();
  const visibleRooms = level.rooms.filter((room) => !filterValue || room.name.toLowerCase().includes(filterValue) || room.room_type.toLowerCase().includes(filterValue));

  visibleRooms.forEach((room) => {
      const info = openingPlan(level, room);
      if (info.door) drawDoor(room, info.door, scale, wall);
      info.windows.forEach((side) => drawWindow(room, side, scale, wall));
    });
  }

  function drawCirculation(level, scale) {
    if (!level.circulation_band?.width || level.level_type === 'roof') return;
    const x = level.circulation_band.x * scale;
    const w = level.circulation_band.width * scale;
    ctx.save();
    ctx.fillStyle = 'rgba(120,136,184,.08)';
    ctx.fillRect(x, 0, w, level.outer_depth * scale);
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = 'rgba(88,108,160,.32)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, level.outer_depth * scale);
    ctx.moveTo(x + w, 0);
    ctx.lineTo(x + w, level.outer_depth * scale);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(39,68,122,.55)';
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillText('CIRCULATION', x + 8, 16);
    ctx.restore();
  }


  function drawCirculationGraph(level, topology, scale) {
    if (!level?.circulation_band?.width || !topology) return;
    const band = level.circulation_band;
    const spineX = (band.x + band.width / 2) * scale;
    const topPad = 18;
    const bottomPad = level.outer_depth * scale - 18;

    ctx.save();
    ctx.strokeStyle = 'rgba(74, 102, 165, 0.34)';
    ctx.lineWidth = 1.25;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(spineX, topPad);
    ctx.lineTo(spineX, bottomPad);
    ctx.stroke();
    ctx.setLineDash([]);

    const doors = (topology.openings || []).filter((op) => op.type === 'door');
    doors.forEach((op) => {
      let doorX;
      let doorY;
      if (op.orientation === 'h') {
        doorX = op.center * scale;
        doorY = op.coord * scale;
      } else {
        doorX = op.coord * scale;
        doorY = op.center * scale;
      }

      const midX = spineX + (doorX - spineX) * 0.55;
      ctx.beginPath();
      ctx.moveTo(spineX, doorY);
      ctx.lineTo(midX, doorY);
      ctx.lineTo(doorX, doorY);
      ctx.stroke();

      ctx.fillStyle = 'rgba(61, 90, 153, 0.55)';
      ctx.beginPath();
      ctx.arc(doorX, doorY, 2.2, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }

  function drawDoor(room, side, scale, wall) {
    const x = room.x * scale;
    const y = room.y * scale;
    const w = room.width * scale;
    const d = room.depth * scale;
    const doorW = Math.min(26, Math.max(18, Math.min(w, d) * 0.26));
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = wall + 3;
    if (side === 'north' || side === 'south') {
      const cx = x + w / 2;
      const py = side === 'north' ? y : y + d;
      ctx.beginPath();
      ctx.moveTo(cx - doorW / 2, py);
      ctx.lineTo(cx + doorW / 2, py);
      ctx.stroke();
      ctx.strokeStyle = '#264776';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - doorW / 2, py);
      ctx.lineTo(cx - doorW / 2, py + (side === 'north' ? doorW : -doorW));
      ctx.arc(cx - doorW / 2, py, doorW, side === 'north' ? 0 : -Math.PI / 2, side === 'north' ? Math.PI / 2 : 0, side !== 'north');
      ctx.stroke();
    } else {
      const cy = y + d / 2;
      const px = side === 'west' ? x : x + w;
      ctx.beginPath();
      ctx.moveTo(px, cy - doorW / 2);
      ctx.lineTo(px, cy + doorW / 2);
      ctx.stroke();
      ctx.strokeStyle = '#264776';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, cy - doorW / 2);
      ctx.lineTo(px + (side === 'west' ? doorW : -doorW), cy - doorW / 2);
      ctx.arc(px, cy - doorW / 2, doorW, side === 'west' ? Math.PI / 2 : Math.PI, side === 'west' ? 0 : Math.PI / 2, side !== 'west');
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawWindow(room, side, scale, wall) {
    const x = room.x * scale;
    const y = room.y * scale;
    const w = room.width * scale;
    const d = room.depth * scale;
    const windowW = Math.max(20, Math.min(42, (side === 'north' || side === 'south' ? w : d) * 0.3));
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = wall + 2;
    ctx.fillStyle = 'rgba(124,190,238,.18)';
    if (side === 'north' || side === 'south') {
      const cx = x + w / 2;
      const py = side === 'north' ? y : y + d;
      ctx.beginPath();
      ctx.moveTo(cx - windowW / 2, py);
      ctx.lineTo(cx + windowW / 2, py);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#57a4d8';
      ctx.beginPath();
      ctx.moveTo(cx - windowW / 2, py);
      ctx.lineTo(cx + windowW / 2, py);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, py - 7);
      ctx.lineTo(cx, py + 7);
      ctx.stroke();
    } else {
      const cy = y + d / 2;
      const px = side === 'west' ? x : x + w;
      ctx.beginPath();
      ctx.moveTo(px, cy - windowW / 2);
      ctx.lineTo(px, cy + windowW / 2);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#57a4d8';
      ctx.beginPath();
      ctx.moveTo(px, cy - windowW / 2);
      ctx.lineTo(px, cy + windowW / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px - 7, cy);
      ctx.lineTo(px + 7, cy);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawRoofFeature(feature, scale) {
    const x = feature.x * scale;
    const y = feature.y * scale;
    const w = feature.width * scale;
    const d = feature.depth * scale;
    ctx.save();
    ctx.fillStyle = /solar/i.test(feature.feature_type) ? '#d9ecff' : /garden|sit-out/i.test(feature.feature_type) ? '#dff4dd' : /headroom/i.test(feature.feature_type) ? '#eef2ff' : '#eef3fb';
    ctx.strokeStyle = '#314776';
    ctx.lineWidth = 2;
    roundRect(x, y, w, d, 12);
    ctx.fill();
    ctx.stroke();
    if (/solar/i.test(feature.feature_type)) {
      ctx.strokeStyle = '#4f83c2';
      for (let sx = x + 8; sx < x + w - 4; sx += 12) {
        ctx.beginPath();
        ctx.moveTo(sx, y + 8);
        ctx.lineTo(sx, y + d - 8);
        ctx.stroke();
      }
    }
    if (/garden/i.test(feature.feature_type)) {
      ctx.fillStyle = '#58a95d';
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.arc(x + 16 + i * 18, y + d / 2, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#14305a';
    ctx.font = '700 13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(feature.name, x + w / 2, y + d / 2);
    ctx.restore();
  }

  function drawStairs(x, y, w, d) {
    ctx.save();
    ctx.strokeStyle = 'rgba(25,45,88,.45)';
    ctx.lineWidth = 1.2;
    const steps = Math.max(5, Math.floor((d - 16) / 14));
    for (let i = 1; i < steps; i += 1) {
      const yy = y + 8 + ((d - 16) / steps) * i;
      ctx.beginPath();
      ctx.moveTo(x + 8, yy);
      ctx.lineTo(x + w - 8, yy);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + d - 12);
    ctx.lineTo(x + w / 2 + 18, y + d - 24);
    ctx.lineTo(x + w / 2 + 18, y + d - 18);
    ctx.lineTo(x + w / 2 + 30, y + d - 18);
    ctx.lineTo(x + w / 2 + 30, y + d - 30);
    ctx.lineTo(x + w / 2 + 24, y + d - 30);
    ctx.lineTo(x + w / 2 + 36, y + d - 48);
    ctx.closePath();
    ctx.fillStyle = 'rgba(25,45,88,.55)';
    ctx.fill();
    ctx.restore();
  }

  function drawDimensions(level, ox, oy, scale) {
    const w = level.outer_width * scale;
    const d = level.outer_depth * scale;
    ctx.save();
    ctx.strokeStyle = '#5976a8';
    ctx.fillStyle = '#3c5c92';
    ctx.lineWidth = 1.5;
    ctx.font = '600 12px Inter, sans-serif';

    const topY = oy - 28;
    ctx.beginPath();
    ctx.moveTo(ox, oy - 8);
    ctx.lineTo(ox, topY);
    ctx.moveTo(ox + w, oy - 8);
    ctx.lineTo(ox + w, topY);
    ctx.moveTo(ox, topY);
    ctx.lineTo(ox + w, topY);
    ctx.stroke();
    ctx.fillText(`${level.outer_width.toFixed(1)} m`, ox + w / 2 - 22, topY - 6);

    const rightX = ox + w + 28;
    ctx.beginPath();
    ctx.moveTo(ox + w + 8, oy);
    ctx.lineTo(rightX, oy);
    ctx.moveTo(ox + w + 8, oy + d);
    ctx.lineTo(rightX, oy + d);
    ctx.moveTo(rightX, oy);
    ctx.lineTo(rightX, oy + d);
    ctx.stroke();
    ctx.save();
    ctx.translate(rightX + 16, oy + d / 2 + 20);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${level.outer_depth.toFixed(1)} m`, 0, 0);
    ctx.restore();
    ctx.restore();
  }

  function drawNorthArrow(level, scale) {
    const x = level.outer_width * scale - 34;
    const y = 34;
    ctx.save();
    ctx.fillStyle = '#102a52';
    ctx.strokeStyle = '#102a52';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 12);
    ctx.lineTo(x - 8, y + 10);
    ctx.lineTo(x + 8, y + 10);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y + 10);
    ctx.lineTo(x, y + 28);
    ctx.stroke();
    ctx.font = '700 12px Inter, sans-serif';
    ctx.fillText('N', x - 4, y - 18);
    ctx.restore();
  }

  function drawTitle(level) {
    ctx.fillStyle = '#375387';
    ctx.font = '700 16px Inter, sans-serif';
    ctx.fillText(`${level.label} • ${level.outer_width.toFixed(1)}m × ${level.outer_depth.toFixed(1)}m`, 28, 34);
    ctx.font = '500 12px Inter, sans-serif';
    ctx.fillStyle = 'rgba(55,83,135,.78)';
    ctx.fillText('Architectural concept plan', 28, 54);
  }
}

function openingPlan(level, room) {
  const eps = 0.18;
  const boundary = {
    north: room.y <= eps,
    south: room.y + room.depth >= level.outer_depth - eps,
    west: room.x <= eps,
    east: room.x + room.width >= level.outer_width - eps,
  };
  const bandMid = level.circulation_band ? level.circulation_band.x + level.circulation_band.width / 2 : level.outer_width / 2;
  let door = room.door_side;
  if (!door || door === 'south') {
    if (room.x + room.width <= bandMid) door = 'east';
    else if (room.x >= bandMid) door = 'west';
    else door = room.zone === 'front' ? 'south' : 'north';
  }
  const windows = [];
  ['north', 'south', 'west', 'east'].forEach((side) => {
    if (boundary[side]) windows.push(side);
  });
  if (/bath|storage|utility|laundry/i.test(room.room_type)) return { door, windows: windows.slice(0, 1) };
  return { door, windows: windows.slice(0, 2) };
}


function buildLevelTopology(level) {
  if (!level || level.level_type === 'roof') return { segments: [], openings: [] };
  const lines = new Map();
  const openings = [];
  const addLine = (orientation, coord, start, end, external = false) => {
    const a = round2(Math.min(start, end));
    const b = round2(Math.max(start, end));
    if (b - a < 0.04) return;
    const key = `${orientation}:${round2(coord)}`;
    if (!lines.has(key)) lines.set(key, { orientation, coord: round2(coord), intervals: [], external });
    const bucket = lines.get(key);
    bucket.external = bucket.external || external;
    bucket.intervals.push([a, b]);
  };
  const outer = { width: level.outer_width, depth: level.outer_depth };

  level.rooms.forEach((room) => {
    addLine('h', room.y, room.x, room.x + room.width, room.y <= 0.18);
    addLine('h', room.y + room.depth, room.x, room.x + room.width, room.y + room.depth >= outer.depth - 0.18);
    addLine('v', room.x, room.y, room.y + room.depth, room.x <= 0.18);
    addLine('v', room.x + room.width, room.y, room.y + room.depth, room.x + room.width >= outer.width - 0.18);
    const plan = openingPlan(level, room);
    const side = plan.door;
    const doorSpan = /south|north/.test(side) ? room.width : room.depth;
    openings.push({
      type: 'door',
      orientation: side === 'north' || side === 'south' ? 'h' : 'v',
      coord: round2(side === 'north' ? room.y : side === 'south' ? room.y + room.depth : side === 'west' ? room.x : room.x + room.width),
      center: round2((side === 'north' || side === 'south') ? room.x + room.width / 2 : room.y + room.depth / 2),
      width: round2(Math.max(0.9, Math.min(1.15, doorSpan * 0.32))),
      roomId: room.room_id,
      external: (side === 'north' && room.y <= 0.18) || (side === 'south' && room.y + room.depth >= outer.depth - 0.18) || (side === 'west' && room.x <= 0.18) || (side === 'east' && room.x + room.width >= outer.width - 0.18),
    });
    plan.windows.forEach((sideW) => {
      const external = (sideW === 'north' && room.y <= 0.18) || (sideW === 'south' && room.y + room.depth >= outer.depth - 0.18) || (sideW === 'west' && room.x <= 0.18) || (sideW === 'east' && room.x + room.width >= outer.width - 0.18);
      if (!external) return;
      const span = /south|north/.test(sideW) ? room.width : room.depth;
      openings.push({
        type: 'window',
        orientation: sideW === 'north' || sideW === 'south' ? 'h' : 'v',
        coord: round2(sideW === 'north' ? room.y : sideW === 'south' ? room.y + room.depth : sideW === 'west' ? room.x : room.x + room.width),
        center: round2((sideW === 'north' || sideW === 'south') ? room.x + room.width / 2 : room.y + room.depth / 2),
        width: round2(Math.max(1.0, Math.min(1.8, span * 0.34))),
        roomId: room.room_id,
        external: true,
      });
    });
  });

  const segments = [];
  lines.forEach((bucket) => {
    const points = [...new Set(bucket.intervals.flat().map(round2))].sort((a, b) => a - b);
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      if (b - a < 0.04) continue;
      const mid = (a + b) / 2;
      const covering = bucket.intervals.filter(([s, e]) => mid > s + 1e-4 && mid < e - 1e-4).length;
      if (covering > 0) segments.push({ orientation: bucket.orientation, coord: bucket.coord, start: a, end: b, external: bucket.external || nearBoundary(bucket.orientation, bucket.coord, level) });
    }
  });

  const mergedSegments = mergeSegments(segments);
  const mergedOpenings = mergeOpenings(openings, mergedSegments);
  return { segments: mergedSegments, openings: mergedOpenings };
}

function round2(n) { return Math.round(n * 100) / 100; }
function nearBoundary(orientation, coord, level) {
  return orientation === 'h' ? Math.abs(coord) < 0.18 || Math.abs(coord - level.outer_depth) < 0.18 : Math.abs(coord) < 0.18 || Math.abs(coord - level.outer_width) < 0.18;
}
function mergeSegments(segments) {
  const grouped = new Map();
  segments.forEach((seg) => {
    const key = `${seg.orientation}:${round2(seg.coord)}:${seg.external ? 1 : 0}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(seg);
  });
  const merged = [];
  grouped.forEach((items) => {
    items.sort((a, b) => a.start - b.start);
    let cur = { ...items[0] };
    for (let i = 1; i < items.length; i += 1) {
      const item = items[i];
      if (item.start <= cur.end + 0.03) cur.end = Math.max(cur.end, item.end);
      else { merged.push(cur); cur = { ...item }; }
    }
    merged.push(cur);
  });
  return merged;
}
function mergeOpenings(openings, segments) {
  const result = [];
  openings.forEach((op) => {
    const carrier = segments.find((seg) => seg.orientation === op.orientation && Math.abs(seg.coord - op.coord) < 0.08 && op.center >= seg.start - 0.01 && op.center <= seg.end + 0.01);
    if (!carrier) return;
    const key = `${op.type}:${op.orientation}:${round2(op.coord)}:${round2(op.center)}`;
    if (!result.some((x) => `${x.type}:${x.orientation}:${round2(x.coord)}:${round2(x.center)}` === key)) result.push(op);
  });
  return result;
}

function drawTopologyWalls(topology, scale, wall) {
  ctx.save();
  topology.segments.filter((seg) => !seg.external).forEach((seg) => {
    const hasDoor = topology.openings.some((op) => op.type === 'door' && op.orientation === seg.orientation && Math.abs(op.coord - seg.coord) < 0.08 && op.center >= seg.start - 0.01 && op.center <= seg.end + 0.01);
    ctx.strokeStyle = seg.external ? '#0f274f' : '#17345f';
    ctx.lineWidth = seg.external ? wall : Math.max(4, wall * 0.72);
    drawSegmentWithCut(seg, topology.openings.filter((op) => op.orientation === seg.orientation && Math.abs(op.coord - seg.coord) < 0.08), scale, hasDoor ? true : false);
  });
  ctx.restore();
}

function drawTopologyOpenings(topology, scale, wall) {
  topology.openings.forEach((op) => {
    if (op.type === 'door') drawTopologyDoor(op, scale, wall);
    else drawTopologyWindow(op, scale, wall);
  });
}

function drawSegmentWithCut(seg, openings, scale) {
  const relevant = openings
    .map((op) => ({ ...op, a: op.center - op.width / 2, b: op.center + op.width / 2 }))
    .filter((op) => op.b > seg.start + 0.02 && op.a < seg.end - 0.02)
    .sort((a, b) => a.a - b.a);
  let cursor = seg.start;
  relevant.forEach((op) => {
    if (op.a > cursor + 0.02) drawLineSegment(seg.orientation, seg.coord, cursor, Math.min(op.a, seg.end), scale);
    cursor = Math.max(cursor, op.b);
  });
  if (cursor < seg.end - 0.02) drawLineSegment(seg.orientation, seg.coord, cursor, seg.end, scale);
}

function drawLineSegment(orientation, coord, start, end, scale) {
  ctx.beginPath();
  if (orientation === 'h') {
    ctx.moveTo(start * scale, coord * scale);
    ctx.lineTo(end * scale, coord * scale);
  } else {
    ctx.moveTo(coord * scale, start * scale);
    ctx.lineTo(coord * scale, end * scale);
  }
  ctx.stroke();
}

function drawTopologyDoor(op, scale, wall) {
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = wall + 3;
  if (op.orientation === 'h') {
    const y = op.coord * scale;
    const x1 = (op.center - op.width / 2) * scale;
    const x2 = (op.center + op.width / 2) * scale;
    ctx.beginPath();
    ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
    ctx.strokeStyle = '#264776'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y); ctx.lineTo(x1, y - op.width * scale * 0.7);
    ctx.arc(x1, y, op.width * scale, -Math.PI / 2, 0, false);
    ctx.stroke();
  } else {
    const x = op.coord * scale;
    const y1 = (op.center - op.width / 2) * scale;
    const y2 = (op.center + op.width / 2) * scale;
    ctx.beginPath();
    ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke();
    ctx.strokeStyle = '#264776'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y1); ctx.lineTo(x + op.width * scale * 0.7, y1);
    ctx.arc(x, y1, op.width * scale, 0, Math.PI / 2, false);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTopologyWindow(op, scale, wall) {
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = wall + 2;
  if (op.orientation === 'h') {
    const y = op.coord * scale;
    const x1 = (op.center - op.width / 2) * scale;
    const x2 = (op.center + op.width / 2) * scale;
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
    ctx.strokeStyle = '#57a4d8'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo((x1+x2)/2, y - 7); ctx.lineTo((x1+x2)/2, y + 7); ctx.stroke();
  } else {
    const x = op.coord * scale;
    const y1 = (op.center - op.width / 2) * scale;
    const y2 = (op.center + op.width / 2) * scale;
    ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke();
    ctx.strokeStyle = '#57a4d8'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 7, (y1+y2)/2); ctx.lineTo(x + 7, (y1+y2)/2); ctx.stroke();
  }
  ctx.restore();
}


function mixWithWhite(hex, ratio = 0.85) {
  const raw = String(hex || '#dbeafe').replace('#', '').trim();
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw.padEnd(6, 'f').slice(0, 6);
  const num = Number.parseInt(full, 16);
  const cr = Number.isFinite(num) ? ((num >> 16) & 255) : 219;
  const cg = Number.isFinite(num) ? ((num >> 8) & 255) : 234;
  const cb = Number.isFinite(num) ? (num & 255) : 254;
  const r = Math.round((1 - ratio) * cr + ratio * 255);
  const g = Math.round((1 - ratio) * cg + ratio * 255);
  const b = Math.round((1 - ratio) * cb + ratio * 255);
  return `rgb(${r}, ${g}, ${b})`;
}


function wrapTextCentered(text, centerX, startY, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  const lines = [];
  for (let i = 0; i < words.length; i += 1) {
    const testLine = `${line}${words[i]} `;
    if (ctx.measureText(testLine).width > maxWidth && i > 0) {
      lines.push(line.trim());
      line = `${words[i]} `;
    } else {
      line = testLine;
    }
  }
  lines.push(line.trim());
  const totalHeight = lines.length * lineHeight;
  let y = startY - totalHeight / 2 + lineHeight / 2;
  lines.forEach((ln) => {
    ctx.fillText(ln, centerX, y);
    y += lineHeight;
  });
}

function roundRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function wrapText(text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  for (let i = 0; i < words.length; i += 1) {
    const testLine = `${line}${words[i]} `;
    if (ctx.measureText(testLine).width > maxWidth && i > 0) {
      ctx.fillText(line, x, y);
      line = `${words[i]} `;
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
}

function drawNotes() {
  const notes = el('notes');
  notes.innerHTML = '';
  if (!state.design) return;
  const notesList = state.design.metadata.notes.length ? state.design.metadata.notes : [
    `Generated for ${state.design.config.style} style with ${state.design.levels.length} levels.`,
    'Use AI refinement commands to enlarge, remove, add, or move rooms.',
  ];
  notesList.forEach((note) => {
    const div = document.createElement('div');
    div.className = 'note';
    div.textContent = note;
    notes.appendChild(div);
  });
}

function renderInventory() {
  const table = el('inventoryTable');
  table.innerHTML = '';
  if (!state.design) return;
  const level = activeLevel();
  if (!level) return;
  if (level.level_type === 'roof') {
    const head = document.createElement('div');
    head.className = 'inventory-row head';
    ['Feature', 'Type', 'Size', 'Area'].forEach((t) => { const c = document.createElement('div'); c.textContent = t; head.appendChild(c); });
    table.appendChild(head);
    level.roof_features.forEach((f) => {
      const row = document.createElement('div');
      row.className = 'inventory-row';
      [f.name, f.feature_type, `${f.width.toFixed(1)} × ${f.depth.toFixed(1)}`, `${(f.width * f.depth).toFixed(1)} m²`].forEach((text) => {
        const c = document.createElement('div'); c.textContent = text; row.appendChild(c);
      });
      table.appendChild(row);
    });
    el('summaryBadge').textContent = `${level.roof_features.length} item${level.roof_features.length === 1 ? '' : 's'}`;
    return;
  }

  const head = document.createElement('div');
  head.className = 'inventory-row head inventory-row-wide';
  ['Room', 'Type', 'Size', 'Area', 'Pin', 'Lock', 'Resize'].forEach((t) => { const c = document.createElement('div'); c.textContent = t; head.appendChild(c); });
  table.appendChild(head);

  const filterValue = (el('roomFilterInput')?.value || '').trim().toLowerCase();
  const visibleRooms = level.rooms.filter((room) => !filterValue || room.name.toLowerCase().includes(filterValue) || room.room_type.toLowerCase().includes(filterValue));

  visibleRooms.forEach((room) => {
    const row = document.createElement('div');
    row.className = `inventory-row inventory-row-wide ${room.room_id === state.selectedRoomId ? 'inventory-row-active' : ''}`;

    const roomCell = document.createElement('div');
    roomCell.innerHTML = `<strong>${room.name}</strong><div class="muted">${roomPinnedToAxis(room) ? `Pinned ${roomPinnedToAxis(room)}` : 'Auto placed'}</div>`;
    roomCell.style.cursor = 'pointer';
    roomCell.addEventListener('click', () => { state.selectedRoomId = room.room_id; drawPlan(); renderInventory(); });
    row.appendChild(roomCell);

    const typeCell = document.createElement('div'); typeCell.textContent = room.room_type; row.appendChild(typeCell);
    const sizeCell = document.createElement('div'); sizeCell.textContent = `${room.width.toFixed(1)} × ${room.depth.toFixed(1)}`; row.appendChild(sizeCell);
    const areaCell = document.createElement('div'); areaCell.textContent = `${(room.width * room.depth).toFixed(1)} m²`; row.appendChild(areaCell);

    const pinCell = document.createElement('div');
    const pinSelect = document.createElement('select');
    pinSelect.className = 'mini-select';
    ['','front','rear','left','right'].forEach((opt) => {
      const o = document.createElement('option'); o.value = opt; o.textContent = opt ? opt[0].toUpperCase() + opt.slice(1) : 'Auto'; if ((room.pin_side || '') === opt) o.selected = true; pinSelect.appendChild(o);
    });
    pinSelect.addEventListener('change', () => {
      pushHistory();
      room.pin_side = pinSelect.value || null;
      applyPinConstraint(room, level);
      solveLevelConstraints(level, room);
      drawPlan(); renderThree(); renderInventory();
      queueAutosave();
      setStatus(`${room.name} ${room.pin_side ? `pinned ${room.pin_side}` : 'returned to auto placement'}.`);
    });
    pinCell.appendChild(pinSelect); row.appendChild(pinCell);

    const lockCell = document.createElement('div');
    const lockBtn = document.createElement('button');
    lockBtn.className = `btn btn-ghost small-btn ${room.locked ? 'is-locked' : ''}`;
    lockBtn.textContent = room.locked ? 'Locked' : 'Free';
    lockBtn.addEventListener('click', () => {
      pushHistory();
      room.locked = !room.locked;
      lockBtn.textContent = room.locked ? 'Locked' : 'Free';
      renderInventory();
      drawPlan();
      queueAutosave();
      setStatus(`${room.name} ${room.locked ? 'locked' : 'unlocked'}.`);
    });
    lockCell.appendChild(lockBtn); row.appendChild(lockCell);

    const resizeCell = document.createElement('div');
    const growBtn = document.createElement('button');
    growBtn.className = 'btn btn-ghost small-btn';
    growBtn.textContent = '+0.3m';
    const shrinkBtn = document.createElement('button');
    shrinkBtn.className = 'btn btn-ghost small-btn';
    shrinkBtn.textContent = '-0.3m';
    const wrap = document.createElement('div');
    wrap.className = 'inline-actions';
    [growBtn, shrinkBtn].forEach(btn => wrap.appendChild(btn));
    const resize = (delta) => {
      pushHistory();
      const old = { width: room.width, depth: room.depth };
      room.width = Number(Math.max(1.8, Math.min(level.outer_width * 0.7, room.width + delta)).toFixed(2));
      room.depth = Number(Math.max(1.8, Math.min(level.outer_depth * 0.7, room.depth + delta * 0.7)).toFixed(2));
      clampRoomToLevel(room, level);
      solveLevelConstraints(level, room);
      if (overlapsAny(room, level.rooms)) { room.width = old.width; room.depth = old.depth; }
      drawPlan(); renderThree(); renderInventory();
      queueAutosave();
      setStatus(`${room.name} resized.`);
    };
    growBtn.addEventListener('click', () => resize(0.3));
    shrinkBtn.addEventListener('click', () => resize(-0.3));
    resizeCell.appendChild(wrap); row.appendChild(resizeCell);

    table.appendChild(row);
  });
  el('summaryBadge').textContent = `${visibleRooms.length}/${level.rooms.length} item${level.rooms.length === 1 ? '' : 's'}`;
}


function renderCandidates() {
  const wrap = el('candidateList');
  wrap.innerHTML = '';
  if (!state.candidates.length) return;
  state.candidates.forEach((candidate, index) => {
    const card = document.createElement('div');
    card.className = `candidate-card ${index === state.activeCandidateIndex ? 'active' : ''}`;
    card.innerHTML = `
      <div class="candidate-top">
        <div>
          <strong>${candidate.metadata.selected_strategy}</strong>
          <div class="muted">${candidate.config.style} • ${candidate.levels.length} levels</div>
        </div>
        <button class="btn btn-ghost small-btn">Use</button>
      </div>
      <div class="candidate-metrics">
        <div>Score<br><strong>${Number(candidate.metadata.score || 0).toFixed(1)}</strong></div>
        <div>Rooms<br><strong>${candidate.levels.reduce((sum, l) => sum + l.rooms.length, 0)}</strong></div>
        <div>Envelope<br><strong>${candidate.config.plot_width}×${candidate.config.plot_depth}</strong></div>
      </div>`;
    card.querySelector('button').addEventListener('click', () => selectCandidate(index));
    wrap.appendChild(card);
  });
}

function selectCandidate(index) {
  if (!state.candidates[index]) return;
  state.activeCandidateIndex = index;
  state.design = structuredClone(state.candidates[index]);
  state.activeLevelId = state.design.levels[0]?.level_id || null;
  renderDesign();
  renderCandidates();
  queueAutosave();
  setStatus(`Selected ${state.design.metadata.selected_strategy} candidate.`);
}

function roomAtCanvasPoint(px, py) {
  const level = activeLevel();
  if (!state.design || !level || level.level_type === 'roof' || !state.planView || state.planView.levelId !== level.level_id) return null;
  const { scale, ox, oy } = state.planView;
  const lx = (px - ox) / scale;
  const ly = (py - oy) / scale;
  return level.rooms.find((room) => lx >= room.x && lx <= room.x + room.width && ly >= room.y && ly <= room.y + room.depth) || null;
}

function getResizeHandleAtPoint(px, py) {
  const room = roomAtCanvasPoint(px, py);
  if (!room || !state.planView) return null;
  const { scale, ox, oy } = state.planView;
  const handle = Math.max(10, Math.min(18, scale * 0.42));
  const hx = ox + (room.x + room.width) * scale;
  const hy = oy + (room.y + room.depth) * scale;
  if (Math.abs(px - hx) <= handle && Math.abs(py - hy) <= handle) return room;
  return null;
}

function overlapsAny(room, rooms) {
  return rooms.some((other) => other !== room && !(room.x + room.width <= other.x + 1e-6 || other.x + other.width <= room.x + 1e-6 || room.y + room.depth <= other.y + 1e-6 || other.y + other.depth <= room.y + 1e-6));
}

function roomPinnedToAxis(room) {
  const pin = room.pin_side || room.zone || '';
  return ['front', 'rear', 'left', 'right'].includes(pin) ? pin : null;
}

function applyPinConstraint(room, level) {
  const pin = roomPinnedToAxis(room);
  const margin = 0.18;
  if (!pin) return;
  if (pin === 'front') room.y = margin;
  if (pin === 'rear') room.y = Math.max(margin, level.outer_depth - room.depth - margin);
  if (pin === 'left') room.x = margin;
  if (pin === 'right') room.x = Math.max(margin, level.outer_width - room.width - margin);
}

function clampRoomToLevel(room, level) {
  room.x = Math.max(0.12, Math.min(level.outer_width - room.width - 0.12, room.x));
  room.y = Math.max(0.12, Math.min(level.outer_depth - room.depth - 0.12, room.y));
}

function solveLevelConstraints(level, focusRoom = null) {
  if (!level || level.level_type === 'roof') return;
  level.rooms.forEach((room) => {
    applyPinConstraint(room, level);
    clampRoomToLevel(room, level);
  });
  for (let pass = 0; pass < 14; pass += 1) {
    let moved = false;
    for (let i = 0; i < level.rooms.length; i += 1) {
      const a = level.rooms[i];
      for (let j = i + 1; j < level.rooms.length; j += 1) {
        const b = level.rooms[j];
        const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.depth, b.y + b.depth) - Math.max(a.y, b.y);
        if (overlapX > 0 && overlapY > 0) {
          const moveX = overlapX <= overlapY;
          const delta = (moveX ? overlapX : overlapY) / 2 + 0.08;
          const target = focusRoom && (a.room_id === focusRoom.room_id || b.room_id === focusRoom.room_id)
            ? (a.room_id === focusRoom.room_id ? a : b)
            : (!a.locked ? a : (!b.locked ? b : a));
          const other = target === a ? b : a;
          if (moveX) {
            const dir = (target.x + target.width / 2) >= (other.x + other.width / 2) ? 1 : -1;
            if (!target.locked) target.x += delta * dir;
            else if (!other.locked) other.x -= delta * dir;
          } else {
            const dir = (target.y + target.depth / 2) >= (other.y + other.depth / 2) ? 1 : -1;
            if (!target.locked) target.y += delta * dir;
            else if (!other.locked) other.y -= delta * dir;
          }
          clampRoomToLevel(a, level); clampRoomToLevel(b, level);
          applyPinConstraint(a, level); applyPinConstraint(b, level);
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
}

function bindPlanInteractions() {
  const getPos = (evt) => {
    const rect = planCanvas.getBoundingClientRect();
    return { x: (evt.clientX - rect.left) * (planCanvas.width / rect.width), y: (evt.clientY - rect.top) * (planCanvas.height / rect.height) };
  };

  planCanvas.addEventListener('mousedown', (evt) => {
    const level = activeLevel();
    if (!state.design || !level || level.level_type === 'roof') return;
    const pos = getPos(evt);
    const resizeRoom = getResizeHandleAtPoint(pos.x, pos.y);
    const room = resizeRoom || roomAtCanvasPoint(pos.x, pos.y);
    if (!room) return;
    state.selectedRoomId = room.room_id;
    if (room.locked && !resizeRoom) {
      drawPlan(); renderInventory();
      return setStatus(`${room.name} is locked. Unlock it to move.`, true);
    }
    const { scale, ox, oy } = state.planView || {};
    const lx = (pos.x - ox) / scale;
    const ly = (pos.y - oy) / scale;
    state.drag = resizeRoom || evt.shiftKey
      ? { mode: 'resize', roomId: room.room_id, startX: lx, startY: ly, originalWidth: room.width, originalDepth: room.depth }
      : { mode: 'move', roomId: room.room_id, offsetX: lx - room.x, offsetY: ly - room.y, originalX: room.x, originalY: room.y };
    planCanvas.style.cursor = resizeRoom || evt.shiftKey ? 'nwse-resize' : 'grabbing';
    drawPlan(); renderInventory();
  });

  window.addEventListener('mousemove', (evt) => {
    const level = activeLevel();
    const pos = getPos(evt);
    if (!state.drag || !state.design || !level || !state.planView) {
      const resizeRoom = getResizeHandleAtPoint(pos.x, pos.y);
      const hoverRoom = roomAtCanvasPoint(pos.x, pos.y);
      planCanvas.style.cursor = resizeRoom ? 'nwse-resize' : (hoverRoom ? 'grab' : 'default');
      return;
    }
    const room = level.rooms.find((r) => r.room_id === state.drag.roomId);
    if (!room) return;
    const lx = (pos.x - state.planView.ox) / state.planView.scale;
    const ly = (pos.y - state.planView.oy) / state.planView.scale;
    if (state.drag.mode === 'move') {
      const nextX = Math.max(0, Math.min(level.outer_width - room.width, lx - state.drag.offsetX));
      const nextY = Math.max(0, Math.min(level.outer_depth - room.depth, ly - state.drag.offsetY));
      room.x = Number(nextX.toFixed(2));
      room.y = Number(nextY.toFixed(2));
      applyPinConstraint(room, level);
      solveLevelConstraints(level, room);
    } else {
      if (room.locked) return;
      const nextWidth = Math.max(1.8, Math.min(level.outer_width - room.x - 0.12, state.drag.originalWidth + (lx - state.drag.startX)));
      const nextDepth = Math.max(1.8, Math.min(level.outer_depth - room.y - 0.12, state.drag.originalDepth + (ly - state.drag.startY)));
      room.width = Number(nextWidth.toFixed(2));
      room.depth = Number(nextDepth.toFixed(2));
      clampRoomToLevel(room, level);
      solveLevelConstraints(level, room);
    }
    drawPlan();
    renderThree();
    renderInventory();
  });

  window.addEventListener('mouseup', () => {
    if (state.drag) setStatus(state.drag.mode === 'resize' ? 'Room resized on plan.' : 'Room moved on plan.');
    state.drag = null;
    planCanvas.style.cursor = 'default';
  });
}


function clearThreeContainer() {
  const container = el('threeContainer');
  if (container) container.innerHTML = '';
}

function initThree() {
  const container = el('threeContainer');
  if (!container) return false;
  try {
    if (typeof window.THREE === 'undefined' || !window.THREE.WebGLRenderer) throw new Error('Three.js not available');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeaf2ff);
    scene.fog = new THREE.Fog(0xeaf2ff, 60, 180);
    const width = Math.max(320, container.clientWidth || 960);
    const height = Math.max(320, container.clientHeight || 720);
    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 2000);
    camera.position.set(26, 22, 26);
    camera.lookAt(0, 4, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
    else if ('outputEncoding' in renderer && THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
    clearThreeContainer();
    container.appendChild(renderer.domElement);

    const controls = THREE.OrbitControls ? new THREE.OrbitControls(camera, renderer.domElement) : null;
    if (controls) {
      controls.enableDamping = true;
      controls.target.set(0, 5, 0);
      controls.minDistance = 6;
      controls.maxPolarAngle = Math.PI * 0.485;
      controls.minPolarAngle = Math.PI * 0.14;
    }

    scene.add(new THREE.AmbientLight(0xffffff, 0.72));
    const hemi = new THREE.HemisphereLight(0xf5fbff, 0xc3d0e8, 0.72);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.18);
    sun.position.set(16, 24, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -40;
    sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 40;
    sun.shadow.camera.bottom = -40;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xbfd4ff, 0.5);
    fill.position.set(-10, 12, -8);
    scene.add(fill);
    const grid = new THREE.GridHelper(120, 120, 0x9eb6e1, 0xdbe6fb);
    grid.position.y = -0.02;
    scene.add(grid);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    state.scene = scene;
    state.camera = camera;
    state.renderer = renderer;
    state.controls = controls;
    state.rootGroup = rootGroup;
    state.threeMode = 'webgl';

    function animate() {
      if (!state.renderer || state.threeMode !== 'webgl') return;
      requestAnimationFrame(animate);
      if (controls) controls.update();
      renderer.render(scene, camera);
    }
    animate();

    if (!window.__archinthaiResizeBound) {
      window.addEventListener('resize', () => {
        const c = el('threeContainer');
        if (!c) return;
        if (state.threeMode === 'webgl' && state.camera && state.renderer) {
          const w = Math.max(320, c.clientWidth || 960);
          const h = Math.max(320, c.clientHeight || 720);
          state.camera.aspect = w / h;
          state.camera.updateProjectionMatrix();
          state.renderer.setSize(w, h);
        } else if (state.design) {
          renderFallbackThree();
        }
      });
      window.__archinthaiResizeBound = true;
    }
    return true;
  } catch (err) {
    console.warn('WebGL 3D init failed, switching to fallback renderer.', err);
    state.scene = null;
    state.camera = null;
    state.renderer = null;
    state.controls = null;
    state.rootGroup = null;
    state.threeMode = 'fallback';
    renderFallbackThree();
    return false;
  }
}

function getFacadePreset(config = {}) {
  const style = String(config.style || '').toLowerCase();
  const theme = String(config.facade_theme || '').toLowerCase();
  const preset = {
    wallColor: 0xf9fbff,
    accentColor: 0xb8c6dc,
    roofColor: 0xd7deea,
    frameColor: 0x7f93b5,
    glassColor: 0x9fd8ff,
    groundColor: 0xd6e2c7,
    plinthColor: 0xcfd9ea,
    shellAccent: 'glass-fins',
    canopyDepth: 0.9,
    balconyStyle: 'glass',
    roofStyle: 'flat-parapet',
    bandCount: 1,
  };
  if (style.includes('minimal') || theme.includes('minimal')) {
    Object.assign(preset, { wallColor: 0xf4f1eb, accentColor: 0xbeac93, roofColor: 0xe1d5c7, frameColor: 0x6c6256, glassColor: 0xd7eefb, shellAccent: 'warm-band', canopyDepth: 0.72, balconyStyle: 'solid', roofStyle: 'gable', bandCount: 2 });
  } else if (style.includes('luxury') || theme.includes('stone')) {
    Object.assign(preset, { wallColor: 0xf7f3ef, accentColor: 0x9d8f86, roofColor: 0xd5ccc3, frameColor: 0x564f49, glassColor: 0xb8dbf0, shellAccent: 'stone-frame', canopyDepth: 1.1, balconyStyle: 'premium', roofStyle: 'terrace-lux', bandCount: 2 });
  } else if (style.includes('contemporary')) {
    Object.assign(preset, { wallColor: 0xf3f6fb, accentColor: 0x8297b8, roofColor: 0xd0d9e8, frameColor: 0x5f7696, glassColor: 0xabdbff, shellAccent: 'horizontal-fins', canopyDepth: 0.96, balconyStyle: 'mixed', roofStyle: 'pergola-flat', bandCount: 3 });
  } else if (style.includes('modern') || theme.includes('glass')) {
    Object.assign(preset, { wallColor: 0xf8fbff, accentColor: 0xaabbd4, roofColor: 0xd9e2ef, frameColor: 0x7289ac, glassColor: 0x9fd8ff, shellAccent: 'glass-fins', canopyDepth: 0.92, balconyStyle: 'glass', bandCount: 2 });
  }
  if (theme.includes('wood')) preset.accentColor = 0x9b7750;
  if (theme.includes('concrete')) preset.accentColor = 0xaab4c3;
  return preset;
}

function addLandscape(group, maxWidth, maxDepth, xOffset, zOffset, frameMaterial, glassMaterial) {
  const planterMat = new THREE.MeshStandardMaterial({ color: 0xc8d4b4, roughness: 0.94 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x7aaa73, roughness: 0.95 });
  const pathMat = new THREE.MeshStandardMaterial({ color: 0xe5eaf2, roughness: 0.98 });
  const path = new THREE.Mesh(new THREE.BoxGeometry(Math.max(2.2, maxWidth * 0.18), 0.03, 4.8), pathMat);
  path.position.set(0, 0.01, -zOffset + 2.4);
  group.add(path);
  [
    [-maxWidth / 2 - 2.2, -maxDepth / 2 - 1.8],
    [maxWidth / 2 + 2.2, -maxDepth / 2 - 1.6],
    [-maxWidth / 2 - 1.8, maxDepth / 2 + 1.8],
    [maxWidth / 2 + 1.9, maxDepth / 2 + 2.0],
  ].forEach(([x, z]) => {
    const planter = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.46, 0.42, 14), planterMat);
    planter.position.set(x, 0.2, z);
    planter.castShadow = true;
    group.add(planter);
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.7, 18, 14), leafMat);
    canopy.position.set(x, 1.0, z);
    canopy.castShadow = true;
    group.add(canopy);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.72, 10), frameMaterial);
    stem.position.set(x, 0.56, z);
    stem.castShadow = true;
    group.add(stem);
  });
}



function project3DPoint(x, y, z, scale, originX, originY) {
  const cam = state.fallbackCamera || { yaw: -0.72, pitch: 0.48, zoom: 1, panX: 0, panY: 0 };
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);

  const x1 = x * cy - z * sy;
  const z1 = x * sy + z * cy;
  const y1 = y * cp - z1 * sp;
  const z2 = y * sp + z1 * cp;

  const perspective = 1 / Math.max(0.45, 1 + z2 * 0.022);
  return {
    x: originX + cam.panX + x1 * scale * cam.zoom * perspective,
    y: originY + cam.panY - y1 * scale * cam.zoom * perspective,
    depth: z2,
  };
}

function drawProjectedPolygon(c, pts, fill, stroke) {
  c.beginPath();
  c.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) c.lineTo(pts[i].x, pts[i].y);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  c.strokeStyle = stroke;
  c.stroke();
}

function drawProjectedPrism(c, x, y, z, w, h, d, fill, stroke, scale, originX, originY) {
  const p000 = project3DPoint(x, y, z, scale, originX, originY);
  const p100 = project3DPoint(x + w, y, z, scale, originX, originY);
  const p110 = project3DPoint(x + w, y, z + d, scale, originX, originY);
  const p010 = project3DPoint(x, y, z + d, scale, originX, originY);
  const p001 = project3DPoint(x, y + h, z, scale, originX, originY);
  const p101 = project3DPoint(x + w, y + h, z, scale, originX, originY);
  const p111 = project3DPoint(x + w, y + h, z + d, scale, originX, originY);
  const p011 = project3DPoint(x, y + h, z + d, scale, originX, originY);

  const faces = [
    { key: 'bottom', depth: (p000.depth + p100.depth + p110.depth + p010.depth) / 4, pts: [p000, p100, p110, p010], fill: mixWithWhite(fill, 0.22) },
    { key: 'left', depth: (p000.depth + p010.depth + p011.depth + p001.depth) / 4, pts: [p000, p010, p011, p001], fill: mixWithWhite(fill, 0.15) },
    { key: 'right', depth: (p100.depth + p110.depth + p111.depth + p101.depth) / 4, pts: [p100, p110, p111, p101], fill: mixWithWhite(fill, 0.32) },
    { key: 'back', depth: (p010.depth + p110.depth + p111.depth + p011.depth) / 4, pts: [p010, p110, p111, p011], fill: mixWithWhite(fill, 0.08) },
    { key: 'front', depth: (p000.depth + p100.depth + p101.depth + p001.depth) / 4, pts: [p000, p100, p101, p001], fill: fill },
    { key: 'top', depth: (p001.depth + p101.depth + p111.depth + p011.depth) / 4, pts: [p001, p101, p111, p011], fill: mixWithWhite(fill, 0.42) },
  ].sort((a, b) => a.depth - b.depth);

  c.save();
  c.lineJoin = 'round';
  c.lineWidth = 1.25;
  for (const face of faces) drawProjectedPolygon(c, face.pts, face.fill, stroke);
  c.restore();
}

function drawProjectedShell(c, x, y, z, w, h, d, fill, stroke, scale, originX, originY, thickness = 0.12) {
  const t = Math.min(thickness, w / 3, d / 3);
  drawProjectedPrism(c, x, y, z, w, 0.08, d, mixWithWhite(fill, 0.55), stroke, scale, originX, originY);
  drawProjectedPrism(c, x, y, z, w, h, t, fill, stroke, scale, originX, originY);
  drawProjectedPrism(c, x, y, z + d - t, w, h, t, mixWithWhite(fill, 0.12), stroke, scale, originX, originY);
  drawProjectedPrism(c, x, y, z + t, t, h, Math.max(0.1, d - t * 2), mixWithWhite(fill, 0.18), stroke, scale, originX, originY);
  drawProjectedPrism(c, x + w - t, y, z + t, t, h, Math.max(0.1, d - t * 2), mixWithWhite(fill, 0.28), stroke, scale, originX, originY);
}

function drawFallbackLabel(c, x, y, z, text, scale, originX, originY) {
  const p = project3DPoint(x, y, z, scale, originX, originY);
  c.save();
  c.fillStyle = '#12325b';
  c.font = '600 11px Inter, Arial, sans-serif';
  c.textAlign = 'center';
  c.fillText(String(text || '').slice(0, 18), p.x, p.y);
  c.restore();
}

function resetFallbackCamera() {
  state.fallbackCamera = { yaw: -0.72, pitch: 0.48, zoom: 1, panX: 0, panY: 0 };
}

function updateThreeControlStates() {
  const explodeBtn = el('explodeBtn');
  const shellBtn = el('toggleShellBtn');
  const cutawayBtn = el('cutawayBtn');
  const isolateBtn = el('isolateLevelBtn');
  if (explodeBtn) explodeBtn.classList.toggle('active', !!state.exploded);
  if (shellBtn) shellBtn.classList.toggle('active', !!state.shellVisible);
  if (cutawayBtn) cutawayBtn.classList.toggle('active', !!state.cutawayMode);
  if (isolateBtn) isolateBtn.classList.toggle('active', !!state.isolateActiveLevel);
}

function bindFallbackThreeInteractions(canvas) {
  if (!canvas || canvas.dataset.bound === '1') return;
  canvas.dataset.bound = '1';
  canvas.style.cursor = 'grab';
  let drag = null;

  canvas.addEventListener('mousedown', (event) => {
    drag = { x: event.clientX, y: event.clientY, button: event.button, shift: event.shiftKey };
    canvas.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', (event) => {
    if (!drag || state.threeMode !== 'fallback' || !state.design) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (drag.button === 2 || drag.shift) {
      state.fallbackCamera.panX += dx;
      state.fallbackCamera.panY += dy;
    } else {
      state.fallbackCamera.yaw += dx * 0.01;
      state.fallbackCamera.pitch = Math.max(-1.1, Math.min(1.1, state.fallbackCamera.pitch + dy * 0.008));
    }
    renderFallbackThree();
  });

  window.addEventListener('mouseup', () => {
    drag = null;
    if (canvas.isConnected) canvas.style.cursor = 'grab';
  });

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.08 : 0.92;
    state.fallbackCamera.zoom = Math.max(0.5, Math.min(2.4, state.fallbackCamera.zoom * factor));
    renderFallbackThree();
  }, { passive: false });

  canvas.addEventListener('dblclick', () => {
    resetFallbackCamera();
    renderFallbackThree();
  });

  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
}

function renderFallbackThree() {
  const container = el('threeContainer');
  if (!container) return;
  let canvas = container.querySelector('canvas.archinthai-fallback-3d');
  if (!canvas) {
    clearThreeContainer();
    canvas = document.createElement('canvas');
    canvas.className = 'archinthai-fallback-3d';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);
  }
  const width = Math.max(320, container.clientWidth || 960);
  const height = Math.max(340, container.clientHeight || 720);
  canvas.width = width;
  canvas.height = height;
  state.threeMode = 'fallback';
  state.renderer = null;
  state.scene = null;
  state.camera = null;
  state.controls = null;
  state.rootGroup = null;
  if (!state.design) return;
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, width, height);
  const grad = c.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#eef4ff');
  grad.addColorStop(0.65, '#dce7f8');
  grad.addColorStop(1, '#d2dfef');
  c.fillStyle = grad;
  c.fillRect(0, 0, width, height);

  const maxWidth = Math.max(...state.design.levels.map((l) => l.outer_width), 1);
  const maxDepth = Math.max(...state.design.levels.map((l) => l.outer_depth), 1);
  const visibleLevels = state.design.levels.filter((l, i) => viewerLevelVisible(l, i));
  const levels = visibleLevels.length || 1;
  const scale = Math.min(width / (maxWidth + maxDepth + 12), height / (levels * 6.6 + maxWidth * 0.55 + maxDepth * 0.5 + 9)) * state.fallbackCamera.zoom;
  const originX = width * 0.52 + state.fallbackCamera.panX;
  const originY = height * 0.38 + state.fallbackCamera.panY;

  drawProjectedPrism(c, -maxWidth / 2 - 3.8, -0.12, -maxDepth / 2 - 3.8, maxWidth + 7.6, 0.2, maxDepth + 7.6, '#d9e5cd', '#a7b997', scale, originX, originY);
  drawProjectedPrism(c, -1.3, 0.01, -maxDepth / 2 - 2.9, 2.6, 0.03, 3.2, '#edf1f8', '#becadd', scale, originX, originY);

  visibleLevels.forEach((level, index) => {
    const realIndex = state.design.levels.findIndex((lvl) => lvl.level_id === level.level_id);
    const explodeY = state.exploded ? realIndex * 1.55 : 0;
    const explodeX = state.exploded ? (realIndex % 2 === 0 ? -0.55 * realIndex : 0.55 * realIndex) : 0;
    const explodeZ = state.exploded ? realIndex * 0.38 : 0;
    const yBase = realIndex * 3.7 + explodeY;
    const levelX = -maxWidth / 2 + explodeX;
    const levelZ = -maxDepth / 2 + explodeZ;
    drawProjectedPrism(c, levelX, yBase, levelZ, level.outer_width, 0.16, level.outer_depth, '#cfdaee', '#8ea3c5', scale, originX, originY);

    if (level.level_type !== 'roof') {
      if (state.shellVisible) {
        const shellDepthInset = state.cutawayMode ? Math.max(0.65, level.outer_depth * 0.24) : 0;
        const shellWidthInset = state.cutawayMode ? Math.max(0.65, level.outer_width * 0.16) : 0;
        const shellX = levelX + (state.cutawayMode ? shellWidthInset : 0);
        const shellZ = levelZ + (state.cutawayMode ? shellDepthInset : 0);
        const shellW = Math.max(0.8, level.outer_width - (state.cutawayMode ? shellWidthInset : 0));
        const shellD = Math.max(0.8, level.outer_depth - (state.cutawayMode ? shellDepthInset : 0));
        drawProjectedShell(c, shellX, yBase + 0.16, shellZ, shellW, 2.92, shellD, 'rgba(245,249,255,0.18)', '#7f97b7', scale, originX, originY, 0.14);
      }
      (level.rooms || []).forEach((room, roomIndex) => {
        const fill = room.color || '#dbeafe';
        const zInset = state.cutawayMode ? Math.min(room.depth * 0.34, 0.9) : 0;
        const xInset = state.cutawayMode ? Math.min(room.width * 0.12, 0.35) : 0;
        const roomX = room.x - maxWidth / 2 + explodeX + xInset;
        const zStart = room.y - maxDepth / 2 + explodeZ + zInset;
        const roomWidth = Math.max(0.5, room.width - xInset);
        const roomDepth = Math.max(0.5, room.depth - zInset);
        drawProjectedShell(c, roomX, yBase + 0.16, zStart, roomWidth, 2.5, roomDepth, fill, '#4c668f', scale, originX, originY, 0.11);
        const topPt = project3DPoint(roomX + roomWidth / 2, yBase + 0.22, zStart + roomDepth / 2, scale, originX, originY);
        c.fillStyle = mixWithWhite(fill, 0.72);
        c.beginPath();
        c.arc(topPt.x, topPt.y, Math.max(6, Math.min(20, roomWidth * scale * 0.08)), 0, Math.PI * 2);
        c.fill();
        if (roomIndex < 6 || state.isolateActiveLevel) {
          drawFallbackLabel(c, roomX + roomWidth / 2, yBase + 2.72, zStart + roomDepth / 2, room.name || room.room_type, scale, originX, originY);
        }
      });
      if (state.shellVisible) {
        const pDoor = project3DPoint(levelX + level.outer_width * 0.22, yBase + 0.18, levelZ + 0.03, scale, originX, originY);
        c.fillStyle = '#8d654f';
        c.fillRect(pDoor.x - 8, pDoor.y - 36, 16, 36);
        c.strokeStyle = '#4c668f'; c.strokeRect(pDoor.x - 8, pDoor.y - 36, 16, 36);
        const pWin = project3DPoint(levelX + level.outer_width * 0.72, yBase + 1.42, levelZ + 0.04, scale, originX, originY);
        c.fillStyle = 'rgba(137,195,255,.72)';
        c.fillRect(pWin.x - 18, pWin.y - 14, 36, 22);
        c.strokeStyle = '#6b84a8'; c.strokeRect(pWin.x - 18, pWin.y - 14, 36, 22);
      }
      const roofShade = project3DPoint(levelX + level.outer_width * 0.5, yBase + 2.92, levelZ + level.outer_depth * 0.5, scale, originX, originY);
      c.fillStyle = 'rgba(75,101,140,0.10)';
      c.fillRect(roofShade.x - level.outer_width * scale * 0.22, roofShade.y - 6, level.outer_width * scale * 0.42, 12);
    } else {
      drawProjectedPrism(c, -maxWidth / 2, yBase + 0.16, -maxDepth / 2, level.outer_width, 0.16, level.outer_depth, '#dbe4f2', '#90a5c5', scale, originX, originY);
      (level.roof_features || []).forEach((feature) => {
        drawProjectedPrism(c, feature.x - maxWidth / 2, yBase + 0.32, feature.y - maxDepth / 2, feature.width, Math.max(0.28, feature.height || 0.42), feature.depth, /garden|sit-out/i.test(feature.feature_type) ? '#b7dab0' : '#d6dfeb', '#6e87ac', scale, originX, originY);
      });
    }

    const lp = project3DPoint(-maxWidth / 2, yBase + 3.12, -maxDepth / 2, scale, originX, originY);
    c.fillStyle = '#0f274f';
    c.font = '700 14px Inter, Arial, sans-serif';
    c.textAlign = 'left';
    c.fillText(level.label, lp.x, lp.y - 10);
  });

  c.fillStyle = '#12325b';
  c.font = '600 13px Inter, Arial, sans-serif';
  c.textAlign = 'left';
  c.fillText('Interactive 3D architectural preview', 18, 28);
  c.fillStyle = '#506c97';
  c.font = '500 12px Inter, Arial, sans-serif';
  c.fillText('Drag to rotate • Shift/right-drag to pan • Wheel to zoom • Double-click to reset', 18, 48);
  c.fillText(state.cutawayMode ? 'Cutaway active' : 'Exterior massing active', 18, 66);
  bindFallbackThreeInteractions(canvas);
  updateThreeControlStates();
}

function renderThree() {
  updateThreeControlStates();
  if (!state.design) return;
  if (state.reliable3D) {
    renderFallbackThree();
    return;
  }
  try {
    if (!state.scene || !state.rootGroup || state.threeMode !== 'webgl') {
      const ok = initThree();
      if (!ok || !state.rootGroup) {
        renderFallbackThree();
        return;
      }
    }
    while (state.rootGroup.children.length) state.rootGroup.remove(state.rootGroup.children[0]);

  const designGroup = new THREE.Group();
  const maxWidth = Math.max(...state.design.levels.map((l) => l.outer_width), 1);
  const maxDepth = Math.max(...state.design.levels.map((l) => l.outer_depth), 1);
  const xOffset = maxWidth / 2;
  const zOffset = maxDepth / 2;

  const facadePreset = getFacadePreset(state.design.config || {});
  const slabMaterial = new THREE.MeshStandardMaterial({ color: facadePreset.roofColor, roughness: 0.88, metalness: 0.02 });
  const groundMaterial = new THREE.MeshStandardMaterial({ color: facadePreset.groundColor, roughness: 1 });
  const plinthMaterial = new THREE.MeshStandardMaterial({ color: facadePreset.plinthColor, roughness: 0.95 });
  const wallMaterial = new THREE.MeshStandardMaterial({ color: facadePreset.wallColor, roughness: 0.88, metalness: 0.01, transparent: true, opacity: state.shellVisible ? 0.92 : 0.72 });
  const accentMaterial = new THREE.MeshStandardMaterial({ color: facadePreset.accentColor, roughness: 0.66, metalness: 0.03 });
  const glassMaterial = new THREE.MeshStandardMaterial({ color: facadePreset.glassColor, transparent: true, opacity: 0.34, roughness: 0.04, metalness: 0.34 });
  const frameMaterial = new THREE.MeshStandardMaterial({ color: facadePreset.frameColor, roughness: 0.46, metalness: 0.08 });
  const roofMaterial = new THREE.MeshStandardMaterial({ color: facadePreset.roofColor, roughness: 0.84 });
  const parapetMaterial = new THREE.MeshStandardMaterial({ color: 0xf5f8fd, roughness: 0.9 });
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x6e87ac });

  const site = new THREE.Mesh(new THREE.BoxGeometry(maxWidth + 12, 0.24, maxDepth + 12), groundMaterial);
  site.position.set(0, -0.14, 0);
  site.receiveShadow = true;
  designGroup.add(site);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(Math.max(maxWidth, maxDepth) * 0.95, 48), new THREE.MeshBasicMaterial({ color: 0x96a8c4, transparent: true, opacity: 0.18 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.018;
  designGroup.add(shadow);
  addLandscape(designGroup, maxWidth, maxDepth, xOffset, zOffset, frameMaterial, glassMaterial);

  state.design.levels.forEach((level, index) => {
    if (!viewerLevelVisible(level, index)) return;
    const explodedLift = state.exploded ? index * 1.12 : 0;
    const yBase = index * 3.7 + explodedLift;

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(level.outer_width + 0.3, 0.18, level.outer_depth + 0.3), plinthMaterial);
    plinth.position.set(level.outer_width / 2 - xOffset, yBase - 0.02, level.outer_depth / 2 - zOffset);
    plinth.receiveShadow = true;
    designGroup.add(plinth);

    addFloorPlateWithVoids(designGroup, level, yBase + 0.08, xOffset, zOffset, slabMaterial, plinthMaterial);

    if (level.level_type === 'roof') {
      const roofDeck = new THREE.Mesh(new THREE.BoxGeometry(level.outer_width, 0.16, level.outer_depth), roofMaterial);
      roofDeck.position.set(level.outer_width / 2 - xOffset, yBase + 0.22, level.outer_depth / 2 - zOffset);
      roofDeck.receiveShadow = true;
      designGroup.add(roofDeck);
      addRoofFamily(designGroup, level, yBase + 0.3, xOffset, zOffset, facadePreset, roofMaterial, accentMaterial, glassMaterial, frameMaterial);
      addParapet(designGroup, level.outer_width, level.outer_depth, yBase + 0.62, xOffset, zOffset, parapetMaterial);
      level.roof_features.forEach((feature) => addRoofFeature(designGroup, feature, yBase + 0.24, xOffset, zOffset, roofMaterial, glassMaterial, frameMaterial));
      return;
    }

    const topology = buildLevelTopology(level);
    addPerimeterShell(designGroup, level, yBase, xOffset, zOffset, wallMaterial, accentMaterial, glassMaterial, frameMaterial, lineMaterial);
    addTopologyWalls3D(designGroup, level, topology, yBase, xOffset, zOffset, wallMaterial, glassMaterial, frameMaterial);
    addStairVoidAndRails(designGroup, level, yBase, xOffset, zOffset, glassMaterial, frameMaterial, accentMaterial);
    addCirculationSpine3D(designGroup, level, yBase, xOffset, zOffset);
    level.rooms.forEach((room) => addRoomArchitecture(designGroup, level, room, yBase, xOffset, zOffset, wallMaterial, glassMaterial, frameMaterial, lineMaterial));
    addFacadeComposition(designGroup, level, yBase, xOffset, zOffset, accentMaterial, glassMaterial, frameMaterial, facadePreset);

    if (!state.cutawayMode) {
      const topCap = new THREE.Mesh(new THREE.BoxGeometry(level.outer_width, 0.08, level.outer_depth), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.38 }));
      topCap.position.set(level.outer_width / 2 - xOffset, yBase + 3.06, level.outer_depth / 2 - zOffset);
      designGroup.add(topCap);
    }
  });

  state.rootGroup.add(designGroup);
  fitCameraToObject(designGroup);

  function addPerimeterShell(group, level, yBase, xOffset, zOffset, wallMaterial, accentMaterial, glassMaterial, frameMaterial, lineMaterial) {
    const wallT = 0.14;
    const h = 3.0;
    const x0 = -xOffset;
    const z0 = -zOffset;
    const w = level.outer_width;
    const d = level.outer_depth;
    const entryDoor = level.level_type === 'ground' ? { side: 'south', center: 0.22 } : null;
    const sectionSkip = state.cutawayMode ? new Set(['south', 'west']) : new Set();
    if (!sectionSkip.has('south')) createWallSegments(group, { side: 'south', x0, z0, width: w, depth: d, yBase, height: h, thickness: wallT, opening: entryDoor ? { type: 'door', width: 1.55, centerRatio: entryDoor.center } : null, material: wallMaterial });
    if (!sectionSkip.has('north')) createWallSegments(group, { side: 'north', x0, z0, width: w, depth: d, yBase, height: h, thickness: wallT, opening: { type: 'window', width: Math.min(3.6, w * 0.26), centerRatio: 0.72 }, material: wallMaterial });
    if (!sectionSkip.has('west')) createWallSegments(group, { side: 'west', x0, z0, width: w, depth: d, yBase, height: h, thickness: wallT, opening: { type: 'window', width: Math.min(2.8, d * 0.22), centerRatio: 0.5 }, material: wallMaterial });
    if (!sectionSkip.has('east')) createWallSegments(group, { side: 'east', x0, z0, width: w, depth: d, yBase, height: h, thickness: wallT, opening: { type: 'window', width: Math.min(2.8, d * 0.22), centerRatio: 0.46 }, material: wallMaterial });
    if (entryDoor && !sectionSkip.has('south')) addPerimeterDoor3D(group, { side: 'south', width: w, depth: d, x0, z0, yBase, opening: { width: 1.55, centerRatio: entryDoor.center } }, glassMaterial, frameMaterial);
    if (!sectionSkip.has('north')) addPerimeterWindow3D(group, { side: 'north', width: w, depth: d, x0, z0, yBase, opening: { width: Math.min(3.6, w * 0.26), centerRatio: 0.72 } }, glassMaterial, frameMaterial);
    if (!sectionSkip.has('west')) addPerimeterWindow3D(group, { side: 'west', width: w, depth: d, x0, z0, yBase, opening: { width: Math.min(2.8, d * 0.22), centerRatio: 0.5 } }, glassMaterial, frameMaterial);
    if (!sectionSkip.has('east')) addPerimeterWindow3D(group, { side: 'east', width: w, depth: d, x0, z0, yBase, opening: { width: Math.min(2.8, d * 0.22), centerRatio: 0.46 } }, glassMaterial, frameMaterial);

    if (state.shellVisible) {
      const accent = new THREE.Mesh(new THREE.BoxGeometry(w * 0.22, 0.24, 0.2), accentMaterial);
      accent.position.set(x0 + w * 0.22, yBase + 2.7, z0 + 0.08);
      group.add(accent);
      const glazing = new THREE.Mesh(new THREE.BoxGeometry(w * 0.18, 1.25, 0.05), glassMaterial);
      glazing.position.set(x0 + w * 0.72, yBase + 1.8, z0 + 0.08);
      group.add(glazing);
      const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d));
      const lines = new THREE.LineSegments(edges, lineMaterial);
      lines.position.set(x0 + w / 2, yBase + h / 2, z0 + d / 2);
      lines.visible = state.shellVisible;
      group.add(lines);
    }
  }

  
function addPerimeterWindow3D(group, spec, glassMaterial, frameMaterial) {
  const { side, width, depth, x0, z0, yBase, opening } = spec;
  const horizontal = side === 'north' || side === 'south';
  const total = horizontal ? width : depth;
  const center = (opening.centerRatio ?? 0.5) * total;
  const openW = Math.min(total * 0.78, Math.max(0.9, opening.width));
  const frame = new THREE.Mesh(horizontal ? new THREE.BoxGeometry(openW, 1.08, 0.08) : new THREE.BoxGeometry(0.08, 1.08, openW), frameMaterial);
  const glass = new THREE.Mesh(horizontal ? new THREE.BoxGeometry(Math.max(0.2, openW - 0.08), 0.92, 0.03) : new THREE.BoxGeometry(0.03, 0.92, Math.max(0.2, openW - 0.08)), glassMaterial);
  if (horizontal) {
    const z = side === 'north' ? z0 + 0.07 : z0 + depth - 0.07;
    frame.position.set(x0 + center, yBase + 1.48, z);
    glass.position.set(x0 + center, yBase + 1.48, z);
  } else {
    const x = side === 'west' ? x0 + 0.07 : x0 + width - 0.07;
    frame.position.set(x, yBase + 1.48, z0 + center);
    glass.position.set(x, yBase + 1.48, z0 + center);
  }
  group.add(frame); group.add(glass);
}

function addPerimeterDoor3D(group, spec, glassMaterial, frameMaterial) {
  const { side, width, depth, x0, z0, yBase, opening } = spec;
  const total = side === 'north' || side === 'south' ? width : depth;
  const center = (opening.centerRatio ?? 0.5) * total;
  const openW = Math.min(total * 0.78, Math.max(1.0, opening.width));
  const frameTop = new THREE.Mesh(side === 'north' || side === 'south' ? new THREE.BoxGeometry(openW, 0.12, 0.08) : new THREE.BoxGeometry(0.08, 0.12, openW), frameMaterial);
  const door = new THREE.Mesh(side === 'north' || side === 'south' ? new THREE.BoxGeometry(Math.max(0.3, openW - 0.08), 2.16, 0.035) : new THREE.BoxGeometry(0.035, 2.16, Math.max(0.3, openW - 0.08)), new THREE.MeshStandardMaterial({ color: 0x3d4f68, roughness: 0.38, metalness: 0.08 }));
  if (side === 'north' || side === 'south') {
    const z = side === 'north' ? z0 + 0.075 : z0 + depth - 0.075;
    frameTop.position.set(x0 + center, yBase + 2.24, z);
    door.position.set(x0 + center, yBase + 1.08, z);
  } else {
    const x = side === 'west' ? x0 + 0.075 : x0 + width - 0.075;
    frameTop.position.set(x, yBase + 2.24, z0 + center);
    door.position.set(x, yBase + 1.08, z0 + center);
  }
  group.add(frameTop); group.add(door);
}

function addRoomArchitecture(group, level, room, yBase, xOffset, zOffset, wallMaterial, glassMaterial, frameMaterial, lineMaterial) {
    const roomGroup = new THREE.Group();
    const x0 = room.x - xOffset;
    const z0 = room.y - zOffset;
    const roomColor = new THREE.Color(room.color || '#dbeafe');
    const floorMat = new THREE.MeshStandardMaterial({ color: roomColor.clone().lerp(new THREE.Color('#ffffff'), 0.2), roughness: 0.75, transparent: true, opacity: 0.95 });
    const fill = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.2, room.width - 0.12), 0.04, Math.max(0.2, room.depth - 0.12)), floorMat);
    fill.position.set(x0 + room.width / 2, yBase + 0.12, z0 + room.depth / 2);
    fill.receiveShadow = true;
    roomGroup.add(fill);

    const plan = openingPlan(level, room);
    addLabelSprite(roomGroup, room.name, x0 + room.width / 2, yBase + 0.45, z0 + room.depth / 2, room.color);
    if (/stair/i.test(room.room_type)) addStairGeometry(roomGroup, room, yBase, xOffset, zOffset, frameMaterial);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(room.width, 0.05, room.depth)), new THREE.LineBasicMaterial({ color: 0xb9c7dc }));
    edges.position.set(x0 + room.width / 2, yBase + 0.145, z0 + room.depth / 2);
    roomGroup.add(edges);
    group.add(roomGroup);
  }

  function addRoofFeature(group, feature, yBase, xOffset, zOffset, roofMaterial, glassMaterial, frameMaterial) {
    const material = /solar/i.test(feature.feature_type) ? frameMaterial : /garden|sit-out/i.test(feature.feature_type) ? new THREE.MeshStandardMaterial({ color: 0x8ccf8a, roughness: 0.95 }) : /headroom/i.test(feature.feature_type) ? new THREE.MeshStandardMaterial({ color: 0xf1f5fb, roughness: 0.88 }) : roofMaterial;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(feature.width, feature.height, feature.depth), material);
    mesh.position.set(feature.x + feature.width / 2 - xOffset, yBase + feature.height / 2, feature.y + feature.depth / 2 - zOffset);
    mesh.castShadow = true;
    group.add(mesh);
    if (/headroom/i.test(feature.feature_type)) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(feature.width * 0.92, 0.08, feature.depth * 0.92), frameMaterial);
      cap.position.set(feature.x + feature.width / 2 - xOffset, yBase + feature.height + 0.08, feature.y + feature.depth / 2 - zOffset);
      group.add(cap);
    }
    if (/sit-out/i.test(feature.feature_type)) {
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(feature.width * 0.86, 0.05, feature.depth * 0.86), glassMaterial);
      canopy.position.set(feature.x + feature.width / 2 - xOffset, yBase + feature.height + 0.4, feature.y + feature.depth / 2 - zOffset);
      group.add(canopy);
    }
  }
  } catch (err) {
    console.error('3D render failed, using fallback preview.', err);
    renderFallbackThree();
  }
}


function addFloorPlateWithVoids(group, level, yCenter, xOffset, zOffset, slabMaterial, edgeMaterial) {
  const slabT = 0.2;
  const voids = level.level_type === 'roof' ? [] : level.rooms.filter((room) => /stair/i.test(room.room_type)).map((room) => ({
    x: Math.max(0.36, room.x + 0.16),
    y: Math.max(0.36, room.y + 0.16),
    width: Math.max(1.2, room.width - 0.32),
    depth: Math.max(1.2, room.depth - 0.32),
  }));
  if (!voids.length) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(level.outer_width, slabT, level.outer_depth), slabMaterial);
    slab.position.set(level.outer_width / 2 - xOffset, yCenter, level.outer_depth / 2 - zOffset);
    slab.receiveShadow = true;
    group.add(slab);
    return;
  }
  const xs = [0, ...voids.flatMap((v) => [v.x, v.x + v.width]), level.outer_width].sort((a, b) => a - b);
  const ys = [0, ...voids.flatMap((v) => [v.y, v.y + v.depth]), level.outer_depth].sort((a, b) => a - b);
  for (let xi = 0; xi < xs.length - 1; xi += 1) {
    for (let yi = 0; yi < ys.length - 1; yi += 1) {
      const x1 = xs[xi], x2 = xs[xi + 1], y1 = ys[yi], y2 = ys[yi + 1];
      const w = x2 - x1, d = y2 - y1;
      if (w <= 0.06 || d <= 0.06) continue;
      const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
      const insideVoid = voids.some((v) => midX > v.x + 0.01 && midX < v.x + v.width - 0.01 && midY > v.y + 0.01 && midY < v.y + v.depth - 0.01);
      if (insideVoid) continue;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w, slabT, d), slabMaterial);
      slab.position.set(midX - xOffset, yCenter, midY - zOffset);
      slab.receiveShadow = true;
      group.add(slab);
    }
  }
}

function addStairVoidAndRails(group, level, yBase, xOffset, zOffset, glassMaterial, frameMaterial, accentMaterial) {
  const stair = level.rooms.find((room) => /stair/i.test(room.room_type));
  if (!stair) return;
  const voidW = Math.max(1.15, stair.width - 0.4);
  const voidD = Math.max(1.15, stair.depth - 0.4);
  const cx = stair.x + stair.width / 2 - xOffset;
  const cz = stair.y + stair.depth / 2 - zOffset;
  const railMat = new THREE.MeshStandardMaterial({ color: 0xf8fbff, transparent: true, opacity: 0.9, roughness: 0.2 });
  const ringParts = [
    [voidW, 0.08, 0.06, 0, 1.04, -voidD / 2],
    [voidW, 0.08, 0.06, 0, 1.04, voidD / 2],
    [0.06, 0.08, voidD, -voidW / 2, 1.04, 0],
    [0.06, 0.08, voidD, voidW / 2, 1.04, 0],
  ];
  ringParts.forEach(([w, h, d, dx, dy, dz]) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), railMat);
    mesh.position.set(cx + dx, yBase + dy, cz + dz);
    group.add(mesh);
  });
  for (let i = -1; i <= 1; i += 1) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.0, 0.05), frameMaterial);
    post.position.set(cx + i * (voidW * 0.32), yBase + 0.54, cz - voidD / 2);
    group.add(post);
    const post2 = post.clone();
    post2.position.z = cz + voidD / 2;
    group.add(post2);
  }
  const voidTint = new THREE.Mesh(new THREE.BoxGeometry(voidW, 0.02, voidD), glassMaterial);
  voidTint.position.set(cx, yBase + 0.12, cz);
  group.add(voidTint);
}




function addCirculationSpine3D(group, level, yBase, xOffset, zOffset) {
  if (!level.circulation_band?.width || level.level_type === 'roof') return;
  const spineMat = new THREE.MeshStandardMaterial({ color: 0xcfd8ea, transparent: true, opacity: 0.55, roughness: 0.92 });
  const x = level.circulation_band.x - xOffset + level.circulation_band.width / 2;
  const z = level.outer_depth / 2 - zOffset;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(level.circulation_band.width, 0.05, Math.max(0.8, level.outer_depth - 0.5)), spineMat);
  mesh.position.set(x, yBase + 0.14, z);
  group.add(mesh);
}

function addFacadeComposition(group, level, yBase, xOffset, zOffset, accentMaterial, glassMaterial, frameMaterial, facadePreset) {
  const frontRooms = level.rooms.filter((room) => room.y <= 0.22);
  const canopyDepth = facadePreset?.canopyDepth || 0.9;
  frontRooms.slice(0, 3).forEach((room, idx) => {
    const centerX = room.x + room.width / 2 - xOffset;
    const canopyW = Math.max(1.2, Math.min(room.width * 0.7, 3.8));
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(canopyW, 0.09, canopyDepth), glassMaterial);
    canopy.position.set(centerX, yBase + 2.22, -zOffset + canopyDepth / 2 + 0.04 + idx * 0.015);
    group.add(canopy);

    const lintel = new THREE.Mesh(new THREE.BoxGeometry(Math.max(canopyW + 0.2, 1.6), 0.16, 0.16), accentMaterial);
    lintel.position.set(centerX, yBase + 2.58, -zOffset + 0.1);
    group.add(lintel);
  });

  const balconyRooms = level.rooms.filter((room) => /balcony|terrace/i.test(room.room_type));
  balconyRooms.forEach((room) => {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(room.width * 0.9, 0.08, 1.05), accentMaterial);
    plate.position.set(room.x + room.width / 2 - xOffset, yBase + 0.26, room.y + 0.52 - zOffset);
    group.add(plate);
    const railMat = facadePreset?.balconyStyle === 'solid' ? accentMaterial : glassMaterial;
    const railDepth = facadePreset?.balconyStyle === 'premium' ? 0.1 : 0.06;
    const rail = new THREE.Mesh(new THREE.BoxGeometry(room.width * 0.88, 0.75, railDepth), railMat);
    rail.position.set(room.x + room.width / 2 - xOffset, yBase + 0.62, room.y + 1.0 - zOffset);
    group.add(rail);
    if (facadePreset?.balconyStyle === 'premium') {
      for (let i = -1; i <= 1; i += 1) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.72, 0.06), frameMaterial);
        post.position.set(room.x + room.width / 2 - xOffset + i * (room.width * 0.24), yBase + 0.62, room.y + 1.0 - zOffset);
        group.add(post);
      }
    }
  });

  const accentMode = facadePreset?.shellAccent || 'warm-band';
  if (accentMode === 'glass-fins') {
    for (let i = 0; i < 4; i += 1) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 0.14), frameMaterial);
      fin.position.set(-xOffset + level.outer_width * (0.18 + i * 0.18), yBase + 1.45, -zOffset + 0.12);
      group.add(fin);
    }
  } else if (accentMode === 'horizontal-fins') {
    for (let i = 0; i < 3; i += 1) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(level.outer_width * (0.65 - i * 0.08), 0.1, 0.16), accentMaterial);
      band.position.set(level.outer_width / 2 - xOffset, yBase + 0.95 + i * 0.62, -zOffset + 0.1);
      group.add(band);
    }
  } else if (accentMode === 'stone-frame') {
    const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.8, 0.2), accentMaterial);
    frameLeft.position.set(-xOffset + level.outer_width * 0.18, yBase + 1.45, -zOffset + 0.12);
    const frameRight = frameLeft.clone();
    frameRight.position.x = -xOffset + level.outer_width * 0.82;
    const topBand = new THREE.Mesh(new THREE.BoxGeometry(level.outer_width * 0.64, 0.16, 0.2), accentMaterial);
    topBand.position.set(level.outer_width / 2 - xOffset, yBase + 2.72, -zOffset + 0.12);
    group.add(frameLeft, frameRight, topBand);
  } else {
    for (let i = 0; i < (facadePreset?.bandCount || 1); i += 1) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(level.outer_width * (0.6 + i * 0.06), 0.14, 0.18), accentMaterial);
      band.position.set(level.outer_width / 2 - xOffset, yBase + 2.1 + i * 0.42, -zOffset + 0.1);
      group.add(band);
    }
  }
}

function drawCoreAnnotations(level, scale) {
  const coreRooms = level.rooms.filter((room) => /stair|bathroom|lobby/i.test(room.room_type));
  coreRooms.forEach((room) => {
    const x = room.x * scale;
    const y = room.y * scale;
    const w = room.width * scale;
    const d = room.depth * scale;
    ctx.save();
    ctx.strokeStyle = 'rgba(23,54,105,.38)';
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 1.4;
    ctx.strokeRect(x + 6, y + 6, Math.max(0, w - 12), Math.max(0, d - 12));
    ctx.setLineDash([]);
    if (/stair/i.test(room.room_type)) {
      ctx.fillStyle = 'rgba(23,54,105,.62)';
      ctx.font = '700 11px Inter, sans-serif';
      ctx.fillText('CORE', x + 10, y + 18);
    }
    ctx.restore();
  });
}

function addTopologyWalls3D(group, level, topology, yBase, xOffset, zOffset, wallMaterial, glassMaterial, frameMaterial) {
  const wallT = 0.1;
  const wallH = 2.95;
  topology.segments.filter((seg) => !seg.external).forEach((seg) => {
    const openings = topology.openings.filter((op) => op.orientation === seg.orientation && Math.abs(op.coord - seg.coord) < 0.08 && op.center >= seg.start - 0.01 && op.center <= seg.end + 0.01);
    createMultiOpeningWall(group, seg, openings, yBase, xOffset, zOffset, wallH, wallT, wallMaterial);
  });
  topology.openings.filter((op) => op.type === 'window').forEach((op) => addTopologyWindow3D(group, op, yBase, xOffset, zOffset, glassMaterial, frameMaterial));
}

function createMultiOpeningWall(group, seg, openings, yBase, xOffset, zOffset, wallH, wallT, wallMaterial) {
  const horizontal = seg.orientation === 'h';
  const sorted = openings
    .map((op) => ({ ...op, a: Math.max(seg.start, op.center - op.width / 2), b: Math.min(seg.end, op.center + op.width / 2) }))
    .filter((op) => op.b - op.a > 0.08)
    .sort((a, b) => a.a - b.a);
  let cursor = seg.start;
  sorted.forEach((op) => {
    addWallChunk(cursor, op.a, 0, wallH, seg, horizontal);
    if (op.type === 'window') {
      addWallChunk(op.a, op.b, 0, 0.92, seg, horizontal);
      addWallChunk(op.a, op.b, 2.02, wallH - 2.02, seg, horizontal);
    } else {
      addWallChunk(op.a, op.b, 2.18, wallH - 2.18, seg, horizontal);
    }
    cursor = Math.max(cursor, op.b);
  });
  addWallChunk(cursor, seg.end, 0, wallH, seg, horizontal);

  function addWallChunk(start, end, bottom, height, segment, horizontalAxis) {
    const len = end - start;
    if (len <= 0.05 || height <= 0.05) return;
    const geom = horizontalAxis ? new THREE.BoxGeometry(len, height, wallT) : new THREE.BoxGeometry(wallT, height, len);
    const mesh = new THREE.Mesh(geom, wallMaterial);
    if (horizontalAxis) {
      mesh.position.set((start + len / 2) - xOffset, yBase + bottom + height / 2, segment.coord - zOffset);
    } else {
      mesh.position.set(segment.coord - xOffset, yBase + bottom + height / 2, (start + len / 2) - zOffset);
    }
    mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
  }
}

function addTopologyWindow3D(group, op, yBase, xOffset, zOffset, glassMaterial, frameMaterial) {
  const horizontal = op.orientation === 'h';
  const frame = new THREE.Mesh(horizontal ? new THREE.BoxGeometry(op.width, 1.0, 0.06) : new THREE.BoxGeometry(0.06, 1.0, op.width), frameMaterial);
  const glass = new THREE.Mesh(horizontal ? new THREE.BoxGeometry(Math.max(0.2, op.width - 0.08), 0.88, 0.03) : new THREE.BoxGeometry(0.03, 0.88, Math.max(0.2, op.width - 0.08)), glassMaterial);
  if (horizontal) {
    frame.position.set(op.center - xOffset, yBase + 1.45, op.coord - zOffset);
    glass.position.set(op.center - xOffset, yBase + 1.45, op.coord - zOffset);
  } else {
    frame.position.set(op.coord - xOffset, yBase + 1.45, op.center - zOffset);
    glass.position.set(op.coord - xOffset, yBase + 1.45, op.center - zOffset);
  }
  group.add(frame); group.add(glass);
}

function createInnerWalls(group, room, yBase, xOffset, zOffset, wallMaterial, plan, level) {
  const wallT = 0.08;
  const wallH = 2.75;
  const x0 = room.x - xOffset;
  const z0 = room.y - zOffset;
  const ext = {
    north: room.y <= 0.18,
    south: room.y + room.depth >= level.outer_depth - 0.18,
    west: room.x <= 0.18,
    east: room.x + room.width >= level.outer_width - 0.18,
  };
  ['south', 'north', 'west', 'east'].forEach((side) => {
    const opening = plan.door === side ? { type: 'door', width: Math.min(side === 'south' || side === 'north' ? room.width * 0.32 : room.depth * 0.32, 1.0), centerRatio: 0.5 } : null;
    if (ext[side] && opening && /bath|store|utility|laundry/i.test(room.room_type)) {
      createWallSegments(group, { side, x0, z0, width: room.width, depth: room.depth, yBase, height: wallH, thickness: wallT, opening: null, material: wallMaterial });
      return;
    }
    createWallSegments(group, { side, x0, z0, width: room.width, depth: room.depth, yBase, height: wallH, thickness: wallT, opening, material: wallMaterial });
  });
}

function addRoomWindows(group, room, yBase, xOffset, zOffset, glassMaterial, frameMaterial, plan, level) {
  const x0 = room.x - xOffset;
  const z0 = room.y - zOffset;
  const wallH = 2.75;
  const ext = {
    north: room.y <= 0.18,
    south: room.y + room.depth >= level.outer_depth - 0.18,
    west: room.x <= 0.18,
    east: room.x + room.width >= level.outer_width - 0.18,
  };
  plan.windows.forEach((side) => {
    if (!ext[side]) return;
    const isHorizontal = side === 'north' || side === 'south';
    const span = isHorizontal ? room.width : room.depth;
    const winW = Math.max(0.9, Math.min(1.7, span * 0.34));
    const frame = new THREE.Mesh(new THREE.BoxGeometry(isHorizontal ? winW : 0.06, 1.05, isHorizontal ? 0.08 : winW), frameMaterial);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(isHorizontal ? winW - 0.08 : 0.03, 0.92, isHorizontal ? 0.03 : winW - 0.08), glassMaterial);
    const px = side === 'west' ? x0 + 0.045 : side === 'east' ? x0 + room.width - 0.045 : x0 + room.width / 2;
    const pz = side === 'north' ? z0 + 0.045 : side === 'south' ? z0 + room.depth - 0.045 : z0 + room.depth / 2;
    frame.position.set(px, yBase + 1.72, pz);
    glass.position.set(px, yBase + 1.72, pz);
    group.add(frame);
    group.add(glass);
  });
}


function addRoofFamily(group, level, yBase, xOffset, zOffset, facadePreset, roofMaterial, accentMaterial, glassMaterial, frameMaterial) {
  const style = facadePreset?.roofStyle || 'flat-parapet';
  const cx = level.outer_width / 2 - xOffset;
  const cz = level.outer_depth / 2 - zOffset;
  if (style === 'terrace-lux') {
    const pergola = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(level.outer_width * 0.42, 0.08, level.outer_depth * 0.2), accentMaterial);
    deck.position.set(cx, yBase + 0.08, -zOffset + level.outer_depth * 0.22);
    pergola.add(deck);
    for (let i = -2; i <= 2; i += 1) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), frameMaterial);
      post.position.set(cx + i * (level.outer_width * 0.07), yBase + 0.45, -zOffset + level.outer_depth * 0.16);
      pergola.add(post);
    }
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(level.outer_width * 0.42, 0.05, level.outer_depth * 0.22), glassMaterial);
    canopy.position.set(cx, yBase + 0.92, -zOffset + level.outer_depth * 0.16);
    pergola.add(canopy);
    group.add(pergola);
  } else if (style === 'gable') {
    const halfW = level.outer_width * 0.52;
    const depth = level.outer_depth * 0.96;
    const roofGeom = new THREE.CylinderGeometry(0.01, 0.01, halfW, 3, 1, false);
    const left = new THREE.Mesh(roofGeom, roofMaterial);
    left.scale.set(1, 0.8, depth / halfW);
    left.rotation.z = Math.PI / 2;
    left.rotation.y = Math.PI / 2;
    left.position.set(cx - halfW * 0.25, yBase + 0.5, cz);
    const right = left.clone();
    right.position.x = cx + halfW * 0.25;
    group.add(left, right);
  } else if (style === 'pergola-flat') {
    for (let i = -3; i <= 3; i += 1) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(level.outer_width * 0.1, 0.05, level.outer_depth * 0.5), frameMaterial);
      beam.position.set(cx + i * (level.outer_width * 0.1), yBase + 0.82, cz);
      group.add(beam);
    }
  }
}

function addParapet(group, width, depth, yBase, xOffset, zOffset, material) {
  const t = 0.12;
  const h = 0.7;
  const x0 = -xOffset;
  const z0 = -zOffset;
  [
    { geo: new THREE.BoxGeometry(width, h, t), pos: [x0 + width / 2, yBase, z0 + t / 2] },
    { geo: new THREE.BoxGeometry(width, h, t), pos: [x0 + width / 2, yBase, z0 + depth - t / 2] },
    { geo: new THREE.BoxGeometry(t, h, depth), pos: [x0 + t / 2, yBase, z0 + depth / 2] },
    { geo: new THREE.BoxGeometry(t, h, depth), pos: [x0 + width - t / 2, yBase, z0 + depth / 2] },
  ].forEach((part) => {
    const mesh = new THREE.Mesh(part.geo, material);
    mesh.position.set(...part.pos);
    group.add(mesh);
  });
}

function createWallSegments(group, { side, x0, z0, width, depth, yBase, height, thickness, opening, material }) {
  const horizontal = side === 'north' || side === 'south';
  const total = horizontal ? width : depth;
  const axisCenter = horizontal ? x0 + width / 2 : z0 + depth / 2;
  const perp = side === 'north' ? z0 + thickness / 2 : side === 'south' ? z0 + depth - thickness / 2 : side === 'west' ? x0 + thickness / 2 : x0 + width - thickness / 2;
  const y = yBase + height / 2;
  const addSeg = (len, center) => {
    if (len <= 0.04) return;
    const geom = horizontal ? new THREE.BoxGeometry(len, height, thickness) : new THREE.BoxGeometry(thickness, height, len);
    const mesh = new THREE.Mesh(geom, material);
    if (horizontal) mesh.position.set(center, y, perp);
    else mesh.position.set(perp, y, center);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  if (!opening) return addSeg(total, axisCenter);

  const openW = Math.min(total * 0.78, Math.max(0.9, opening.width));
  const center = (opening.centerRatio ?? 0.5) * total;
  const a = Math.max(0, center - openW / 2);
  const b = Math.min(total, center + openW / 2);
  addSeg(a, (horizontal ? x0 : z0) + a / 2);
  addSeg(total - b, (horizontal ? x0 : z0) + b + (total - b) / 2);

  if (opening.type === 'window') {
    const sill = 0.95;
    const head = 0.65;
    const lowGeom = horizontal ? new THREE.BoxGeometry(openW, sill, thickness) : new THREE.BoxGeometry(thickness, sill, openW);
    const highGeom = horizontal ? new THREE.BoxGeometry(openW, head, thickness) : new THREE.BoxGeometry(thickness, head, openW);
    const low = new THREE.Mesh(lowGeom, material);
    const high = new THREE.Mesh(highGeom, material);
    if (horizontal) {
      low.position.set((horizontal ? x0 : z0) + center, yBase + sill / 2, perp);
      high.position.set((horizontal ? x0 : z0) + center, yBase + height - head / 2, perp);
    } else {
      low.position.set(perp, yBase + sill / 2, (horizontal ? x0 : z0) + center);
      high.position.set(perp, yBase + height - head / 2, (horizontal ? x0 : z0) + center);
    }
    group.add(low);
    group.add(high);
  }
}

function addStairGeometry(group, room, yBase, xOffset, zOffset, material) {
  const steps = 8;
  const stepH = 0.18;
  const stepD = Math.max(0.2, (room.depth - 0.5) / steps);
  for (let i = 0; i < steps; i += 1) {
    const tread = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.9, room.width - 0.5), stepH, stepD), material);
    tread.position.set(room.x + room.width / 2 - xOffset, yBase + 0.14 + stepH / 2 + i * stepH, room.y + 0.25 + stepD / 2 + i * stepD - zOffset);
    group.add(tread);
  }
}

function addLabelSprite(group, text, x, y, z, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 72;
  const c = canvas.getContext('2d');
  c.fillStyle = 'rgba(255,255,255,0.82)';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.strokeStyle = color || '#dbeafe';
  c.lineWidth = 4;
  c.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
  const label = String(text || '').slice(0, 20);
  const fontSize = label.length > 16 ? 20 : 24;
  c.fillStyle = '#15305a';
  c.font = `700 ${fontSize}px Inter, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(label, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(label.length > 16 ? 2.2 : 2.7, 0.72, 1);
  sprite.position.set(x, y, z);
  group.add(sprite);
}

function fitCameraToObject(object) {
  if (!state.camera) return;
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 1);
  const fov = (state.camera.fov || 46) * (Math.PI / 180);
  const fitHeightDistance = maxDim / (2 * Math.tan(fov / 2));
  const fitWidthDistance = fitHeightDistance / Math.max(0.65, state.camera.aspect || 1);
  const distance = Math.max(fitHeightDistance, fitWidthDistance) * 1.85;
  const target = center.clone();
  target.y = box.min.y + size.y * 0.42;
  const offset = new THREE.Vector3(distance * 0.92, distance * 0.58, distance * 1.02);
  state.camera.near = Math.max(0.1, distance / 200);
  state.camera.far = Math.max(2000, distance * 20);
  state.camera.position.copy(target.clone().add(offset));
  state.camera.updateProjectionMatrix();
  if (state.controls) {
    state.controls.target.copy(target);
    state.controls.minDistance = Math.max(4, distance * 0.32);
    state.controls.maxDistance = Math.max(distance * 5, 40);
    state.controls.update();
  } else {
    state.camera.lookAt(target);
  }
  if (state.renderer && state.scene) state.renderer.render(state.scene, state.camera);
}

function reset3DView() {
  if (state.threeMode === 'webgl' && state.rootGroup) {
    fitCameraToObject(state.rootGroup);
    setStatus('3D view reset.');
  } else if (state.design) {
    renderFallbackThree();
    setStatus('3D preview reset.');
  }
}

function saveProject() {
  const payload = { ...serializeStudioState(), saved_at: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  updateAutosaveBadge('Project saved locally', 'saved');
  setStatus('Project saved locally.');
}

function loadProject() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return setStatus('No saved project found.', true);
  try {
    const payload = JSON.parse(raw);
    applyConfigToUI(payload.config);
    state.candidates = payload.candidates || [];
    state.design = payload.design || null;
    state.activeCandidateIndex = Number.isFinite(payload.activeCandidateIndex) ? payload.activeCandidateIndex : 0;
    state.activeLevelId = state.design?.levels?.[0]?.level_id || null;
    renderDesign();
    renderCandidates();
    updateAutosaveBadge('Project loaded', 'saved');
    setStatus('Saved project loaded.');
  } catch (err) {
    setStatus('Saved project is invalid.', true);
  }
}

function exportJson() {
  const blob = new Blob([JSON.stringify({ config: collectConfig(), design: state.design, candidates: state.candidates }, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'archinthai-project.json');
}

function exportPng() {
  planCanvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, `archinthai-${state.activeLevelId || 'plan'}.png`);
  });
}

function exportElevationPng() {
  if (!elevationCanvas) return;
  elevationCanvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, `archinthai-${state.activeElevation || 'front'}-elevation.png`);
  });
}

function exportSvg() {
  if (!state.design) return setStatus('Generate a design first.', true);
  const level = activeLevel();
  if (!level) return;
  const scale = 42;
  const pad = 24;
  const w = level.outer_width * scale + pad * 2;
  const h = level.outer_depth * scale + pad * 2;
  const rooms = level.rooms || [];
  const roomRects = rooms.map((room) => `<rect x="${pad + room.x * scale}" y="${pad + room.y * scale}" width="${room.width * scale}" height="${room.depth * scale}" fill="${mixWithWhite(room.color || '#dbeafe', 0.86)}" stroke="rgba(38,71,122,.25)" stroke-width="1" />`).join('');
  const labels = rooms.map((room) => `<text x="${pad + (room.x + room.width/2) * scale}" y="${pad + (room.y + room.depth/2) * scale}" font-family="Inter, Arial, sans-serif" font-size="12" text-anchor="middle" fill="#14305a">${room.name.replace(/&/g, '&amp;')}</text>`).join('');
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="100%" height="100%" fill="#f7fbff"/>
  <rect x="${pad}" y="${pad}" width="${level.outer_width * scale}" height="${level.outer_depth * scale}" fill="#ffffff" stroke="#10284e" stroke-width="8"/>
  ${roomRects}
  ${labels}
</svg>`;
  downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `archinthai-${level.level_id}.svg`);
}


function exportThreeSnapshot() {
  const webglCanvas = el('threeContainer').querySelector('canvas');
  if (state.renderer && state.threeMode === 'webgl') {
    state.renderer.render(state.scene, state.camera);
    state.renderer.domElement.toBlob((blob) => {
      if (blob) downloadBlob(blob, `archinthai-${state.activeLevelId || '3d'}-3d.png`);
    });
    return;
  }
  if (webglCanvas && webglCanvas.toBlob) {
    webglCanvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `archinthai-${state.activeLevelId || '3d'}-3d.png`);
    });
    return;
  }
  setStatus('3D view not ready.', true);
}


function exportReport() {
  if (!state.design) return setStatus('Generate a design first.', true);
  const rooms = state.design.levels.reduce((sum, level) => sum + level.rooms.length, 0);
  const totalArea = state.design.levels.reduce((sum, level) => sum + level.rooms.reduce((a, r) => a + r.width * r.depth, 0), 0).toFixed(1);
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${state.design.config.project_name}</title><style>body{font-family:Inter,Arial,sans-serif;margin:32px;color:#0f172a}h1{margin-bottom:6px}table{width:100%;border-collapse:collapse;margin-top:18px}td,th{border:1px solid #dbe3f0;padding:10px;text-align:left}th{background:#f1f5f9}.meta{color:#475569}.pill{display:inline-block;padding:8px 12px;border-radius:999px;background:#e0f2fe;margin-right:8px}</style></head><body><h1>${state.design.config.project_name}</h1><p class="meta">${state.design.config.style} • ${state.design.config.facade_theme}</p><div><span class="pill">Score ${Number(state.design.metadata.score || 0).toFixed(1)}</span><span class="pill">${rooms} rooms</span><span class="pill">${totalArea} m² planned</span></div><h2>Level Summary</h2><table><thead><tr><th>Level</th><th>Type</th><th>Rooms</th><th>Area</th></tr></thead><tbody>${state.design.levels.map(level => `<tr><td>${level.label}</td><td>${level.level_type}</td><td>${level.rooms.length}</td><td>${level.rooms.reduce((a,r)=>a+r.width*r.depth,0).toFixed(1)} m²</td></tr>`).join('')}</tbody></table><h2>Notes</h2><ul>${state.design.metadata.notes.map(note => `<li>${note}</li>`).join('')}</ul></body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  downloadBlob(blob, 'archinthai-report.html');
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      applyConfigToUI(payload.config || payload.design?.config || collectConfig());
      state.candidates = payload.candidates || [];
      state.design = payload.design || null;
      state.activeLevelId = state.design?.levels?.[0]?.level_id || null;
      renderDesign();
      renderCandidates();
      setStatus('Imported project JSON.');
    } catch (err) {
      setStatus('Invalid JSON file.', true);
    }
  };
  reader.readAsText(file);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function applyConfigToUI(config) {
  el('projectName').value = config.project_name || 'ArchinthAI Project';
  el('plotWidth').value = config.plot_width;
  el('plotDepth').value = config.plot_depth;
  el('style').value = config.style;
  el('facadeTheme').value = config.facade_theme || 'Glass + Concrete';
  el('roadSide').value = config.road_side || 'south';
  el('northDirection').value = config.north_direction || 'up';
  el('setbackFront').value = config.setback_front ?? 1.5;
  el('setbackRear').value = config.setback_rear ?? 1.2;
  el('setbackLeft').value = config.setback_left ?? 0.9;
  el('setbackRight').value = config.setback_right ?? 0.9;
  el('floorCount').value = String(config.floor_count);
  el('includeBasement').checked = !!config.include_basement;
  el('includeRoof').checked = !!config.include_roof;
  buildEditableLevels(config.levels || null);
}

function loadTemplates() {
  // Use the client-side template data (no backend required)
  const templates = window.ARCHINTHAI_TEMPLATES || [];
  state.templates = templates;
  const wrap = el('templateCards');
  wrap.innerHTML = '';
  templates.forEach((template) => {
    const card = document.createElement('div');
    card.className = 'template-card';
    card.innerHTML = `<h3>${template.name}</h3><p>${template.summary}</p><button class="btn btn-ghost small-btn">Use preset</button>`;
    card.querySelector('button').addEventListener('click', () => {
      applyConfigToUI(template.config);
      setStatus(`Loaded template: ${template.name}`);
    });
    wrap.appendChild(card);
  });
}

function wireEvents() {
  el('generateBtn').addEventListener('click', generateDesign);
  el('applyCommandBtn').addEventListener('click', applyCommand);
  el('saveProjectBtn').addEventListener('click', saveProject);
  el('loadProjectBtn').addEventListener('click', loadProject);
  el('undoBtn').addEventListener('click', undoDesign);
  el('redoBtn').addEventListener('click', redoDesign);
  el('optimizeDesignBtn').addEventListener('click', optimizeCurrentDesign);
  el('reflowLevelBtn').addEventListener('click', reflowActiveLevel);
  el('resetConfigBtn').addEventListener('click', () => { buildEditableLevels(); queueAutosave(); });
  el('exportJsonBtn').addEventListener('click', exportJson);
  el('exportPngBtn').addEventListener('click', exportPng);
  el('exportSvgBtn').addEventListener('click', exportSvg);
  el('exportReportBtn').addEventListener('click', exportReport);
  el('export3dBtn').addEventListener('click', exportThreeSnapshot);
  const exportElevationBtn = el('exportElevationBtn');
  if (exportElevationBtn) exportElevationBtn.addEventListener('click', exportElevationPng);
  el('explodeBtn').addEventListener('click', () => {
    state.exploded = !state.exploded;
    renderThree();
  });
  el('toggleShellBtn').addEventListener('click', () => {
    state.shellVisible = !state.shellVisible;
    renderThree();
    setStatus(state.shellVisible ? 'Shell enabled.' : 'Shell hidden for interior visibility.');
  });
  el('cutawayBtn').addEventListener('click', () => {
    state.cutawayMode = !state.cutawayMode;
    renderDesign();
    setStatus(state.cutawayMode ? 'Cutaway mode enabled.' : 'Cutaway mode disabled.');
  });
  el('isolateLevelBtn').addEventListener('click', () => {
    state.isolateActiveLevel = !state.isolateActiveLevel;
    renderDesign();
    setStatus(state.isolateActiveLevel ? 'Isolate floor enabled.' : 'Showing all floors.');
  });
  el('resetCameraBtn').addEventListener('click', () => {
    if (state.threeMode === 'fallback') {
      resetFallbackCamera();
      renderFallbackThree();
      return;
    }
    if (state.rootGroup) fitCameraToObject(state.rootGroup);
  });
  el('importJsonInput').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) importJson(file);
    e.target.value = '';
  });
  ['floorCount', 'includeBasement', 'includeRoof'].forEach((id) => el(id).addEventListener('change', () => { buildEditableLevels(); queueAutosave(); }));
  ['projectName','plotWidth','plotDepth','style','facadeTheme','roadSide','northDirection','setbackFront','setbackRear','setbackLeft','setbackRight'].forEach((id) => el(id).addEventListener('input', queueAutosave));
  el('roomFilterInput').addEventListener('input', renderInventory);
  document.querySelectorAll('.chip').forEach((chip) => chip.addEventListener('click', () => {
    el('commandInput').value = chip.textContent.trim();
  }));
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      undoDesign();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      redoDesign();
    }
  });
}

function boot() {
  wireEvents();
  buildEditableLevels();
  loadTemplates();
  // Use the client-side default config (no backend required)
  const defaults = window.ARCHINTHAI_DEFAULTS || null;
  if (defaults) {
    applyConfigToUI(defaults);
  } else {
    buildEditableLevels();
  }
  const restored = restoreDraft();
  if (!restored) updateAutosaveBadge('Auto-save idle');
  const viewerHeading = document.querySelector('.viewer-card h2');
  if (viewerHeading) viewerHeading.textContent = getViewerTitle();
  setStatus('Studio ready.');
}

boot();

window.addEventListener("load", () => {
  const splash = document.getElementById("startupSplash");
  if (!splash) return;

  setTimeout(() => {
    splash.classList.add("hide");
  }, 1800);
});