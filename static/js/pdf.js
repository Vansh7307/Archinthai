// ArchinthAI PDF Report Generator (client-side, zero dependencies).
//
// Produces a professional architectural design report as a PDF with a title
// block, project summary, level/room tables, compliance summary, cost
// estimate, and sustainability score. Implements a minimal PDF 1.4 writer.

(function (global) {
  "use strict";

  // ------------------------------------------------------------------
  // Minimal PDF writer with correct object ordering
  // ------------------------------------------------------------------
  class PdfDoc {
    constructor() {
      this.objects = []; // index 0 unused
      this.offsets = [];
    }
    add(obj) {
      this.objects.push(obj);
      return this.objects.length;
    }
    serialize() {
      let out = "%PDF-1.4\n";
      this.offsets = [];
      this.objects.forEach((obj, i) => {
        this.offsets.push(out.length);
        out += `${i + 1} 0 obj\n${obj}\nendobj\n`;
      });
      const xrefStart = out.length;
      out += `xref\n0 ${this.objects.length + 1}\n`;
      out += "0000000000 65535 f \n";
      this.offsets.forEach((o) => {
        out += String(o).padStart(10, "0") + " 00000 n \n";
      });
      out += `trailer\n<< /Size ${this.objects.length + 1} /Root 1 0 R >>\n`;
      out += "startxref\n" + xrefStart + "\n%%EOF";
      return out;
    }
  }

  function esc(s) {
    return String(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  }

  // ------------------------------------------------------------------
  // Layout -> paginated page item lists
  // ------------------------------------------------------------------
  function buildLines(model) {
    const L = [];
    L.push({ t: "title", text: model.heading || "Architectural Design Report" });
    L.push({ t: "sub", text: model.subtitle || "" });
    L.push({ t: "rule" });

    L.push({ t: "h2", text: "Project Summary" });
    (model.summary || []).forEach((kv) => L.push({ t: "kv", k: kv.k, v: kv.v }));
    L.push({ t: "rule" });

    (model.levels || []).forEach((level) => {
      L.push({ t: "h2", text: level.label });
      L.push({ t: "text", text: `Size: ${level.width}m x ${level.depth}m  |  ${level.rooms.length} rooms  |  ${level.area} m²` });
      (level.rooms || []).forEach((r) => {
        L.push({ t: "bullet", text: `${r.name} — ${r.size} — ${r.area} m²` });
      });
      L.push({ t: "rule" });
    });

    if (model.compliance) {
      L.push({ t: "h2", text: "Code Compliance" });
      L.push({ t: "kv", k: "Score", v: `${model.compliance.score}/100 (${model.compliance.status})` });
      L.push({ t: "kv", k: "Violations", v: `${model.compliance.violations}` });
      L.push({ t: "kv", k: "Warnings", v: `${model.compliance.warnings}` });
      (model.compliance.violationsList || []).slice(0, 8).forEach((v) => {
        L.push({ t: "bullet", text: `${v.title}: ${v.message}` });
      });
      L.push({ t: "rule" });
    }

    if (model.cost) {
      const s = model.cost.summary;
      L.push({ t: "h2", text: "Cost Estimate" });
      L.push({ t: "kv", k: "Built Area", v: `${s.builtArea} m²` });
      L.push({ t: "kv", k: "Cost Range", v: `$${s.costRange[0].toLocaleString()} - $${s.costRange[1].toLocaleString()}` });
      L.push({ t: "kv", k: "Cost / m²", v: `$${s.costPerM2Range[0]} - $${s.costPerM2Range[1]}` });
      L.push({ t: "kv", k: "Class / Region", v: `${s.buildClass} / ${s.region}` });
      L.push({ t: "rule" });
    }

    if (model.sustainability) {
      const su = model.sustainability;
      L.push({ t: "h2", text: "Sustainability" });
      L.push({ t: "kv", k: "Score", v: `${su.score}/100 (Grade ${su.grade})` });
      (su.recommendations || []).slice(0, 5).forEach((r) => L.push({ t: "bullet", text: r }));
    }

    return L;
  }

  function lineHeight(t) {
    switch (t) {
      case "title": return 40;
      case "sub": return 24;
      case "h2": return 30;
      case "kv": return 22;
      case "rule": return 18;
      default: return 20;
    }
  }

  function paginate(lines, pageH, margin, top) {
    const pages = [];
    let cur = { items: [] };
    let y = pageH - top;
    lines.forEach((line) => {
      const h = lineHeight(line.t);
      if (y - h < 60) {
        pages.push(cur);
        cur = { items: [] };
        y = pageH - top;
      }
      cur.items.push(line);
      y -= h;
    });
    if (cur.items.length) pages.push(cur);
    return pages;
  }

  // ------------------------------------------------------------------
  // Render a page to PDF content stream
  // ------------------------------------------------------------------
  function renderPageStream(page, pageW, pageH, title) {
    const ops = [];
    ops.push("q");
    ops.push("0.96 0.96 0.96 rg");
    ops.push(`${pageW} 0 0 ${pageH} 0 0 cm`);
    ops.push(`${pageW} 0 0 ${pageH} 0 0 re f`);

    // Header band
    ops.push("0.05 0.33 0.5 rg");
    ops.push(`0 ${pageH - 64} ${pageW} 64 re f`);
    ops.push("1 1 1 rg");
    ops.push(`BT /F2 18 Tf 50 ${pageH - 42} Td (${esc(title)}) Tj ET`);
    ops.push("0.05 0.33 0.5 RG 0.02 w");
    ops.push(`0 ${pageH - 64} m ${pageW} ${pageH - 64} l S`);

    let y = pageH - 100;
    page.items.forEach((item) => {
      switch (item.t) {
        case "title":
          ops.push("0.1 0.1 0.1 rg");
          ops.push(`BT /F2 15 Tf 50 ${y} Td (${esc(item.text)}) Tj ET`);
          y -= 40;
          break;
        case "sub":
          ops.push("0.35 0.35 0.35 rg");
          ops.push(`BT /F1 10 Tf 50 ${y} Td (${esc(item.text)}) Tj ET`);
          y -= 24;
          break;
        case "h2":
          ops.push("0.05 0.33 0.5 rg");
          ops.push(`BT /F2 12 Tf 50 ${y} Td (${esc(item.text)}) Tj ET`);
          y -= 30;
          break;
        case "kv":
          ops.push("0.15 0.15 0.15 rg");
          ops.push(`BT /F1 10 Tf 50 ${y} Td (${esc(item.k)}) Tj ET`);
          ops.push(`BT /F2 10 Tf 210 ${y} Td (${esc(item.v)}) Tj ET`);
          y -= 22;
          break;
        case "bullet":
          ops.push("0.2 0.2 0.2 rg");
          ops.push(`BT /F1 10 Tf 50 ${y} Td (${esc(item.text)}) Tj ET`);
          y -= 20;
          break;
        case "text":
          ops.push("0.2 0.2 0.2 rg");
          ops.push(`BT /F1 10 Tf 50 ${y} Td (${esc(item.text)}) Tj ET`);
          y -= 20;
          break;
        case "rule":
          ops.push("0.8 0.8 0.8 RG");
          ops.push(`50 ${y} m ${pageW - 50} ${y} l S`);
          y -= 18;
          break;
      }
    });

    // Footer
    ops.push("0.5 0.5 0.5 rg");
    ops.push(`BT /F1 8 Tf 50 30 Td (Generated by ArchinthAI - The AI Architect Platform) Tj ET`);
    ops.push("Q");
    return ops.join("\n");
  }

  // ------------------------------------------------------------------
  // Public: generate a PDF string from a model
  // ------------------------------------------------------------------
  function generateReport(model) {
    const pageW = 595;
    const pageH = 842;
    const margin = 50;
    const top = 100;

    const lines = buildLines(model);
    const pages = paginate(lines, pageH, margin, top);

    const doc = new PdfDoc();
    // object 1: catalog
    doc.add("<< /Type /Catalog /Pages 2 0 R >>");
    // object 2: pages tree
    const kids = pages.map((_, i) => `${5 + i} 0 R`).join(" ");
    doc.add(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
    // object 3: font regular
    doc.add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    // object 4: font bold
    doc.add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
    // objects 5..: pages
    pages.forEach((page) => {
      const stream = renderPageStream(page, pageW, pageH, model.heading || "ArchinthAI Report");
      doc.add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${doc.objects.length + 1} 0 R >>`);
      doc.add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    });

    return doc.serialize();
  }

  // ------------------------------------------------------------------
  // Build model from design + analysis
  // ------------------------------------------------------------------
  function buildModel(design, analysis) {
    analysis = analysis || {};
    const cfg = design.config || {};
    const meta = design.metadata || {};
    const levels = (design.levels || []).map((l) => ({
      label: l.label,
      width: l.outer_width.toFixed(1),
      depth: l.outer_depth.toFixed(1),
      area: (l.outer_width * l.outer_depth).toFixed(1),
      rooms: (l.rooms || []).map((r) => ({
        name: r.name,
        size: `${r.width.toFixed(1)}x${r.depth.toFixed(1)}`,
        area: (r.width * r.depth).toFixed(1),
      })),
    }));
    const totalArea = levels.reduce((s, l) => s + parseFloat(l.area || 0), 0);
    return {
      heading: cfg.project_name || "Architectural Design Report",
      subtitle: `AI-generated ${cfg.style || "Modern"} residential design | Strategy: ${meta.selected_strategy || "balanced"} | Score: ${(meta.score || 0).toFixed(1)}`,
      summary: [
        { k: "Project", v: cfg.project_name || "-" },
        { k: "Style", v: cfg.style || "-" },
        { k: "Plot", v: `${cfg.plot_width || 0}m x ${cfg.plot_depth || 0}m` },
        { k: "Levels", v: design.levels.length },
        { k: "Built Area", v: `${totalArea.toFixed(1)} m²` },
      ],
      levels,
      compliance: analysis.compliance,
      cost: analysis.cost,
      sustainability: analysis.sustainability,
    };
  }

  global.ArchinthaiPdf = { generateReport, buildModel };
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined" && module.exports) {
  module.exports = global.ArchinthaiPdf;
}
