import { expect, test } from "@playwright/test"
import { capturePng } from "./capture-png.ts"

test("Given article 14 legacy artifact When opened in preview Then preserved content is readable and inert", async ({
  page,
}) => {
  await page.goto("/legacy/14/")

  await expect(page).toHaveTitle("임시)음성 파일 전처리")
  await expect(page.locator("body")).toContainText("kaggle_example_test")
  await expect(page.locator("body")).toContainText("spectrogram 값과 이미지화")
  await expect(page.locator("script")).toHaveCount(0)
  await expect(page.locator("[onload], [onclick]")).toHaveCount(0)
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0)

  await capturePng(page, "evidence/task-5-post-14.png")
})
