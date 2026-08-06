// ArchinthAI Enterprise Analysis UI.
//
// Wires the compliance / cost / sustainability engines, AI critique &
// rationale, PDF/DXF export, and the AI settings modal into the UI.
// Runs fully offline by default; AI features activate when an API key is set.

(function (global) {
  "use strict";

  const $ = (id) => document.getElementById(id);
  let cachedAnalysis = null;

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function getDesign() {
    // Access the app's live design via the global state set by app.js.
    return (typeof global.ArchinthaiStudio !== "undefined" && global.ArchinthaiStudio.getDesign)
      ? global.ArchinthaiStudio.getDesign()
      : (global.state && global.state.design) || null;
  }

  // ------------------------------------------------------------------
  // Run all offline analyses
  // ------------------------------------------------------------------
  function runAllAnalyses(design) {
    const compliance = global.ArchinthaiCompliance ? global.ArchinthaiCompliance.audit(design) : null;
    const cost = global.ArchinthaiCost ? global.ArchinthaiCost.estimate(design, {
      class: "standard",
      region: "india",
      finish: "standard",
    }) : null;
    const sustainability = global.ArchinthaiSustainability ? global.ArchinthaiSustainability.score(design) : null;
    cachedAnalysis = { compliance, cost, sustainability };
    return cachedAnalysis;
  }

  // ------------------------------------------------------------------
  // Render analysis panel
  // ------------------------------------------------------------------
  function renderAnalysis(analysis) {
    const panel = $("analysisPanel");
    if (!panel) return;
    if (!analysis) {
      panel.innerHTML = '<div class="analysis-empty">Generate a design, then click <strong>Run Analysis</strong>.</div>';
      return;
    }
    let html = "";

    // Compliance
    if (analysis.compliance) {
      const c = analysis.compliance;
      const statusClass = c.status === "compliant" ? "ok" : (c.status === "compliant-with-notes" ? "warn" : "bad");
      html += `<div class="analysis-card">
        <div class="analysis-card-head">
          <div>
            <strong>🏛️ Building Code Compliance</strong>
            <span class="analysis-sub">Setbacks • Egress • Min sizes • Ventilation</span>
          </div>
          <div class="analysis-score ${statusClass}">${c.score}/100</div>
        </div>
        <div class="analysis-metrics">
          <span class="pill ok">${c.passed} pass</span>
          <span class="pill warn">${c.warnings} warn</span>
          <span class="pill bad">${c.violations} fail</span>
        </div>
        ${(c.violationsList || []).slice(0, 4).map((v) => `<div class="analysis-item bad"><span>✗</span><div><b>${esc(v.title)}</b><br>${esc(v.message)}</div></div>`).join("")}
        ${(c.warningsList || []).slice(0, 3).map((w) => `<div class="analysis-item warn"><span>⚠</span><div><b>${esc(w.title)}</b><br>${esc(w.message)}</div></div>`).join("")}
      </div>`;
    }

    // Cost
    if (analysis.cost) {
      const s = analysis.cost.summary;
      html += `<div class="analysis-card">
        <div class="analysis-card-head">
          <div><strong>💰 Construction Cost Estimate</strong>
            <span class="analysis-sub">${esc(s.buildClass)} • ${esc(s.region)}</span></div>
          <div class="analysis-cost">$${fmtMoney(s.costRange[0])} – $${fmtMoney(s.costRange[1])}</div>
        </div>
        <div class="analysis-metrics">
          <span class="pill">${s.builtArea} m² built</span>
          <span class="pill">$${fmtMoney(s.costPerM2Range[0])}/m²</span>
          <span class="pill">contingency $${fmtMoney(s.contingency)}</span>
        </div>
        <div class="analysis-item neutral"><span>•</span><div>${s.roomCount} rooms, ~${s.estimatedWallLength.toFixed(0)}m wall length.</div></div>
      </div>`;
    }

    // Sustainability
    if (analysis.sustainability) {
      const su = analysis.sustainability;
      html += `<div class="analysis-card">
        <div class="analysis-card-head">
          <div><strong>🌿 Sustainability Score</strong>
            <span class="analysis-sub">Orientation • Daylight • Glazing • Ventilation</span></div>
          <div class="analysis-score ${su.score >= 70 ? "ok" : su.score >= 50 ? "warn" : "bad"}">${su.score}/100 (${su.grade})</div>
        </div>
        <div class="analysis-metrics">
          ${Object.entries(su.breakdown).map(([k, v]) => `<span class="pill">${k}: ${v}</span>`).join("")}
        </div>
      </div>`;
    }

    // AI section (live)
    if (analysis.ai) {
      html += `<div class="analysis-card">
        <div class="analysis-card-head">
          <div><strong>🤖 AI Architect Review</strong>
            <span class="analysis-sub">${analysis.ai.type === "critique" ? "Design critique" : "Design rationale"}</span></div>
        </div>
        ${Array.isArray(analysis.ai.content) ? analysis.ai.content.map((t) => `<div class="analysis-item neutral"><span>•</span><div>${esc(t)}</div></div>`).join("") : `<div class="analysis-item neutral"><span>•</span><div>${esc(analysis.ai.content)}</div></div>`}
      </div>`;
    }

    panel.innerHTML = html || '<div class="analysis-empty">No analysis yet.</div>';
  }

  function esc(s) {
    const div = document.createElement("div");
    div.textContent = s == null ? "" : String(s);
    return div.innerHTML;
  }

  function fmtMoney(n) {
    return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  // ------------------------------------------------------------------
  // Export PDF
  // ------------------------------------------------------------------
  function exportPdf() {
    const design = getDesign();
    if (!design) return alert("Generate a design first.");
    const analysis = cachedAnalysis || runAllAnalyses(design);
    if (global.ArchinthaiPdf) {
      const model = global.ArchinthaiPdf.buildModel(design, analysis);
      const pdfStr = global.ArchinthaiPdf.generateReport(model);
      downloadBlob(new Blob([pdfStr], { type: "application/pdf" }), "archinthai-report.pdf");
      toast("PDF report exported.");
    } else {
      alert("PDF module not loaded.");
    }
  }

  // ------------------------------------------------------------------
  // Export DXF
  // ------------------------------------------------------------------
  function exportDxf() {
    const design = getDesign();
    if (!design) return alert("Generate a design first.");
    if (global.ArchinthaiDxf) {
      const dxf = global.ArchinthaiDxf.designToDxf(design);
      downloadBlob(new Blob([dxf], { type: "application/dxf" }), "archinthai-plan.dxf");
      toast("DXF exported (open in AutoCAD/LibreCAD).");
    } else {
      alert("DXF module not loaded.");
    }
  }

  // ------------------------------------------------------------------
  // AI Settings modal
  // ------------------------------------------------------------------
  function openAiSettings() {
    const cfg = global.ArchinthaiAI ? global.ArchinthaiAI.getConfig() : { provider: "openai", model: "", apiKey: "" };
    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-head">
          <h3>AI Settings</h3>
          <button class="btn btn-ghost small-btn" id="aiModalClose">✕</button>
        </div>
        <p class="modal-note">Add an LLM API key to enable live AI brief parsing, design critique, and rationale. Works offline without one.</p>
        <label>Provider
          <select id="aiProvider">
            ${Object.entries(global.ArchinthaiAI.PROVIDERS).map(([k, v]) => `<option value="${k}" ${k === cfg.provider ? "selected" : ""}>${v.name}</option>`).join("")}
          </select>
        </label>
        <label>Model (optional)
          <input id="aiModel" type="text" value="${esc(cfg.model)}" placeholder="e.g. gpt-4o-mini" />
        </label>
        <label>API Key
          <input id="aiApiKey" type="password" value="${esc(cfg.apiKey)}" placeholder="sk-..." />
        </label>
        <div class="modal-actions">
          <button class="btn btn-primary small-btn" id="aiSaveBtn">Save</button>
          <button class="btn btn-ghost small-btn" id="aiClearBtn">Clear</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    modal.querySelector("#aiModalClose").addEventListener("click", () => modal.remove());
    modal.querySelector("#aiClearBtn").addEventListener("click", () => {
      localStorage.removeItem("archinthai-ai-config");
      modal.remove();
      toast("AI config cleared.");
    });
    modal.querySelector("#aiSaveBtn").addEventListener("click", () => {
      const provider = modal.querySelector("#aiProvider").value;
      const model = modal.querySelector("#aiModel").value.trim();
      const apiKey = modal.querySelector("#aiApiKey").value.trim();
      localStorage.setItem("archinthai-ai-config", JSON.stringify({ provider, model, apiKey }));
      modal.remove();
      toast("AI settings saved.");
    });
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
  }

  // ------------------------------------------------------------------
  // AI Brief parsing
  // ------------------------------------------------------------------
  async function parseBrief() {
    const input = $("aiBriefInput");
    const text = input.value.trim();
    if (!text) return alert("Enter a brief first.");
    const button = $("aiBriefBtn");
    button.disabled = true;
    button.textContent = "Parsing...";
    try {
      const result = await global.ArchinthaiAI.understandBrief(text);
      // Distribute program into levels
      const levels = buildLevelsFromProgram(result);
      // Apply to UI via app's config loader
      if (global.ArchinthaiStudio && global.ArchinthaiStudio.applyProgram) {
        global.ArchinthaiStudio.applyProgram(levels, result);
      } else {
        // Fallback: fill the DOM level editor
        applyLevelsToDom(levels);
      }
      toast(`Brief parsed: ${result.program.length} rooms across ${levels.length} levels.`);
    } catch (err) {
      console.error(err);
      toast("Brief parse failed.", true);
    } finally {
      button.disabled = false;
      button.textContent = "Parse Brief";
    }
  }

  function buildLevelsFromProgram(result) {
    const program = result.program || [];
    const floorCount = Math.max(1, result.floorCount || 1);
    const hasBasement = !!result.hasBasement;
    const hasRoof = !!result.hasRoof === false ? false : true;

    const assignByZone = (zone) => program.filter((r) => r.preferred_zone === zone);
    const front = assignByZone("front");
    const middle = assignByZone("middle");
    const rear = assignByZone("rear");

    const groundRooms = mergeRooms([...front, ...middle.filter((r) => /living|dining|kitchen|stair|bath|study/i.test(r.room_type)), ...rear.filter((r) => /kitchen|utility|laundry|stair|dining/i.test(r.room_type))]);
    const upperRooms = mergeRooms([...middle.filter((r) => /bed|master|guest|bath|study|office|balcony/i.test(r.room_type)), ...rear.filter((r) => /bed|bath|balcony/i.test(r.room_type))]);
    const roofRooms = mergeRooms(program.filter((r) => /terrace|solar|water tank|sit-out|garden/i.test(r.room_type)));

    const levels = [];
    if (hasBasement) {
      levels.push({
        level_id: "basement", label: "Basement", level_type: "basement", enabled: true,
        room_requests: mergeRooms(program.filter((r) => /parking|storage|laundry|gym|theater|utility/i.test(r.room_type))),
      });
    }
    levels.push({ level_id: "ground", label: "Ground Floor", level_type: "ground", enabled: true, room_requests: groundRooms });
    if (floorCount >= 2) {
      levels.push({ level_id: "first_floor", label: "First Floor", level_type: "floor", enabled: true, room_requests: upperRooms });
    }
    if (floorCount >= 3) {
      levels.push({ level_id: "second_floor", label: "Second Floor", level_type: "floor", enabled: true, room_requests: mergeRooms(program.filter((r) => /guest|study|office|bed/i.test(r.room_type))) });
    }
    if (hasRoof) {
      levels.push({ level_id: "roof", label: "Roof", level_type: "roof", enabled: true, room_requests: roofRooms });
    }
    return levels;
  }

  function mergeRooms(rooms) {
    const map = {};
    rooms.forEach((r) => {
      const key = r.room_type;
      if (!map[key]) map[key] = { room_type: key, count: 0, preferred_zone: r.preferred_zone || null };
      map[key].count += r.count || 1;
    });
    return Object.values(map);
  }

  function applyLevelsToDom(levels) {
    // Fill the level editor DOM (mirrors app.js buildEditableLevels structure).
    const container = $("levelsContainer");
    if (!container) return;
    const levelTemplate = $("levelTemplate");
    const roomTemplate = $("roomTemplate");
    container.innerHTML = "";
    levels.forEach((level) => {
      const card = levelTemplate.content.firstElementChild.cloneNode(true);
      card.dataset.levelId = level.level_id;
      card.dataset.levelType = level.level_type;
      card.querySelector(".level-title").textContent = level.label;
      card.querySelector(".level-type").textContent = level.level_type.toUpperCase();
      const list = card.querySelector(".rooms-list");
      (level.room_requests || []).forEach((room) => {
        const row = roomTemplate.content.firstElementChild.cloneNode(true);
        row.querySelector(".room-name").value = room.room_type;
        row.querySelector(".room-count").value = room.count || 1;
        row.querySelector(".room-zone").value = room.preferred_zone || "";
        row.querySelector(".remove-room-btn").addEventListener("click", () => row.remove());
        list.appendChild(row);
      });
      const addBtn = card.querySelector(".add-room-btn");
      if (addBtn) addBtn.addEventListener("click", () => list.appendChild(roomTemplate.content.firstElementChild.cloneNode(true)));
      const quickBtn = card.querySelector(".quick-add-btn");
      if (quickBtn) quickBtn.addEventListener("click", () => {
        const quickRoom = $("quickRoomSelect").value;
        if (quickRoom) {
          const row = roomTemplate.content.firstElementChild.cloneNode(true);
          row.querySelector(".room-name").value = quickRoom;
          list.appendChild(row);
        }
      });
      container.appendChild(card);
    });
  }

  // ------------------------------------------------------------------
  // AI Critique / Rationale
  // ------------------------------------------------------------------
  async function runAi(mode) {
    const design = getDesign();
    if (!design) return alert("Generate a design first.");
    const panel = $("analysisPanel");
    panel.innerHTML = '<div class="analysis-empty">🤖 Consulting the AI architect…</div>';
    try {
      let content;
      if (mode === "critique") {
        content = await global.ArchinthaiAI.architectCritique(design);
      } else {
        content = await global.ArchinthaiAI.designRationale(design);
      }
      const analysis = cachedAnalysis || runAllAnalyses(design);
      analysis.ai = { type: mode, content };
      renderAnalysis(analysis);
    } catch (err) {
      console.error(err);
      panel.innerHTML = `<div class="analysis-empty">AI error: ${esc(err.message)}</div>`;
    }
  }

  // ------------------------------------------------------------------
  // Wire events
  // ------------------------------------------------------------------
  function init() {
    const runBtn = $("runAnalysisBtn");
    if (runBtn) runBtn.addEventListener("click", () => {
      const design = getDesign();
      if (!design) return alert("Generate a design first.");
      const analysis = runAllAnalyses(design);
      renderAnalysis(analysis);
      toast("Analysis complete.");
    });
    const pdfBtn = $("exportPdfBtn");
    if (pdfBtn) pdfBtn.addEventListener("click", exportPdf);
    const dxfBtn = $("exportDxfBtn");
    if (dxfBtn) dxfBtn.addEventListener("click", exportDxf);
    const settingsBtn = $("aiSettingsBtn");
    if (settingsBtn) settingsBtn.addEventListener("click", openAiSettings);
    const briefBtn = $("aiBriefBtn");
    if (briefBtn) briefBtn.addEventListener("click", parseBrief);
    const critiqueBtn = $("aiCritiqueBtn");
    if (critiqueBtn) critiqueBtn.addEventListener("click", () => runAi("critique"));
    const rationaleBtn = $("aiRationaleBtn");
    if (rationaleBtn) rationaleBtn.addEventListener("click", () => runAi("rationale"));

    // Auto-run analysis when a design is generated (delegated via app hook).
    const renderAnalysis = global.__renderAnalysis || renderAnalysis;
  }

  function toast(msg, isErr) {
    const node = $("toast");
    if (!node) return;
    node.textContent = msg;
    node.style.color = isErr ? "#ffd6dd" : "";
    node.style.borderColor = isErr ? "rgba(255,180,191,.32)" : "";
    node.classList.add("show");
    clearTimeout(node._t);
    node._t = setTimeout(() => node.classList.remove("show"), 2600);
  }

  // Expose to app.js
  global.ArchinthaiAnalysis = {
    init,
    runAllAnalyses,
    renderAnalysis,
    exportPdf,
    exportDxf,
    getDesign,
  };

  // Auto-init when DOM ready
  if (typeof global.addEventListener === "function") {
    global.addEventListener("DOMContentLoaded", init);
    // Also try immediately in case scripts run after DOM parse
    if (document.readyState === "complete" || document.readyState === "interactive") {
      setTimeout(init, 0);
    }
  }
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined" && module.exports) {
  module.exports = global.ArchinthaiAnalysis;
}
