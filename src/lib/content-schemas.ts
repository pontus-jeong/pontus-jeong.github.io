import { z } from "zod"

export const tistoryArticleIdSchema = z.number().int().positive().brand("TistoryArticleId")

export const postSlugSchema = z
  .string()
  .regex(/^\d+-[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .brand("PostSlug")

export const taxonomySlugValueSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-f]{8}$/)
  .brand("TaxonomySlug")

export const nonEmptyString = z.string().trim().min(1)

export const rawPostSchema = z.object({
  id: tistoryArticleIdSchema,
  title: nonEmptyString,
  slug: postSlugSchema,
  description: nonEmptyString,
  category: nonEmptyString,
  tags: z.array(nonEmptyString),
  publishedAt: z.iso.datetime({ offset: true }),
  sourcePath: nonEmptyString,
  legacyPaths: z.array(nonEmptyString),
  coverImage: nonEmptyString.optional(),
  bodyHtml: z.string(),
  legacy: z.boolean().default(false),
  legacyArtifactPath: nonEmptyString.optional(),
  draft: z.boolean().default(false),
})

export type TistoryArticleId = z.infer<typeof tistoryArticleIdSchema>
export type PostSlug = z.infer<typeof postSlugSchema>
export type TaxonomySlugValue = z.infer<typeof taxonomySlugValueSchema>
export type RawPost = z.infer<typeof rawPostSchema>

export type TaxonomyNamespace = "category" | "tag"

export type MetadataField =
  | "id"
  | "slug"
  | "description"
  | "category"
  | "tags"
  | "sourcePath"
  | "legacyPaths"
  | "legacy"
  | "draft"

export type LocalAssetField = "bodyHtml" | "coverImage" | "legacyArtifactPath"

export type TistoryPost = Readonly<{
  id: TistoryArticleId
  title: string
  slug: PostSlug
  description: string
  category: string
  tags: readonly string[]
  publishedAt: string
  sourcePath: string
  legacyPaths: readonly string[]
  coverImage?: string
  bodyHtml: string
  legacy: boolean
  legacyArtifactPath?: string
  draft: boolean
}>

export type ImportError =
  | { readonly kind: "MissingMetadata"; readonly field: MetadataField }
  | { readonly kind: "MissingTitle"; readonly field: "title" }
  | { readonly kind: "InvalidDate"; readonly field: "publishedAt" }
  | { readonly kind: "MissingBody"; readonly field: "bodyHtml" }
  | { readonly kind: "MissingLegacyArtifactPath"; readonly field: "legacyArtifactPath" }
  | { readonly kind: "DuplicateId"; readonly id: number }
  | { readonly kind: "DuplicateSlug"; readonly slug: string }
  | { readonly kind: "MalformedHtml"; readonly field: "bodyHtml" }
  | { readonly kind: "MissingLocalAsset"; readonly field: LocalAssetField; readonly path: string }
  | { readonly kind: "MalformedPost"; readonly field: string }

export type ParsePostResult =
  | { readonly kind: "ok"; readonly value: TistoryPost }
  | { readonly kind: "error"; readonly error: ImportError }

export type UniquePostKeysResult =
  | { readonly kind: "ok"; readonly value: readonly Readonly<{ id: number; slug: string }>[] }
  | { readonly kind: "error"; readonly error: ImportError }

export type TaxonomySlug = Readonly<{
  label: string
  slug: TaxonomySlugValue
}>

export type ParseTistoryPostOptions = Readonly<{
  localAssetPaths?: ReadonlySet<string>
}>
