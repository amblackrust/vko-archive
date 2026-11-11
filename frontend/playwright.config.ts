import { defineConfig, devices } from "@playwright/test";

/** E2E (T7.7). Серверы поднимает `npm run e2e` (e2e/run.sh): web :3201, API :8201. */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_WEB ?? "http://localhost:3201",
    headless: true,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  projects: [{ name: "chromium", use: {} }],
});
