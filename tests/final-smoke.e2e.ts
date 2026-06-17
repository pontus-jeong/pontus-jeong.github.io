import { expect, test } from "@playwright/test"
import { capturePng } from "./capture-png.ts"

test("Given full imported site When previewed Then representative pages and endpoints pass", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" })
  await expect(page.locator("[data-post-id]")).toHaveCount(14)

  await page.goto("/posts/21-flutter-flutter-elinux/", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "임베디드 리눅스를 위한 Flutter",
  )

  const rssResponse = await page.goto("/rss.xml", { waitUntil: "domcontentloaded" })
  expect(rssResponse?.status()).toBe(200)
  await expect(page.locator("body")).toContainText("21-flutter-flutter-elinux")
})

test("Given full imported site When browser QA runs Then no critical page fails", async ({
  page,
}) => {
  const consoleErrors: string[] = []
  page.on("console", (message) => {
    const text = message.text()
    const expectedSandboxBlock =
      text.includes("/legacy/14/index.html") && text.includes("frame is sandboxed")
    if (message.type() === "error" && !expectedSandboxBlock) {
      consoleErrors.push(text)
    }
  })

  await page.goto("/", { waitUntil: "domcontentloaded" })
  await expect(page.locator("[data-post-id]")).toHaveCount(14)
  await capturePng(page, "evidence/task-11-final-browser/home.png")

  await page.goto("/archive/", { waitUntil: "domcontentloaded" })
  await expect(page.locator("[data-post-id]")).toHaveCount(14)

  await page.goto("/posts/21-flutter-flutter-elinux/", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "임베디드 리눅스를 위한 Flutter",
  )
  await capturePng(page, "evidence/task-11-final-browser/post-21.png")

  await page.goto("/posts/14-post/", { waitUntil: "domcontentloaded" })
  await expect(page.locator('iframe[src="/legacy/14/index.html"]')).toHaveAttribute("sandbox", "")
  await capturePng(page, "evidence/task-11-final-browser/post-14.png")

  await page.setViewportSize({ height: 844, width: 390 })
  await page.goto("/posts/8-putty-windows-rails/", { waitUntil: "domcontentloaded" })
  await expect
    .poll(() =>
      page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      })),
    )
    .toEqual({ clientWidth: 390, scrollWidth: 390 })

  await capturePng(page, "evidence/task-11-final-browser/post-8-mobile.png")
  expect(consoleErrors).toEqual([])
})

test("Given full imported site When missing legacy ID 7 is requested Then no post content is served", async ({
  page,
}) => {
  const response = await page.goto("/7/")

  expect(response?.status()).toBe(404)
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Not Found")
  await expect(page.locator("body")).not.toContainText("[Flutter로 개인 블로그 만들기]")
})
