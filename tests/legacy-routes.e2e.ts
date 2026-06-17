import { expect, test } from "@playwright/test"
import { capturePng } from "./capture-png.ts"

test("Given legacy ID 17 When opened Then it links to post 17 canonical page", async ({ page }) => {
  await page.goto("/17/")

  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "[Flutter로 개인 블로그 만들기] #1",
  )
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://pontus-jeong.github.io/posts/17-flutter-1-flutter-web-github-pages/",
  )

  await page.getByRole("link", { name: "canonical post" }).click()

  await expect(page).toHaveURL(/\/posts\/17-flutter-1-flutter-web-github-pages\/$/u)
  await capturePng(page, "evidence/task-9-legacy-17.png")
})

test("Given missing ID 7 When opened Then 404 is shown", async ({ page }) => {
  const response = await page.goto("/7/")

  expect(response?.status()).toBe(404)
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Not Found")
  await expect(page.locator("body")).not.toContainText("[Flutter로 개인 블로그 만들기]")
})
