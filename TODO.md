# ArchinthAI — Cloud + Furniture + Smooth + Deploy

## Task list

### 1. Client-side engine (port Python → JS)
- [ ] Port `generation.py` → `static/js/engine.js`
- [ ] Port `defaults.py` → `static/js/defaults.js`
- [ ] Port `templates_data.py` → `static/js/templates.js`
- [ ] Update `app.js` to use local JS engine (no `/api/*`)

### 2. Furniture placement feature
- [ ] Create furniture library data (`static/js/furniture.js`)
- [ ] Add furniture palette panel in HTML/CSS
- [ ] Click-to-place furniture on 2D plan
- [ ] Drag/move/remove furniture
- [ ] Render furniture in 3D model
- [ ] Save furniture in project state

### 3. Performance smoothing
- [ ] Lazy-load Three.js
- [ ] Debounce/throttle expensive renders
- [ ] rAF batching for drag
- [ ] 3D mesh reuse / reduce garbage

### 4. Supabase integration
- [ ] Add Supabase client + config
- [ ] Save/Load projects to Supabase table
- [ ] Furniture library from Supabase

### 5. Vercel deployment
- [ ] Add `vercel.json`
- [ ] Env config template (`.env.example`)

### 6. Git commit & push
- [ ] `git init`, add, commit
- [ ] Push to `https://github.com/Vansh7307/Archinthai.git`
