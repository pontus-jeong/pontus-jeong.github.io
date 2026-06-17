import { expect, test } from "@playwright/test"
import { capturePng } from "./capture-png.ts"

test("Given generated blog full user journey When browsing home archive and post Then core content is visible", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("console", (message) => {
    const text = message.text()
    const expectedSandboxBlock =
      text.includes("/legacy/14/index.html") && text.includes("frame is sandboxed")
    if (message.type() === "error" && !expectedSandboxBlock) {
      errors.push(text)
    }
  })

  await page.setViewportSize({ height: 900, width: 1280 })
  await page.goto("/")
  await expect(page.locator("[data-post-id]")).toHaveCount(14)
  await capturePng(page, "evidence/task-10-desktop-home.png")

  await page.getByRole("link", { exact: true, name: "Archive" }).click()
  await expect(page).toHaveURL(/\/archive\/$/u)
  await expect(page.locator("[data-post-id]")).toHaveCount(14)

  await page.goto("/posts/21-flutter-flutter-elinux/")
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "임베디드 리눅스를 위한 Flutter",
  )
  await expect(page.locator(".article-body")).toContainText("flutter-elinux")
  await capturePng(page, "evidence/task-10-desktop-post.png")

  await page.goto("/posts/14-post/")
  await expect(page.getByRole("heading", { level: 1 })).toContainText("임시)음성 파일 전처리")
  await expect(page.locator('iframe[src="/legacy/14/index.html"]')).toHaveAttribute("sandbox", "")

  await page.setViewportSize({ height: 844, width: 390 })
  await page.goto("/posts/8-putty-windows-rails/")
  const articleImages = page.locator('.article-body img[src^="/assets/posts/8/"]')
  const imageCount = await articleImages.count()
  expect(imageCount).toBeGreaterThanOrEqual(20)
  await expect
    .poll(() =>
      articleImages.evaluateAll(
        (elements) =>
          elements.filter(
            (element) =>
              element instanceof HTMLImageElement &&
              element.naturalWidth > 0 &&
              element.naturalHeight > 0,
          ).length,
      ),
    )
    .toBe(imageCount)
  await expect
    .poll(() =>
      page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      })),
    )
    .toEqual({ clientWidth: 390, scrollWidth: 390 })
  await capturePng(page, "evidence/task-10-mobile-post.png")

  await page.goto("/17/")
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://pontus-jeong.github.io/posts/17-flutter-1-flutter-web-github-pages/",
  )

  expect(errors).toEqual([])
  await capturePng(page, "evidence/task-10-browser-journey.png")
})
