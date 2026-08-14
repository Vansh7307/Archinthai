"""ArchinthAI FastAPI backend.

Serves the static frontend and provides the AI-assisted architectural
planning generation endpoints.

Endpoints
---------
- GET  /api/templates        -> list of preset project templates
- GET  /api/default-config   -> default project config
- POST /api/generate         -> generate a single design
- POST /api/candidates       -> generate multiple strategy candidates
- POST /api/modify           -> apply a natural-language command to a design
"""

from __future__ import annotations

import os
from typing import Any, Dict

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from auth import router as auth_router
from defaults import DEFAULT_CONFIG
from generation import generate_candidates, generate_design, modify_design
from templates_data import TEMPLATES

app = FastAPI(title="ArchinthAI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Login / sign-up page (GET /auth, /auth/, /auth/assets/*). See auth.py
# for why this previously rendered as a blank page.
app.include_router(auth_router)

# ---------------------------------------------------------------------------
# Pydantic request models
# ---------------------------------------------------------------------------


class GenerateRequest(BaseModel):
    config: Dict[str, Any]


class CandidatesRequest(BaseModel):
    config: Dict[str, Any]


class ModifyRequest(BaseModel):
    design: Dict[str, Any]
    command: str


# ---------------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------------


@app.get("/api/templates")
def api_templates() -> list:
    return TEMPLATES


@app.get("/api/default-config")
def api_default_config() -> Dict[str, Any]:
    return DEFAULT_CONFIG


@app.post("/api/generate")
def api_generate(request: GenerateRequest) -> Dict[str, Any]:
    try:
        return generate_design(request.config, strategy="balanced", seed_salt=0)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Generation failed: {exc}") from exc


@app.post("/api/candidates")
def api_candidates(request: CandidatesRequest) -> list:
    try:
        return generate_candidates(request.config)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Candidate generation failed: {exc}") from exc


@app.post("/api/modify")
def api_modify(request: ModifyRequest) -> Dict[str, Any]:
    try:
        return modify_design(request.design, request.command)
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Modify failed: {exc}") from exc


# ---------------------------------------------------------------------------
# Static frontend serving
# ---------------------------------------------------------------------------

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_STATIC_DIR = os.path.join(_PROJECT_ROOT, "static")


@app.get("/")
def serve_index() -> FileResponse:
    return FileResponse(os.path.join(_PROJECT_ROOT, "index.html"))


@app.get("/creator")
def serve_creator() -> FileResponse:
    return FileResponse(os.path.join(_PROJECT_ROOT, "creator.html"))


# Serve /static assets if the directory exists.
if os.path.isdir(_STATIC_DIR):
    app.mount("/static", StaticFiles(directory=_STATIC_DIR), name="static")
