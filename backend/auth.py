"""Authentication frontend routes.

Serves the built React "Sign in / Sign up" single-page app (source in
``auth/src``, production build in ``auth/dist``) at the ``/auth`` path.

Root cause of the blank-page bug
---------------------------------
No route for ``/auth`` was ever registered anywhere:

* ``backend/main.py`` only defined ``/`` and ``/creator`` -- hitting
  ``/auth`` fell through to FastAPI's default 404 handler.
* The static-hosting configs (``netlify.toml``, ``vercel.json``,
  ``render.yaml``, ``static/_redirects``) publish the repo root as-is
  and never run ``npm run build`` inside ``auth/``. So on those hosts
  ``/auth`` resolved to the *raw* Vite dev file ``auth/index.html``,
  whose ``<script type="module" src="/src/main.jsx">`` tag references
  unbundled JSX that a plain static server can't transform. The
  browser fails to execute it, ``ReactDOM.createRoot(...).render(...)``
  never runs, and the page loads with a permanently empty
  ``<div id="root">`` -- i.e. a completely blank page.

The fix is to explicitly serve the *built* bundle
(``auth/dist/index.html`` + its hashed ``assets/*.js`` / ``*.css``
files) for every request under ``/auth``, and to fail loudly with a
clear error instead of silently serving nothing if that build is
missing.
"""

from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter()

_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_BACKEND_DIR)
_AUTH_DIST_DIR = os.path.join(_PROJECT_ROOT, "auth", "dist")
_AUTH_INDEX = os.path.join(_AUTH_DIST_DIR, "index.html")
_AUTH_ASSETS_DIR = os.path.join(_AUTH_DIST_DIR, "assets")

_BUILD_MISSING_DETAIL = (
    "The login page has not been built yet. From the 'auth/' folder run "
    "`npm install` followed by `npm run build` to generate "
    "auth/dist/index.html, then restart the server."
)


def _require_built_index() -> str:
    """Return the path to the built index.html or raise a clear error.

    Raising a 503 here (instead of returning nothing / a default 404)
    means a missing build fails loudly during development rather than
    silently rendering as a blank page in the browser.
    """
    if not os.path.isfile(_AUTH_INDEX):
        raise HTTPException(status_code=503, detail=_BUILD_MISSING_DETAIL)
    return _AUTH_INDEX


@router.get("/auth")
@router.get("/auth/")
def serve_auth_index() -> FileResponse:
    """Serve the built login/sign-up single-page app."""
    return FileResponse(_require_built_index(), media_type="text/html")


@router.get("/auth/assets/{filename}")
def serve_auth_asset(filename: str) -> FileResponse:
    """Serve the hashed JS/CSS bundles the login page depends on.

    ``auth/vite.config.js`` builds with ``base: "/auth/"``, so the
    built ``index.html`` references its assets as
    ``/auth/assets/<hashed-name>``. Without this route those requests
    404, the script tag never loads, and React never mounts -- another
    path to the same blank-page symptom even if ``/auth`` itself were
    otherwise reachable.
    """
    # Guard against path traversal; only serve plain filenames that
    # actually live inside auth/dist/assets.
    safe_name = os.path.basename(filename)
    if safe_name != filename:
        raise HTTPException(status_code=404, detail="Asset not found")

    asset_path = os.path.join(_AUTH_ASSETS_DIR, safe_name)
    if not os.path.isfile(asset_path):
        raise HTTPException(status_code=404, detail="Asset not found")

    return FileResponse(asset_path)
