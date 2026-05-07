import { defineConfig } from "@playwright/test";

const livePort = process.env.LIVE_FRONTEND_PORT || "8135";

export default defineConfig({
  testDir: "./e2e-live",
  timeout: 45_000,
  expect: {
    timeout: 8_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${livePort}`,
    headless: true,
    trace: "on-first-retry",
  },
  webServer: {
    command: `python -m http.server ${livePort} --bind 127.0.0.1`,
    cwd: "D:/Users/Desktop/CargoSystem/frontend",
    url: `http://127.0.0.1:${livePort}/admin/login.html`,
    reuseExistingServer: true,
    stdout: "ignore",
    stderr: "pipe",
    timeout: 30_000,
  },
});
