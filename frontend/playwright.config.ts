import { defineConfig } from "@playwright/test";
import os from "node:os";

/**
 * Local Windows machines already ship Microsoft Edge, so the suite defaults to
 * the Edge channel instead of downloading a browser. On Linux CI, set
 * PLAYWRIGHT_CHANNEL=chromium (after `npx playwright install chromium`) or
 * leave the channel empty to use Playwright's bundled browser.
 */
const channel =
  process.env.PLAYWRIGHT_CHANNEL ??
  (os.platform() === "win32" ? "msedge" : undefined);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    channel,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
