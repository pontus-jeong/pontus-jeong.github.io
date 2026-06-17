import { mkdir, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import type { Page } from "@playwright/test"

export const capturePng = async (page: Page, screenshotPath: string): Promise<void> => {
  await mkdir(dirname(screenshotPath), { recursive: true })
  const session = await page.context().newCDPSession(page)
  try {
    const result = await session.send("Page.captureScreenshot", {
      captureBeyondViewport: true,
      format: "png",
      fromSurface: true,
    })
    await writeFile(screenshotPath, result.data, "base64")
  } finally {
    await session.detach()
  }
}
