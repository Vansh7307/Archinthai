// ArchinthAI Supabase integration
// Uses Supabase REST API directly (no SDK dependency) so it works with static hosting.
// Falls back to localStorage if Supabase is not configured.

(function (global) {
  "use strict";

  const CONFIG = {
    // Paste your Supabase URL + anon key here, or set via window.ARCHINTHAI_SUPABASE
    url: "",
    anonKey: ""
  };

  // Allow runtime override via script tag or window config
  function loadConfig() {
    const runtime = (typeof window !== "undefined") ? window.ARCHINTHAI_SUPABASE : null;
    if (runtime && runtime.url && runtime.anonKey) {
      CONFIG.url = runtime.url;
      CONFIG.anonKey = runtime.anonKey;
    }
    return CONFIG.url && CONFIG.anonKey;
  }

  const cache = { projects: null, furniture: null };

  function configured() {
    return loadConfig();
  }

  async function supabaseFetch(path, options) {
    if (!configured()) throw new Error("Supabase not configured");
    const res = await fetch(CONFIG.url + path, {
      ...options,
      headers: {
        "apikey": CONFIG.anonKey,
        "Authorization": "Bearer " + CONFIG.anonKey,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error("Supabase error " + res.status + ": " + text);
    }
    const ct = res.headers.get("content-type") || "";
    return ct.includes("json") ? res.json() : res.text();
  }

  // ---- Project persistence ----
  async function listProjects() {
    if (!configured()) return null;
    try {
      const data = await supabaseFetch("/rest/v1/projects?select=id,project_name,created_at&order=created_at.desc");
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn("Supabase listProjects failed", e);
      return null;
    }
  }

  async function saveProject(payload) {
    if (!configured()) return null;
    try {
      const body = {
        project_name: payload.config?.project_name || "Untitled",
        data: JSON.stringify(payload)
      };
      const data = await supabaseFetch("/rest/v1/projects", {
        method: "POST",
        body: JSON.stringify(body)
      });
      return Array.isArray(data) ? data[0] : data;
    } catch (e) {
      console.warn("Supabase saveProject failed", e);
      return null;
    }
  }

  async function loadProject(id) {
    if (!configured()) return null;
    try {
      const data = await supabaseFetch("/rest/v1/projects?id=eq." + encodeURIComponent(id) + "&select=data");
      if (Array.isArray(data) && data.length) {
        return typeof data[0].data === "string" ? JSON.parse(data[0].data) : data[0].data;
      }
      return null;
    } catch (e) {
      console.warn("Supabase loadProject failed", e);
      return null;
    }
  }

  async function deleteProject(id) {
    if (!configured()) return null;
    try {
      await supabaseFetch("/rest/v1/projects?id=eq." + encodeURIComponent(id), { method: "DELETE" });
      return true;
    } catch (e) {
      console.warn("Supabase deleteProject failed", e);
      return null;
    }
  }

  // ---- Furniture library ----
  async function getFurnitureLibrary() {
    if (cache.furniture) return cache.furniture;
    if (!configured()) return window.ARCHINTHAI_FURNITURE;
    try {
      const data = await supabaseFetch("/rest/v1/furniture?select=*");
      if (Array.isArray(data) && data.length) {
        cache.furniture = data;
        return data;
      }
    } catch (e) {
      console.warn("Supabase furniture fetch failed, using embedded library", e);
    }
    return window.ARCHINTHAI_FURNITURE;
  }

  // ---- Local storage fallback ----
  const LOCAL_KEY = "archinthai-supabase-local";

  function localSave(payload) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(payload)); return true; } catch (e) { return false; }
  }
  function localLoad() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "null"); } catch (e) { return null; }
  }

  global.ArchinthaiSupabase = {
    configured,
    listProjects,
    saveProject,
    loadProject,
    deleteProject,
    getFurnitureLibrary,
    localSave,
    localLoad
  };
})(typeof window !== "undefined" ? window : globalThis);
