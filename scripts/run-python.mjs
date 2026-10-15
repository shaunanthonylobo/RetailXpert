// Runs a Python script with whichever interpreter this computer has: python3, python, or py (Windows launcher).
import { spawnSync } from "node:child_process";

export function runPython(args) {
  for (const cmd of ["python3", "python", "py"]) {
    const probe = spawnSync(cmd, ["--version"], { encoding: "utf8", shell: process.platform === "win32" });
    if (probe.status === 0 && /Python 3\.(\d+)/.test(probe.stdout + probe.stderr)) {
      const minor = Number(/Python 3\.(\d+)/.exec(probe.stdout + probe.stderr)[1]);
      if (minor < 8) continue;
      const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
      if (r.status !== 0) process.exit(r.status ?? 1);
      return;
    }
  }
  console.error("Python 3.8 or newer was not found. Install it from https://www.python.org/downloads/ and try again.");
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("run-python.mjs")) {
  runPython(process.argv.slice(2));
}
