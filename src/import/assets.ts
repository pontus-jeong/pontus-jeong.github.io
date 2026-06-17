import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import * as cheerio from "cheerio"
import {
  type AssetManifestEntry,
  type ImportedArticle,
  type SourceEntries,
  TistoryImportFailure,
} from "./import-types.ts"

const localImagePattern = /^\.?\/?img\/(.+)$/u
const rewrittenAssetPattern = /^\/assets\/posts\/\d+\/img-\d{3}[^/]*\.[a-z0-9]+$/u

export const rewriteArticleAssets = (
  article: ImportedArticle,
  entries: SourceEntries,
): Readonly<{ article: ImportedArticle; manifest: readonly AssetManifestEntry[] }> => {
  const localRefs = uniqueLocalReferences(article.bodyHtml, article.localImageReferences)
  const manifest = localRefs.map((reference, index) =>
    manifestEntryForReference(article.id, article.sourcePath, reference, index + 1, entries),
  )
  const rewrittenBodyHtml = rewriteHtmlReferences(article.bodyHtml, manifest)
  const rewrittenCover = rewriteMaybeReference(article.coverImage, manifest)

  return {
    article: {
      ...article,
      bodyHtml: rewrittenBodyHtml,
      ...(rewrittenCover === undefined ? {} : { coverImage: rewrittenCover }),
      localImageReferences: manifest.map((entry) => entry.publicPath),
    },
    manifest,
  }
}

export const writeAssetManifest = async (
  manifest: readonly AssetManifestEntry[],
  entries: SourceEntries,
  publicDir: string,
): Promise<void> => {
  for (const item of manifest) {
    const bytes = entries.get(item.sourcePath)
    if (bytes === undefined) {
      throw new TistoryImportFailure("MissingAsset", `Missing asset ${item.sourcePath}`)
    }
    const targetPath = path.join(publicDir, item.publicPath)
    await mkdir(path.dirname(targetPath), { recursive: true })
    await writeFile(targetPath, bytes)
  }
}

export const publicAssetPaths = (manifest: readonly AssetManifestEntry[]): ReadonlySet<string> =>
  new Set(manifest.map((entry) => entry.publicPath))

const uniqueLocalReferences = (
  bodyHtml: string,
  extractedReferences: readonly string[],
): readonly string[] => {
  const fromBody = localReferencesFromHtml(bodyHtml)
  const seen = new Set<string>()
  const references: string[] = []

  for (const reference of [...fromBody, ...extractedReferences]) {
    const normalized = normalizeLocalReference(reference)
    if (!seen.has(normalized)) {
      references.push(normalized)
      seen.add(normalized)
    }
  }

  return references
}

const localReferencesFromHtml = (bodyHtml: string): readonly string[] => {
  const $ = cheerio.load(bodyHtml, null, false)
  const references: string[] = []

  $("[src], [href]").each((_, element) => {
    for (const attribute of ["src", "href"] as const) {
      const value = $(element).attr(attribute)
      if (value !== undefined && localImagePattern.test(value)) {
        references.push(value)
      }
    }
  })

  return references
}

const manifestEntryForReference = (
  articleId: number,
  _sourcePath: string,
  reference: string,
  sequence: number,
  entries: SourceEntries,
): AssetManifestEntry => {
  const assetSourcePath = assetPathForReference(articleId, reference)
  if (!entries.has(assetSourcePath)) {
    throw new TistoryImportFailure("MissingAsset", `Missing local asset ${assetSourcePath}`)
  }

  const extension = path.posix.extname(reference).toLowerCase() || ".bin"
  const publicPath = `/assets/posts/${articleId.toString()}/img-${sequence
    .toString()
    .padStart(3, "0")}${extension}`

  if (!rewrittenAssetPattern.test(publicPath)) {
    throw new TistoryImportFailure("MalformedPost", `Invalid public asset path ${publicPath}`)
  }

  return { articleId, sourcePath: assetSourcePath, publicPath }
}

const assetPathForReference = (articleId: number, reference: string): string =>
  `bluebada-1-1/${articleId.toString()}/${normalizeLocalReference(reference)}`

const normalizeLocalReference = (reference: string): string => {
  const cleanReference = reference.split(/[?#]/u, 1)[0] ?? reference
  const match = localImagePattern.exec(cleanReference)
  const localPath = match?.[1]
  if (localPath === undefined) {
    throw new TistoryImportFailure("MissingAsset", `Not an article-local image: ${reference}`)
  }

  return `img/${localPath}`
}

const rewriteHtmlReferences = (
  bodyHtml: string,
  manifest: readonly AssetManifestEntry[],
): string => {
  const $ = cheerio.load(bodyHtml, null, false)

  $("[src], [href]").each((_, element) => {
    for (const attribute of ["src", "href"] as const) {
      const value = $(element).attr(attribute)
      const rewritten = rewriteMaybeReference(value, manifest)
      if (rewritten !== undefined) {
        $(element).attr(attribute, rewritten)
      }
    }
  })

  return $.root().html() ?? ""
}

const rewriteMaybeReference = (
  reference: string | undefined,
  manifest: readonly AssetManifestEntry[],
): string | undefined => {
  if (reference === undefined || !localImagePattern.test(reference)) {
    return reference
  }

  const sourceSuffix = normalizeLocalReference(reference)
  const match = manifest.find((entry) => entry.sourcePath.endsWith(`/${sourceSuffix}`))
  if (match === undefined) {
    throw new TistoryImportFailure("MissingAsset", `Missing rewritten asset for ${reference}`)
  }

  return match.publicPath
}
