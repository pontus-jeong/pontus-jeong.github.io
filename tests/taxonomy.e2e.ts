import { expect, test } from "@playwright/test"
import { taxonomySlugForLabel } from "../src/lib/content-slugs.ts"
import { capturePng } from "./capture-png.ts"

test("Given imported posts When archive and Flutter category load Then counts match metadata", async ({
  page,
}) => {
  await page.goto("/archive/")

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Archive")
  await expect(page.locator("[data-post-id]")).toHaveCount(14)

  const flutterSlug = taxonomySlugForLabel("category", "Flutter").slug
  await page.goto(`/categories/${flutterSlug}/`)

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Flutter")
  await expect(page.locator("[data-post-id]")).toHaveCount(5)
  await expect(page.locator("[data-post-id='21']")).toBeVisible()
  await expect(page.locator("[data-post-id='17']")).toBeVisible()

  await capturePng(page, "evidence/task-8-archive-category.png")
})

test("Given Korean-only tags When tag pages are generated Then routes are unique and headings use display labels", async ({
  page,
}) => {
  const embeddedSlug = taxonomySlugForLabel("tag", "임베디드").slug
  const raspberrySlug = taxonomySlugForLabel("tag", "라즈베리파이").slug
  expect(embeddedSlug).not.toBe(raspberrySlug)

  await page.goto(`/tags/${embeddedSlug}/`)
  await expect(page.getByRole("heading", { level: 1 })).toContainText("임베디드")
  await expect(page.locator("[data-post-id='21']")).toBeVisible()

  await page.goto(`/tags/${raspberrySlug}/`)
  await expect(page.getByRole("heading", { level: 1 })).toContainText("라즈베리파이")
  await expect(page.locator("[data-post-id='21']")).toBeVisible()

  await capturePng(page, "evidence/task-8-korean-tags.png")
})
