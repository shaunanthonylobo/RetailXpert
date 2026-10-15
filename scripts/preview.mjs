// Serves dist/ at http://localhost:5173 (or the next free port). Stop with Ctrl+C.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = join(process.cwd(), "dist");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

function start(port) {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent((req.url || "/").split("?")[0])).replace(/^(\.\.[/\\])+/, "");
    const file = join(root, path === "/" || path === "\\" ? "index.html" : path);
    try {
      const body = await readFile(file);
      res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404).end("Not found. Run `npm run build` first.");
    }
  });
  server.on("error", (e) => (e.code === "EADDRINUSE" ? start(port + 1) : console.error(e)));
  server.listen(port, () => console.log(`RetailXpert running at http://localhost:${port}  (Ctrl+C to stop)`));
}
start(5173);
