import { expect, test } from "@playwright/test";

/**
 * End-to-end smoke flow.
 *
 * Requires the FastAPI backend on http://localhost:8000 and the Next.js app
 * (started automatically by playwright.config.ts). Every visitor gets an
 * isolated workspace, so the specs mutate their own data only.
 */

test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
});

test("landing page opens an isolated dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Follow the money/i }),
  ).toBeVisible();

  await page.getByRole("link", { name: /Enter the demo/i }).first().click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Suspicious findings")).toBeVisible();
  await expect(page.getByText("Recent transactions")).toBeVisible();
  await expect(page.getByText("Detection breakdown")).toBeVisible();

  // The workspace statistics are read from the seeded demo data.
  await expect(page.getByText("Total accounts")).toBeVisible();
  await expect(page.getByText("15", { exact: true }).first()).toBeVisible();
});

test("accounts can be created, searched and deleted", async ({ page }) => {
  await page.goto("/accounts");
  await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();

  await page.getByRole("button", { name: "Add account" }).first().click();
  await page.getByLabel("Account number").fill("ACC9001");
  await page.getByLabel("Account holder").fill("E2E Tester");
  await page.getByLabel("Opening balance (₹)").fill("2500");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText("ACC9001")).toBeVisible();

  const search = page.getByPlaceholder("Search by account number or holder");
  await search.fill("ACC9001");
  await expect(page.getByText("ACC9001")).toBeVisible();
  await expect(page.getByText("ACC1001")).toHaveCount(0);

  await page.getByRole("button", { name: "Delete ACC9001" }).click();
  await expect(page.getByText("ACC9001")).toHaveCount(0);

  // Clearing the filter brings the seeded accounts back.
  await search.fill("");
  await expect(page.getByText("ACC1001")).toBeVisible();
});

test("transactions are directed edges with reversable balances", async ({ page }) => {
  await page.goto("/transactions");
  await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible();

  await page.getByRole("button", { name: "Add transaction" }).click();
  await page.getByLabel("From account").selectOption({ label: "ACC1001 · Aarav Sharma" });
  await page
    .getByLabel("To account")
    .selectOption({ label: "ACC1002 · Meera Iyer" });
  await page.getByLabel("Amount (₹)").fill("1234.50");
  await page.getByLabel("Description (optional)").fill("E2E transfer");
  await page.getByRole("button", { name: "Create transaction" }).click();

  const row = page.locator("tr", { hasText: "E2E transfer" });
  await expect(row).toHaveCount(1);
  await expect(row.getByText("₹1,234.50")).toBeVisible();

  await row.getByRole("button", { name: /Delete transaction/ }).click();
  await expect(page.getByText("E2E transfer")).toHaveCount(0);
});

test("investigation runs real DFS, finds patterns and produces a report", async ({
  page,
}) => {
  await page.goto("/investigations");
  await expect(page.getByRole("heading", { name: "Investigations" })).toBeVisible();

  await page.getByRole("button", { name: "Run investigation" }).click();

  await expect(page.getByRole("heading", { name: /DFS traversal/ })).toBeVisible();
  await expect(page.getByText("Visited", { exact: true })).toBeVisible();
  // The main component has 13 reachable accounts from ACC1001.
  await expect(
    page.getByTestId("dfs-traversal").getByText("ACC1013"),
  ).toBeVisible();
  await expect(page.getByText("Findings", { exact: true })).toBeVisible();
  await expect(page.getByText(/Rule-based indicators/)).toBeVisible();

  // At least one severity badge is rendered in the findings list.
  await expect(page.getByText("high", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Open report" }).click();
  await expect(page).toHaveURL(/\/reports\?investigation=\d+/);
  await expect(page.getByText(/Investigation #\d+/)).toBeVisible();
  await expect(page.getByText("2. Depth-first search")).toBeVisible();
  await expect(page.getByText(/ACC1001/).first()).toBeVisible();
  await expect(page.getByText(/rule-based heuristics/)).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Findings CSV/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/findings\.csv$/);
});

test("network renders the graph and highlights a DFS traversal", async ({ page }) => {
  await page.goto("/network");
  await expect(page.getByRole("heading", { name: "Network" })).toBeVisible();
  await expect(page.getByText("Weakly connected components")).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(15);

  await page.getByRole("button", { name: "Run DFS" }).click();
  await expect(page.getByText("Traversal order")).toBeVisible();
  await expect(page.getByText(/time O\(V \+ E\)/)).toBeVisible();

  // Clicking an account node opens its inspector.
  await page.locator(".react-flow__node", { hasText: "ACC1001" }).click();
  await expect(page.getByText("Points to")).toBeVisible();
  await expect(page.getByRole("button", { name: /Trace from here/ })).toBeVisible();
});

test("settings can reset the demo dataset", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Workspace", exact: true })).toBeVisible();
  await expect(page.getByText("What the seed contains")).toBeVisible();

  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByText(/Demo dataset restored/)).toBeVisible();
});

test("mobile layout exposes the navigation drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await expect(page.getByRole("link", { name: "Investigations" })).toBeVisible();
});
