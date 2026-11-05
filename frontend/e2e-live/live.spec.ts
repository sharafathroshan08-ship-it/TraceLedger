import { expect, test } from "@playwright/test";

test("live deployment works end to end", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const badResponses: string[] = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      badResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Follow the money/i }),
  ).toBeVisible();

  await page.getByRole("link", { name: /Enter the demo/i }).first().click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Total accounts")).toBeVisible();
  await expect(page.getByText("15", { exact: true }).first()).toBeVisible();

  await page.getByRole("link", { name: "Accounts" }).click();
  await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();
  await expect(page.getByText("ACC1001")).toBeVisible();

  await page.getByRole("link", { name: "Network" }).click();
  await expect(page.getByRole("heading", { name: "Network" })).toBeVisible();
  await expect(page.locator(".react-flow").first()).toBeVisible();

  await page.getByRole("link", { name: "Investigations" }).click();
  await expect(
    page.getByRole("heading", { name: "Investigations" }),
  ).toBeVisible();

  expect(pageErrors).toEqual([]);
  console.log("BAD_RESPONSES", JSON.stringify(badResponses, null, 2));
  expect(badResponses.filter((r) => r.startsWith("5"))).toEqual([]);
});
