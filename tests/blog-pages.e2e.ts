import { expect, test } from "@playwright/test"
import { capturePng } from "./capture-png.ts"

test("Given imported content When home loads Then recent posts link to canonical pages for post 21", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text())
    }
  })

  await page.goto("/")

  const postLink = page.locator('[data-post-id="21"] a')
  await expect(postLink).toBeVisible()
  await expect(page.locator("[data-post-id]").first()).toContainText("2025. 07. 23")

  await postLink.click()

  await expect(page).toHaveURL(/\/posts\/21-flutter-flutter-elinux\/$/u)
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "임베디드 리눅스를 위한 Flutter",
  )
  await expect(page.locator(".article-body")).toContainText("flutter-elinux")
  await expect(
    page.locator(".post-meta").getByRole("link", { exact: true, name: "Flutter" }),
  ).toBeVisible()
  expect(errors).toEqual([])

  await capturePng(page, "evidence/task-7-home-to-post-21.png")
})

test("Given mobile viewport When image-heavy post opens Then document has no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 })
  await page.goto("/posts/8-putty-windows-rails/")

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Putty")
  await expect
    .poll(() =>
      page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      })),
    )
    .toEqual({ clientWidth: 390, scrollWidth: 390 })

  await capturePng(page, "evidence/task-7-mobile-post-8.png")
})

test("Given legacy article 14 When canonical post opens Then sandboxed iframe and fallback render", async ({
  page,
}) => {
  await page.goto("/posts/14-post/")

  await expect(page.getByRole("heading", { level: 1 })).toContainText("임시)음성 파일 전처리")
  await expect(page.locator('iframe[src="/legacy/14/index.html"]')).toHaveAttribute("sandbox", "")
  await expect(page.getByRole("link", { name: "원문 보존 페이지 열기" })).toHaveAttribute(
    "href",
    "/legacy/14/index.html",
  )
})
