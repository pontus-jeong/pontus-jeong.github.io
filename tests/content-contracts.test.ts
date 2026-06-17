import { describe, expect, it } from "vitest"
import {
  parseTistoryPost,
  slugFromPostTitle,
  type TistoryPost,
  taxonomySlugForLabel,
  validateUniquePostKeys,
} from "../src/lib/content-contracts"

const validPostInput = {
  id: 17,
  title: "[Flutter로 개인 블로그 만들기] #1. Flutter Web을 Github Pages에 업로드하기",
  slug: "17-flutter-1-flutter-web-github-pages",
  description: "Flutter Web을 Github Pages에 업로드하는 과정",
  category: "Flutter",
  tags: ["Flutter", "GitHub Pages"],
  publishedAt: "2024-09-18T17:07:53+09:00",
  sourcePath: "bluebada-1-1/17/17.html",
  legacyPaths: ["/17/"],
  bodyHtml: "<p>본문</p>",
  legacy: false,
  draft: false,
} as const

const expectParsedPost = (input: unknown): TistoryPost => {
  const parsed = parseTistoryPost(input)

  if (parsed.kind === "error") {
    throw new Error(`expected ok, got ${parsed.error.kind}`)
  }

  return parsed.value
}

describe("content contracts", () => {
  it("Given complete Tistory metadata When parsed Then a typed post contract is returned", () => {
    const post = expectParsedPost({ ...validPostInput, coverImage: "/assets/posts/17/img-001.png" })

    expect(post.id).toBe(17)
    expect(post.slug).toBe("17-flutter-1-flutter-web-github-pages")
    expect(post.bodyHtml).toBe("<p>본문</p>")
    expect(post.coverImage).toBe("/assets/posts/17/img-001.png")
  })

  it("Given missing title When parsed Then MissingTitle import error is returned", () => {
    const parsed = parseTistoryPost({ ...validPostInput, title: "" })

    expect(parsed).toEqual({ kind: "error", error: { kind: "MissingTitle", field: "title" } })
  })

  it("Given invalid date When parsed Then InvalidDate import error is returned", () => {
    const parsed = parseTistoryPost({ ...validPostInput, publishedAt: "not-a-date" })

    expect(parsed).toEqual({
      kind: "error",
      error: { kind: "InvalidDate", field: "publishedAt" },
    })
  })

  it("Given normal post without bodyHtml When parsed Then MissingBody import error is returned", () => {
    const parsed = parseTistoryPost({ ...validPostInput, bodyHtml: "" })

    expect(parsed).toEqual({ kind: "error", error: { kind: "MissingBody", field: "bodyHtml" } })
  })

  it("Given malformed bodyHtml When parsed Then MalformedHtml import error is returned", () => {
    const parsed = parseTistoryPost({
      ...validPostInput,
      bodyHtml: "<p><strong>broken</p>",
    })

    expect(parsed).toEqual({ kind: "error", error: { kind: "MalformedHtml", field: "bodyHtml" } })
  })

  it("Given bodyHtml references a missing local asset When parsed Then MissingLocalAsset is returned", () => {
    const parsed = parseTistoryPost(
      {
        ...validPostInput,
        bodyHtml: '<p><img src="/images/missing.png" alt=""></p>',
      },
      { localAssetPaths: new Set(["/images/existing.png"]) },
    )

    expect(parsed).toEqual({
      kind: "error",
      error: { kind: "MissingLocalAsset", field: "bodyHtml", path: "/images/missing.png" },
    })
  })

  it("Given nullable category metadata When parsed Then MissingMetadata import error is returned", () => {
    const parsed = parseTistoryPost({ ...validPostInput, category: null })

    expect(parsed).toEqual({
      kind: "error",
      error: { kind: "MissingMetadata", field: "category" },
    })
  })

  it("Given legacy post without artifact path When parsed Then MissingLegacyArtifactPath is returned", () => {
    const parsed = parseTistoryPost({ ...validPostInput, id: 14, slug: "14-post", legacy: true })

    expect(parsed).toEqual({
      kind: "error",
      error: { kind: "MissingLegacyArtifactPath", field: "legacyArtifactPath" },
    })
  })

  it("Given normal post with artifact path When parsed Then MalformedPost import error is returned", () => {
    const parsed = parseTistoryPost({
      ...validPostInput,
      legacyArtifactPath: "/legacy/17/index.html",
    })

    expect(parsed).toEqual({
      kind: "error",
      error: { kind: "MalformedPost", field: "legacyArtifactPath" },
    })
  })

  it("Given duplicate IDs When validated Then DuplicateId import error is returned", () => {
    const post = expectParsedPost(validPostInput)
    const otherPost = expectParsedPost({
      ...validPostInput,
      id: 18,
      title: "Another Flutter note",
      slug: "18-another-flutter-note",
    })
    const duplicate = { ...otherPost, id: post.id }

    const result = validateUniquePostKeys([post, duplicate])

    expect(result).toEqual({ kind: "error", error: { kind: "DuplicateId", id: 17 } })
  })

  it("Given duplicate slugs When validated Then DuplicateSlug import error is returned", () => {
    const post = expectParsedPost(validPostInput)
    const otherPost = expectParsedPost({
      ...validPostInput,
      id: 18,
      title: "Another Flutter note",
      slug: "18-another-flutter-note",
    })
    const duplicate = { ...otherPost, slug: post.slug }

    const result = validateUniquePostKeys([post, duplicate])

    expect(result).toEqual({
      kind: "error",
      error: { kind: "DuplicateSlug", slug: "17-flutter-1-flutter-web-github-pages" },
    })
  })

  it("Given Korean-only post title When slug is generated Then ASCII fallback is prefixed by ID", () => {
    const slug = slugFromPostTitle(21, "새로운 시작")

    expect(slug).toBe("21-post")
  })

  it("Given Korean-only tag labels When taxonomy slugs are generated Then each slug is deterministic and unique", () => {
    const firstTag = taxonomySlugForLabel("tag", "개발")
    const secondTag = taxonomySlugForLabel("tag", "테스트")
    const category = taxonomySlugForLabel("category", "개발")

    expect(firstTag).toEqual({ label: "개발", slug: "tag-8b9517ee" })
    expect(secondTag).toEqual({ label: "테스트", slug: "tag-019e6cb7" })
    expect(category).toEqual({ label: "개발", slug: "category-19801b1d" })
    expect(new Set([firstTag.slug, secondTag.slug, category.slug]).size).toBe(3)
  })

  it("Given ASCII taxonomy labels When taxonomy slugs are generated Then readable fragments still include stable hashes", () => {
    const tag = taxonomySlugForLabel("tag", "GitHub Pages")
    const category = taxonomySlugForLabel("category", "Flutter")

    expect(tag).toEqual({ label: "GitHub Pages", slug: "github-pages-ac056242" })
    expect(category).toEqual({ label: "Flutter", slug: "flutter-0a165622" })
  })
})
