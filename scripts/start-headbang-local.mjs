import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const port = Number(process.argv[2] ?? 4173);
const url = `http://127.0.0.1:${port}/headbangdealers_the_game/`;
try {
  const response = await fetch(url);
  if (response.ok) {
    console.log(`Servidor ya activo: ${url}`);
    process.exit(0);
  }
} catch {}

const vite = resolve("node_modules/vite/bin/vite.js");
const child = spawn(process.execPath, [vite, "--host", "127.0.0.1", "--port", String(port)], {
  cwd: process.cwd(),
  detached: true,
  stdio: "ignore",
  windowsHide: true,
});
child.unref();
await mkdir(resolve("preview"), { recursive: true });
await writeFile(resolve("preview/local-headbang-server.json"), `${JSON.stringify({ pid: child.pid, port, url, startedAt: new Date().toISOString() }, null, 2)}\n`);
for (let attempt = 0; attempt < 50; attempt += 1) {
  try {
    const response = await fetch(url);
    if (response.ok) {
      console.log(`Servidor local activo: ${url} (PID ${child.pid})`);
      process.exit(0);
    }
  } catch {}
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 120));
}
throw new Error(`El servidor no respondió en ${url}`);
