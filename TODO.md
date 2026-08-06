# ArchinthAI — Enterprise-Grade AI Architect Platform

## 🎯 Vision
Position ArchinthAI as **"The AI Architect Platform"** — automating the full architectural
workflow (program → design → code compliance → cost → construction docs) that is traditionally
done by human architects. Build to a level that impresses top global tech companies.

## ✅ Completed (baseline)
- [x] Client-side engine (`engine.js`) — generation runs in browser, no backend needed
- [x] Client-side defaults + templates
- [x] Furniture placement (2D + 3D)
- [x] Supabase cloud persistence config + localStorage fallback
- [x] Static deployment configs (Vercel / Netlify / Render)
- [x] Git repo initialized, committed, pushed to GitHub

## 🚀 Phase 1 — Professional "Architect Replacement" Engines
- [ ] `compliance.js` — building code compliance engine (setbacks, egress, min room sizes, stair rules, ventilation, bathroom ratios)
- [ ] `cost.js` — construction cost estimation engine (by area, materials, finishes, location factor)
- [ ] `sustainability.js` — energy / orientation / daylight scoring
- [ ] Auto-fix engine that resolves compliance violations
- [ ] Integrate compliance + cost + sustainability into design metadata & UI

## 🧠 Phase 2 — Real AI Engine
- [ ] `ai.js` — pluggable LLM integration (OpenAI / Anthropic / Gemini), configurable API key
- [ ] Natural language → structured room program understanding
- [ ] Design rationale generation (why this layout for this brief)
- [ ] Architect critique engine (reviews design, suggests improvements)
- [ ] Smart refinement via LLM (beyond rule-based matching)

## 📤 Phase 3 — Professional Export (BIM / industry standard)
- [ ] DXF export (AutoCAD-compatible) for floor plans
- [ ] PDF report generation (client-side)
- [ ] Professional title-block sheets for plans/elevations
- [ ] Enhanced SVG/PNG exports

## 🧪 Phase 4 — Engineering Excellence
- [x] Automated test suite (`tests/`) — Node unit tests for engine, compliance, cost
  - [x] `tests/compliance.test.js` — 8 tests (setbacks, room sizes, stairs, overlaps, ratios, score)
  - [x] `tests/cost.test.js` — 6 tests (built area, cost ranges, class/region factors, contingency)
  - [x] `tests/sustainability.test.js` — 5 tests (score, grade, roof, glazing, findings)
  - [x] `package.json` with `npm test` running via Node's built-in test runner
- [x] Modular refactor of `app.js` into clear modules
- [ ] GitHub Actions CI (lint, test, build, deploy)
- [ ] Comprehensive README (architecture diagram, API docs, vision)

## 🎨 Phase 5 — Polish & Positioning
- [ ] SEO meta, favicon, 404 page
- [ ] "Disrupting the architect industry" positioning content (creator page / landing)
- [ ] Final commit + push to GitHub
