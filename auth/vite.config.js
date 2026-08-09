import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Builds the auth app into "dist" using a base path that works when served
// from within the ArchinthAI static site (e.g. http://host/auth/).
export default defineConfig({
  plugins: [react()],
  base: "/auth/",
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
