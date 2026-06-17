import { readFile } from "node:fs/promises"
import { expect, test } from "@playwright/test"
import { capturePng } from "./capture-png.ts"

const localPost8AssetPattern = /\/assets\/posts\/8\/img-\d{3}\.(?:png|jpg|jpeg|gif|webp)/giu

const post8LocalAssetPaths = async (): Promise<readonly string[]> => {
  const postJson = await readFile("src/content/tistory/8.json", "utf8")
  const matches = Array.from(postJson.matchAll(localPost8AssetPattern))
  const paths = matches.flatMap((match) => {
    const assetPath = match[0]
    return assetPath === undefined ? [] : [assetPath]
  })

  return Array.from(new Set(paths)).sort()
}

test("Given post 8 local images When rendered from copied assets Then images load with nonzero dimensions", async ({
  page,
}) => {
  const failedAssetResponses: string[] = []
  page.on("response", (response) => {
    const url = response.url()
    if (url.includes("/assets/posts/8/") && response.status() >= 400) {
      failedAssetResponses.push(`${response.status().toString()} ${url}`)
    }
  })

  const assetPaths = await post8LocalAssetPaths()
  expect(assetPaths.length).toBeGreaterThanOrEqual(20)

  await page.goto("/")
  await page.setContent(
    [
      "<!doctype html>",
      '<html lang="ko">',
      "<body>",
      ...assetPaths.map((assetPath) => `<img src="${assetPath}" alt="">`),
      "</body>",
      "</html>",
    ].join(""),
  )

  await page.waitForLoadState("networkidle")

  await expect
    .poll(() =>
      page
        .locator("img")
        .evaluateAll(
          (elements) =>
            elements.filter(
              (element) =>
                element instanceof HTMLImageElement &&
                element.naturalWidth > 0 &&
                element.naturalHeight > 0,
            ).length,
        ),
    )
    .toBe(assetPaths.length)

  const dimensions = await page.locator("img").evaluateAll((elements) =>
    elements.map((element) => {
      if (!(element instanceof HTMLImageElement)) {
        return { height: 0, width: 0 }
      }

      return { height: element.naturalHeight, width: element.naturalWidth }
    }),
  )

  expect(failedAssetResponses).toEqual([])
  expect(dimensions.filter((size) => size.width > 0 && size.height > 0)).toHaveLength(
    assetPaths.length,
  )

  await capturePng(page, "evidence/task-6-post-8-images.png")
})
