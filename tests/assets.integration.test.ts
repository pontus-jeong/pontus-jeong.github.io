import { access, mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { importTistoryBackup } from "../src/import/importer.ts"

const backupZipPath = "/Users/bada/Downloads/bluebada-1-1-article1-21.zip"

describe("Tistory asset import", () => {
  it("Given post 8 local images When assets are copied Then rewritten paths exist", async () => {
    const outputDir = join(process.cwd(), ".tmp", "asset-import-output")
    await rm(outputDir, { force: true, recursive: true })

    const result = await importTistoryBackup({
      zipPath: backupZipPath,
      outputDir,
    })
    const post = result.posts.find((candidate) => candidate.id === 8)

    expect(post?.bodyHtml).toContain("http://railsinstaller.org/img/ri-logo.png")
    expect(post?.bodyHtml).toContain("/assets/posts/8/img-001.png")
    expect(post?.bodyHtml).not.toContain("./img/")
    expect(result.assetManifest.filter((asset) => asset.articleId === 8)).toHaveLength(28)

    await access(join(outputDir, "public", "assets", "posts", "8", "img-001.png"))
    await access(join(outputDir, "public", "assets", "posts", "8", "img-028.jpg"))
    await rm(outputDir, { force: true, recursive: true })
  })

  it("Given missing ./img reference When assets are copied Then MissingAsset error is reported", async () => {
    const inputDir = join(process.cwd(), ".tmp", "missing-asset-input")
    await rm(inputDir, { force: true, recursive: true })
    await mkdir(join(inputDir, "bluebada-1-1", "1"), { recursive: true })
    await writeFile(
      join(inputDir, "bluebada-1-1", "1", "1.html"),
      [
        '<html><body><h1 class="title-article">Asset test</h1>',
        '<span class="category">Test</span>',
        '<span class="date">2020-01-01 00:00:00</span>',
        '<div class="contents_style"><p><img src="./img/missing.png" alt=""></p></div>',
        "</body></html>",
      ].join(""),
      "utf8",
    )

    await expect(
      importTistoryBackup({ directoryPath: inputDir, dryRun: true }),
    ).rejects.toMatchObject({
      kind: "MissingAsset",
    })
    await rm(inputDir, { force: true, recursive: true })
  })
})
