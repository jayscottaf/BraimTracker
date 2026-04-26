import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";

const APP_VERSION = process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";

// Emit dist/version.json so the running client can poll for new deploys.
// Skipped in dev (no dist/) — the version-check hook short-circuits when
// __APP_VERSION__ === "dev" so this only matters for production builds.
function emitVersionJson(): Plugin {
  return {
    name: "emit-version-json",
    apply: "build",
    closeBundle() {
      const outDir = path.resolve(__dirname, "dist");
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(
        path.join(outDir, "version.json"),
        JSON.stringify({ version: APP_VERSION }),
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), emitVersionJson()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
