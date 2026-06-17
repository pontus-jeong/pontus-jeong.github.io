import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { importTistoryBackup } from "../src/import/importer.ts"

const backupZipPath = "/Users/bada/Downloads/bluebada-1-1-article1-21.zip"

const importedPosts = async () =>
  importTistoryBackup({
    zipPath: backupZipPath,
    dryRun: true,
  })

describe("Tistory body conversion", () => {
  it("Given post 20 body HTML When sanitized Then headings, links, text, and images are preserved", async () => {
    const result = await importedPosts()
    const post = result.posts.find((candidate) => candidate.id === 20)

    expect(post?.title).toBe(
      "[Flutter에 홈 위젯 만들기] #1. Android Glance로 반응형 위젯 레이아웃 만들기",
    )
    expect(post?.bodyHtml).toContain("Glance로 위젯 개발 시작하기")
    expect(post?.bodyHtml).toContain("/assets/posts/20/img-001.jpg")
    expect(post?.bodyHtml).not.toContain("<script")
    expect(post?.bodyHtml).not.toContain("javascript:")
  })

  it("Given article 14 notebook-like HTML When imported Then a sanitized legacy artifact is generated", async () => {
    const outputDir = join(process.cwd(), ".tmp", "body-converter-output")
    await importTistoryBackup({
      zipPath: backupZipPath,
      outputDir,
    })

    const legacyHtml = await readFile(
      join(outputDir, "public", "legacy", "14", "index.html"),
      "utf8",
    )
    const postJson = await readFile(join(outputDir, "src", "content", "tistory", "14.json"), "utf8")

    expect(legacyHtml).toContain("임시)음성 파일 전처리")
    expect(legacyHtml).not.toContain("<script")
    expect(legacyHtml).not.toContain(" onload=")
    expect(legacyHtml).not.toContain(" onclick=")
    expect(legacyHtml).not.toContain("javascript:")
    expect(postJson).toContain('"legacy": true')
    expect(postJson).toContain('"legacyArtifactPath": "/legacy/14/index.html"')
  })
})
