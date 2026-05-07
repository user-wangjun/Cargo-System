import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:8134",
    headless: true,
    trace: "on-first-retry",
  },
  webServer: {
    command: "python -m http.server 8134 --bind 127.0.0.1",
    cwd: "D:/Users/Desktop/CargoSystem/frontend",
    url: "http://127.0.0.1:8134/admin/orders.html",
    reuseExistingServer: true,
    stdout: "ignore",
    stderr: "pipe",
    timeout: 30_000,
  },
});
