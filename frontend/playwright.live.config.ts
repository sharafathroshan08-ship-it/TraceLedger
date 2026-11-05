import { defineConfig } from "@playwright/test";
import os from "node:os";

const channel =
  process.env.PLAYWRIGHT_CHANNEL ??
  (os.platform() === "win32" ? "msedge" : undefined);

export default defineConfig({
  testDir: "./e2e-live",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    channel,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
