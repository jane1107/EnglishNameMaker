import { spawn } from "node:child_process";

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

function runNpmScript(scriptName) {
  return spawn(npmCmd, ["run", scriptName], {
    stdio: "inherit"
  });
}

const serverProcess = runNpmScript("server");
const clientProcess = runNpmScript("dev");
const children = [serverProcess, clientProcess];

let shuttingDown = false;

function stopAll(signal = "SIGTERM") {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

function handleExit(name, otherChild) {
  return (code, signal) => {
    if (shuttingDown) return;

    if (code === 0 || signal) {
      stopAll("SIGTERM");
      process.exit(0);
      return;
    }

    console.error(`[start] ${name} exited with code ${code}`);
    if (otherChild && !otherChild.killed) {
      otherChild.kill("SIGTERM");
    }
    process.exit(code || 1);
  };
}

serverProcess.on("exit", handleExit("server", clientProcess));
clientProcess.on("exit", handleExit("client", serverProcess));

process.on("SIGINT", () => {
  stopAll("SIGINT");
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopAll("SIGTERM");
  process.exit(0);
});
