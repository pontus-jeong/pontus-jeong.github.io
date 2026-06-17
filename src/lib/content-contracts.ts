import type { z } from "zod"
import { bodyHtmlLocalAssets, htmlIsBalanced, isLocalAssetPath } from "./content-html.ts"
import {
  type ImportError,
  type LocalAssetField,
  type ParsePostResult,
  type ParseTistoryPostOptions,
  type RawPost,
  rawPostSchema,
  type TistoryPost,
  type UniquePostKeysResult,
} from "./content-schemas.ts"
import { slugFromPostTitle } from "./content-slugs.ts"

export type {
  ImportError,
  LocalAssetField,
  MetadataField,
  ParsePostResult,
  ParseTistoryPostOptions,
  PostSlug,
  TaxonomyNamespace,
  TaxonomySlug,
  TaxonomySlugValue,
  TistoryArticleId,
  TistoryPost,
  UniquePostKeysResult,
} from "./content-schemas.ts"

export { slugFromPostTitle, taxonomySlugForLabel } from "./content-slugs.ts"

export const parseTistoryPost = (
  input: unknown,
  options: ParseTistoryPostOptions = {},
): ParsePostResult => {
  const parsed = rawPostSchema.safeParse(input)

  if (!parsed.success) {
    return { kind: "error", error: mapPostIssue(parsed.error.issues[0]) }
  }

  const post = toTistoryPost(parsed.data)
  const contractError = validatePostContract(post, options.localAssetPaths)

  return contractError === undefined
    ? { kind: "ok", value: post }
    : { kind: "error", error: contractError }
}

export const validateUniquePostKeys = (
  posts: readonly Readonly<{ id: number; slug: string }>[],
): UniquePostKeysResult => {
  const ids = new Set<number>()
  const slugs = new Set<string>()

  for (const post of posts) {
    if (ids.has(post.id)) {
      return { kind: "error", error: { kind: "DuplicateId", id: post.id } }
    }
    if (slugs.has(post.slug)) {
      return { kind: "error", error: { kind: "DuplicateSlug", slug: post.slug } }
    }
    ids.add(post.id)
    slugs.add(post.slug)
  }

  return { kind: "ok", value: posts }
}

const validatePostContract = (
  post: TistoryPost,
  localAssetPaths: ReadonlySet<string> | undefined,
): ImportError | undefined => {
  if (post.legacy && post.legacyArtifactPath === undefined) {
    return { kind: "MissingLegacyArtifactPath", field: "legacyArtifactPath" }
  }
  if (post.slug !== slugFromPostTitle(post.id, post.title)) {
    return { kind: "MalformedPost", field: "slug" }
  }
  if (!post.legacy && post.legacyArtifactPath !== undefined) {
    return { kind: "MalformedPost", field: "legacyArtifactPath" }
  }
  if (!post.legacy && post.bodyHtml.trim().length === 0) {
    return { kind: "MissingBody", field: "bodyHtml" }
  }
  if (!htmlIsBalanced(post.bodyHtml)) {
    return { kind: "MalformedHtml", field: "bodyHtml" }
  }

  return firstMissingLocalAsset(post, localAssetPaths)
}

const toTistoryPost = (post: RawPost): TistoryPost => ({
  id: post.id,
  title: post.title,
  slug: post.slug,
  description: post.description,
  category: post.category,
  tags: post.tags,
  publishedAt: post.publishedAt,
  sourcePath: post.sourcePath,
  legacyPaths: post.legacyPaths,
  bodyHtml: post.bodyHtml,
  legacy: post.legacy,
  draft: post.draft,
  ...(post.coverImage === undefined ? {} : { coverImage: post.coverImage }),
  ...(post.legacyArtifactPath === undefined ? {} : { legacyArtifactPath: post.legacyArtifactPath }),
})

const firstMissingLocalAsset = (
  post: TistoryPost,
  localAssetPaths: ReadonlySet<string> | undefined,
): ImportError | undefined => {
  if (localAssetPaths === undefined) {
    return undefined
  }

  const directAssets = [
    { field: "coverImage", path: post.coverImage },
    { field: "legacyArtifactPath", path: post.legacyArtifactPath },
  ] satisfies readonly Readonly<{ field: LocalAssetField; path: string | undefined }>[]

  for (const asset of directAssets) {
    if (
      asset.path !== undefined &&
      isLocalAssetPath(asset.path) &&
      !localAssetPaths.has(asset.path)
    ) {
      return { kind: "MissingLocalAsset", field: asset.field, path: asset.path }
    }
  }

  for (const path of bodyHtmlLocalAssets(post.bodyHtml)) {
    if (!localAssetPaths.has(path)) {
      return { kind: "MissingLocalAsset", field: "bodyHtml", path }
    }
  }

  return undefined
}

const mapPostIssue = (issue: z.core.$ZodIssue | undefined): ImportError => {
  const field = issue?.path[0]

  if (field === "title") {
    return { kind: "MissingTitle", field: "title" }
  }
  if (field === "publishedAt") {
    return { kind: "InvalidDate", field: "publishedAt" }
  }
  if (field === "bodyHtml") {
    return { kind: "MissingBody", field: "bodyHtml" }
  }

  return metadataErrorForField(field)
}

const metadataErrorForField = (field: PropertyKey | undefined): ImportError => {
  switch (field) {
    case "id":
    case "slug":
    case "description":
    case "category":
    case "tags":
    case "sourcePath":
    case "legacyPaths":
    case "legacy":
    case "draft":
      return { kind: "MissingMetadata", field }
    default:
      return { kind: "MalformedPost", field: "post" }
  }
}
