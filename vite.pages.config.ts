import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const rootDir = dirname(fileURLToPath(import.meta.url));
const docsDir = join(rootDir, "docs");

function noJekyll(): Plugin {
  return {
    name: "pages-nojekyll",
    apply: "build",
    closeBundle() {
      writeFileSync(join(docsDir, ".nojekyll"), "");
    },
  };
}

/** Static GitHub Pages build. The live preview keeps using vite.config.ts. */
export default defineConfig({
  root: join(rootDir, "site"),
  base: "./",
  publicDir: join(rootDir, "public"),
  plugins: [tailwindcss(), viteReact(), noJekyll()],
  resolve: {
    tsconfigPaths: true,
    alias: { "@": join(rootDir, "src") },
  },
  build: {
    outDir: docsDir,
    emptyOutDir: true,
  },
});
