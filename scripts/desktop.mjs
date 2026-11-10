import { spawn } from "node:child_process";
import { binaryPath } from "mygo-cli";

// MyGo 0.8.3's npm shim calls process.execve without an environment on
// recent Node versions. Spawn explicitly so Go, Bun and signing tools retain PATH.
const child = spawn(binaryPath(), process.argv.slice(2), {
  stdio: "inherit",
  env: process.env,
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => { process.exitCode = code ?? 1; });
