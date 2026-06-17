import { expect, test } from "@playwright/test"

test("Given scaffold site When home loads Then provisional title is visible", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByRole("heading", { level: 1, name: "BlueBada" })).toBeVisible()
})
