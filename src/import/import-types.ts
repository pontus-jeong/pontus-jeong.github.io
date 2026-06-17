import type { TistoryPost } from "../lib/content-contracts.ts"

export type SourceEntry = Readonly<{
  path: string
  bytes: Uint8Array
}>

export type SourceEntries = ReadonlyMap<string, Uint8Array>

export type ImportedArticle = Readonly<{
  id: number
  title: string
  slug: string
  description: string
  category: string
  tags: readonly string[]
  publishedAt: string
  sourcePath: string
  legacyPaths: readonly string[]
  bodyHtml: string
  legacyBodyHtml?: string
  legacy: boolean
  legacyArtifactPath?: string
  coverImage?: string
  localImageReferences: readonly string[]
  remoteImageReferences: readonly string[]
}>

export type TistoryInventory = Readonly<{
  articleCount: number
  imageCount: number
  discoveredIds: readonly number[]
  missingIds: readonly number[]
  warnings: readonly string[]
  articles: readonly ImportedArticle[]
  articlesById: Readonly<Record<number, ImportedArticle>>
}>

export type AssetManifestEntry = Readonly<{
  articleId: number
  sourcePath: string
  publicPath: string
}>

export type TistoryImportReport = Readonly<{
  articles: number
  discoveredIds: readonly number[]
  missingIds: readonly number[]
  images: number
  copiedAssets: number
  unresolvedAssets: number
  warnings: readonly string[]
}>

export type TistoryImportResult = Readonly<{
  inventory: TistoryInventory
  posts: readonly TistoryPost[]
  report: TistoryImportReport
  assetManifest: readonly AssetManifestEntry[]
}>

export type TistoryImportEnv = Readonly<
  {
    TISTORY_BACKUP_ZIP?: string
  } & Record<string, string | undefined>
>

export type ZipPathOptions = Readonly<{
  cliZipPath?: string
  env?: TistoryImportEnv
}>

export type LoadInventoryOptions = Readonly<
  ({ zipPath: string; directoryPath?: never } | { zipPath?: never; directoryPath: string }) & {
    dryRun?: boolean
  }
>

export type ImportTistoryOptions = Readonly<{
  zipPath?: string
  directoryPath?: string
  dryRun?: boolean
  env?: TistoryImportEnv
  contentDir?: string
  publicDir?: string
  outputDir?: string
}>

export class TistoryImportFailure extends Error {
  readonly kind:
    | "DuplicateId"
    | "DuplicateSlug"
    | "InvalidDate"
    | "MalformedHtml"
    | "MalformedPost"
    | "MissingAsset"
    | "MissingBody"
    | "MissingLegacyArtifactPath"
    | "MissingLocalAsset"
    | "MissingMetadata"
    | "MissingTitle"
    | "MissingZip"

  constructor(kind: TistoryImportFailure["kind"], message: string, options: ErrorOptions = {}) {
    super(message, options)
    this.name = "TistoryImportFailure"
    this.kind = kind
  }
}
