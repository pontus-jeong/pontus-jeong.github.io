import { execFileSync } from "node:child_process"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { beforeAll, describe, expect, it } from "vitest"
import { z } from "zod"

const searchRecordSchema = z.object({
  title: z.string(),
  category: z.string(),
  tags: z.array(z.string()),
  date: z.string(),
  excerpt: z.string(),
  url: z.url(),
})

const searchIndexSchema = z.array(searchRecordSchema)

describe("built feed and index outputs", () => {
  beforeAll(() => {
    execFileSync("pnpm", ["run", "build"], { stdio: "pipe" })
  }, 60_000)

  it("Given built site When RSS and search index are parsed Then each includes 14 posts", async () => {
    const rss = await readFile(join(process.cwd(), "dist", "rss.xml"), "utf8")
    const search = await readFile(join(process.cwd(), "dist", "search-index.json"), "utf8")

    expect(rss.match(/<item>/gu) ?? []).toHaveLength(14)
    expect(rss).toContain("21-flutter-flutter-elinux")

    const parsedSearch = searchIndexSchema.parse(JSON.parse(search))
    expect(parsedSearch).toHaveLength(14)
    expect(parsedSearch.map((record) => record.url)).toContain(
      "https://pontus-jeong.github.io/posts/21-flutter-flutter-elinux/",
    )
  })

  it("Given built site When sitemap is parsed Then it includes core pages and posts", async () => {
    const sitemap = await readFile(join(process.cwd(), "dist", "sitemap.xml"), "utf8")

    expect(sitemap).toContain("https://pontus-jeong.github.io/")
    expect(sitemap).toContain("https://pontus-jeong.github.io/archive/")
    expect(sitemap).toContain("https://pontus-jeong.github.io/categories/")
    expect(sitemap).toContain("https://pontus-jeong.github.io/tags/")
    expect(sitemap).toContain("https://pontus-jeong.github.io/posts/21-flutter-flutter-elinux/")
  })
})
