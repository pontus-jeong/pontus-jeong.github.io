import { readFileSync } from "node:fs"
import { z } from "astro/zod"
import { describe, expect, it } from "vitest"

const contentConfigSource = readFileSync(
  new URL("../src/content.config.ts", import.meta.url),
  "utf8",
)

const validPostInput = {
  id: 20,
  title: "Flutter technical note",
  slug: "20-flutter-technical-note",
  description: "A migrated Tistory post",
  category: "Flutter",
  tags: ["Flutter"],
  publishedAt: "2024-10-01T10:30:00+09:00",
  sourcePath: "bluebada-1-1/20/20.html",
  legacyPaths: ["/20/"],
  bodyHtml: "<p>본문</p>",
} as const

const loadTistoryPostSchema = (): z.ZodType => {
  const sourceWithoutImports = contentConfigSource.replaceAll(/^import .*\n/gm, "")
  const moduleSource = sourceWithoutImports
    .replace("export const tistoryPostSchema =", "const tistoryPostSchema =")
    .replace("export const collections =", "const collections =")

  if (moduleSource === sourceWithoutImports) {
    throw new Error("content config must export tistoryPostSchema for direct contract tests")
  }

  const moduleFactory = new Function(
    "z",
    "defineCollection",
    "glob",
    `${moduleSource}; return tistoryPostSchema`,
  )
  const schema = moduleFactory(
    z,
    (collection: unknown): unknown => collection,
    (config: unknown): unknown => config,
  )

  if (!(schema instanceof z.ZodType)) {
    throw new Error("content config tistoryPostSchema is not a Zod schema")
  }

  return schema
}

const expectSchemaFailureAt = (input: unknown, path: string): void => {
  const parsed = loadTistoryPostSchema().safeParse(input)

  expect(parsed.success).toBe(false)
  if (parsed.success) {
    throw new Error("expected schema parse to fail")
  }
  expect(parsed.error.issues.map((issue) => issue.path.join("."))).toContain(path)
}

describe("content config", () => {
  it("Given Tistory JSON content When config is inspected Then the collection uses Astro glob loader", () => {
    expect(contentConfigSource).toContain('import { glob } from "astro/loaders"')
    expect(contentConfigSource).toContain(
      'loader: glob({ pattern: "**/*.json", base: "./src/content/tistory" })',
    )
  })

  it("Given legacy metadata When config is inspected Then artifact paths are tied to legacy posts", () => {
    expect(contentConfigSource).toContain("legacyArtifactPath is required when legacy is true")
    expect(contentConfigSource).toContain("legacyArtifactPath is only allowed when legacy is true")
  })

  it("Given complete normal metadata When schema parses Then draft defaults false", () => {
    const parsed = loadTistoryPostSchema().safeParse(validPostInput)

    expect(parsed.success).toBe(true)
    if (!parsed.success) {
      throw new Error("expected schema parse to succeed")
    }
    expect(parsed.data).toMatchObject({ draft: false, legacy: false })
  })

  it("Given invalid imported metadata When schema parses Then required fields fail loudly", () => {
    expectSchemaFailureAt({ ...validPostInput, bodyHtml: "" }, "bodyHtml")
    expectSchemaFailureAt({ ...validPostInput, publishedAt: "2024-10-01" }, "publishedAt")
    expectSchemaFailureAt({ ...validPostInput, category: null }, "category")
  })

  it("Given legacy artifact metadata When schema parses Then legacy-only path rules are enforced", () => {
    expectSchemaFailureAt({ ...validPostInput, legacy: true }, "legacyArtifactPath")
    expectSchemaFailureAt(
      { ...validPostInput, legacyArtifactPath: "/legacy/20/index.html" },
      "legacyArtifactPath",
    )
  })
})
