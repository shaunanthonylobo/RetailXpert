// Bundles the app into one self-contained HTML file: dist/index.html
import { build } from "esbuild";
import { execSync } from "node:child_process";
import { runPython } from "./scripts/run-python.mjs";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

mkdirSync("dist", { recursive: true });
runPython(["scripts/build_data.py"]);
execSync("npx tailwindcss -i src/styles.css -o dist/app.css --minify", { stdio: "inherit" });
await build({
  entryPoints: ["src/main.tsx"],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  outfile: "dist/app.js",
  define: { "process.env.NODE_ENV": '"production"' },
  legalComments: "none",
});
const css = readFileSync("dist/app.css", "utf8");
const js = readFileSync("dist/app.js", "utf8").replace(/<\/script/gi, "<\\/script");
const html = `<title>RetailXpert</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&family=Manrope:wght@600;700;800&display=swap">
<style>${css}</style>
<div id="root"></div>
<script>${js}</script>
`;
writeFileSync("dist/index.html", html);
console.log(`dist/index.html ${(html.length / 1024).toFixed(0)} KB`);
