# ArchinthAI

**AI assisted multi floor house planning studio.**

ArchinthAI (formerly PlantrixAI) is an AI-assisted architectural planning studio that lets you:

- Create **level wise room programs** (basement → upper floors) with preset templates or fully custom room lists.
- **Generate candidate designs** across multiple planning strategies (balanced, wide-front, deep-rear).
- Inspect **polished 2D floor plans**, **elevation sheets**, and an **animated 3D conceptual model** (Three.js).
- **Iteratively refine** the building using natural-language commands such as *"make kitchen larger on ground floor"*, *"add gym in basement"*, or *"move study to first floor"*.
- **Export** plan PNG / SVG, project JSON, HTML reports, and 3D snapshots.

---

## Project structure

```
Archinth/
├── backend/
│   ├── main.py              # FastAPI app + static serving
│   ├── generation.py        # room placement / planning engine
│   ├── templates_data.py    # preset templates (3 curated layouts)
│   ├── defaults.py          # default project config
│   ├── requirements.txt     # Python dependencies
│   ├── make_logo.py         # generates static/img/archinthai-logo.png
│   └── make_creator.py      # generates static/img/creator.png
├── static/
│   ├── css/
│   │   ├── styles.css       # app styling
│   │   └── creator.css      # creator page styling
│   ├── js/
│   │   └── app.js           # full frontend logic (2D/3D, AI commands, exports)
│   └── img/
│       ├── archinthai-logo.png
│       ├── archinthai-logo.svg
│       └── creator.png
├── index.html               # main planning studio page
├── creator.html             # creator profile page
└── requirements.txt
```

---

## Running the project

### 1. Install dependencies

```bash
pip install -r backend/requirements.txt
```

### 2. Start the server

```bash
python -m uvicorn main:app --app-dir backend --port 8000
```

### 3. Open the app

Visit [http://127.0.0.1:8000](http://127.0.0.1:8000) in your browser.

- **Home page** (`/`) — the full planning studio.
- **Creator page** (`/creator`) — built-by information.

---

## API endpoints

| Method | Path                | Description                                      |
| ------ | ------------------- | ------------------------------------------------ |
| GET    | `/api/templates`    | List preset project templates                    |
| GET    | `/api/default-config` | Default project configuration                   |
| POST   | `/api/generate`     | Generate a single design (JSON config body)      |
| POST   | `/api/candidates`   | Generate multiple strategy candidates (3)        |
| POST   | `/api/modify`       | Apply a natural-language command to a design     |

---

## Features

- **Presets** — 3 curated multi floor layouts to start quickly.
- **Project setup** — plot size, setbacks, road side, north arrow, facade theme, upper floor count.
- **Level wise room program** — assign rooms floor by floor, add custom room types, quick-add presets.
- **AI refinement** — natural-language commands to modify generated designs.
- **2D floor plans** — level tabs, room zoning, export PNG / SVG.
- **Elevation preview** — front / rear / left / right conceptual elevation sheets.
- **Room inventory** — area summary per room with filtering.
- **3D conceptual model** — exploded view, shell, cutaway, isolate floor, snapshot export.
- **Candidate comparison** — pick from alternative planning strategies.
- **Save / Load / Undo / Redo** — full project state management with auto-save.

---

## Supabase (optional cloud persistence)

ArchinthAI includes an optional Supabase integration for cloud project persistence and the furniture
library. It uses the Supabase REST API directly (no SDK), so it works on any static host.

> If your previous Supabase project has hit its free-tier limit, you can simply deploy to a **new**
> Supabase project. No code changes are required beyond pasting the new credentials.

### How to switch to a new Supabase project

1. Create a new project at [https://supabase.com](https://supabase.com) (free tier gives you a fresh quota).
2. In the new project, run the schema below in the **SQL Editor** to create the required tables.
3. Open **Project Settings → API** and copy the **Project URL** and the publishable **anon** key.
4. Paste them into the `window.ARCHINTHAI_SUPABASE` block at the top of `index.html`:

```html
<script>
  window.ARCHINTHAI_SUPABASE = {
    url: "https://your-project-id.supabase.co",
    anonKey: "your-anon-key"
  };
</script>
```

### Required schema (run in Supabase SQL Editor)

```sql
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  project_name text not null,
  data jsonb,
  created_at timestamptz default now()
);

create table if not exists public.furniture (
  id uuid primary key default gen_random_uuid(),
  name text,
  category text,
  width numeric,
  depth numeric,
  icon text
);

alter table public.projects enable row level security;
alter table public.furniture enable row level security;

create policy "public read projects" on public.projects for select using (true);
create policy "public insert projects" on public.projects for insert with check (true);
create policy "public read furniture" on public.furniture for select using (true);
```

> If Supabase is not configured (empty `url` / `anonKey`), the app automatically falls back to
> `localStorage`, so the studio still works fully offline.

---

## Deploying to a static platform (no backend required)

The ArchinthAI frontend is **fully client-side**: the layout engine (`engine.js`), defaults
(`defaults.js`), templates (`templates.js`), furniture library (`furniture.js`), and all 2D / 3D /
elevation rendering run entirely in the browser. This means you can deploy it as a **pure static
site** on any hosting platform — no Python server or build step needed.

### Vercel

1. Push this repo to GitHub/GitLab.
2. In Vercel, click **Add New → Project** and import the repo.
3. Framework preset: **Other** (or leave blank). Build command: empty. Output directory: root (`.`).
4. Deploy. The included `vercel.json` handles the `/creator` route.

### Netlify

1. **Drag & drop:** drag the project folder into the Netlify dashboard (drop area under Sites).
2. **Or CLI:**
   ```bash
   npx netlify-cli deploy --prod --dir=.
   ```
   The included `netlify.toml` + `static/_redirects` handle the `/creator` route and SPA fallback.

### GitHub Pages

1. Go to your repo → **Settings → Pages**.
2. Under **Branch**, pick the branch (e.g. `main`) and set the folder to `/ (root)`.
3. Save. The site builds from the root. The `/creator` route works via the `creator.html` file
   (visit `/creator.html` directly).

### Cloudflare Pages

1. In Cloudflare, **Workers & Pages → Create → Pages → Connect to Git** and import the repo.
2. Build command: empty. Build output directory: `/` (root).
3. Deploy. Add a redirect rule: `/creator` → `/creator.html` (200).

> The backend (`backend/`) remains optional and is only needed if you want the FastAPI API
> (`/api/templates`, `/api/generate`, etc.). The static frontend runs fully without it.

---

## Tech stack

- **Backend:** FastAPI, Pydantic, uvicorn
- **Frontend:** HTML, CSS, vanilla JavaScript, Three.js (r128) + OrbitControls
- **Rendering:** Canvas 2D for plans/elevations, WebGL for the 3D massing model

