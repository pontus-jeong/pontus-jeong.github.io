import { existsSync } from "node:fs"
import { mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { parseTistoryPost, validateUniquePostKeys } from "../lib/content-contracts.ts"
import { publicAssetPaths, rewriteArticleAssets, writeAssetManifest } from "./assets.ts"
import { countZipImages, extractArticles } from "./html-extract.ts"
import { sanitizeHtmlFragment, wrapLegacyHtml } from "./html-sanitize.ts"
import {
  type ImportedArticle,
  type ImportTistoryOptions,
  type LoadInventoryOptions,
  type SourceEntries,
  TistoryImportFailure,
  type TistoryImportResult,
  type TistoryInventory,
  type ZipPathOptions,
} from "./import-types.ts"
import { readDirectoryEntries, readZipEntries } from "./source-entries.ts"

const defaultZipPath = "/Users/bada/Downloads/bluebada-1-1-article1-21.zip"
const expectedMinId = 1
const expectedMaxId = 21

export const resolveTistoryZipPath = async (options: ZipPathOptions = {}): Promise<string> => {
  if (options.cliZipPath !== undefined) {
    return existingZipPathOrThrow(options.cliZipPath, "explicit --zip")
  }

  const envZipPath = options.env?.TISTORY_BACKUP_ZIP
  if (envZipPath !== undefined && envZipPath.trim().length > 0) {
    return existingZipPathOrThrow(envZipPath, "TISTORY_BACKUP_ZIP")
  }

  return existingZipPathOrThrow(defaultZipPath, "default ZIP path")
}

export const loadTistoryInventory = async (
  options: LoadInventoryOptions,
): Promise<TistoryInventory> => {
  const entries =
    options.directoryPath === undefined
      ? await readZipEntries(options.zipPath)
      : await readDirectoryEntries(options.directoryPath)

  return inventoryFromEntries(entries)
}

export const importTistoryBackup = async (
  options: ImportTistoryOptions = {},
): Promise<TistoryImportResult> => {
  const source =
    options.directoryPath === undefined
      ? { zipPath: await resolveTistoryZipPath(zipPathOptions(options)) }
      : { directoryPath: options.directoryPath }
  const entries =
    "zipPath" in source
      ? await readZipEntries(source.zipPath)
      : await readDirectoryEntries(source.directoryPath)
  const inventory = inventoryFromEntries(entries)
  const rewritten = inventory.articles.map((article) => rewriteArticleAssets(article, entries))
  const manifest = rewritten.flatMap((item) => item.manifest)
  const assetPaths = new Set([...publicAssetPaths(manifest), "/legacy/14/index.html"])
  const posts = rewritten.map((item) => postFromArticle(item.article, assetPaths))
  const unique = validateUniquePostKeys(posts)

  if (unique.kind === "error") {
    throw new TistoryImportFailure(unique.error.kind, `Post key validation failed`)
  }

  const result = {
    inventory: { ...inventory, articles: rewritten.map((item) => item.article) },
    posts,
    assetManifest: manifest,
    report: {
      articles: posts.length,
      discoveredIds: inventory.discoveredIds,
      missingIds: inventory.missingIds,
      images: inventory.imageCount,
      copiedAssets: manifest.length,
      unresolvedAssets: 0,
      warnings: inventory.warnings,
    },
  } satisfies TistoryImportResult

  if (options.dryRun === true) {
    return result
  }

  await writeImportOutput(result, entries, options)

  return result
}

const inventoryFromEntries = (entries: SourceEntries): TistoryInventory => {
  const articles = extractArticles(entries)
  const discoveredIds = articles.map((article) => article.id)
  const articlesById = Object.fromEntries(articles.map((article) => [article.id, article]))
  const missingIds = range(expectedMinId, expectedMaxId).filter((id) => !discoveredIds.includes(id))

  return {
    articleCount: articles.length,
    imageCount: countZipImages(entries),
    discoveredIds,
    missingIds,
    warnings: [],
    articles,
    articlesById,
  }
}

const postFromArticle = (
  article: ImportedArticle,
  assetPaths: ReadonlySet<string>,
): TistoryImportResult["posts"][number] => {
  const parsed = parseTistoryPost(
    {
      id: article.id,
      title: article.title,
      slug: article.slug,
      description: article.description,
      category: article.category,
      tags: article.tags,
      publishedAt: article.publishedAt,
      sourcePath: article.sourcePath,
      legacyPaths: article.legacyPaths,
      bodyHtml: article.bodyHtml,
      legacy: article.legacy,
      draft: false,
      ...(article.coverImage === undefined ? {} : { coverImage: article.coverImage }),
      ...(article.legacyArtifactPath === undefined
        ? {}
        : { legacyArtifactPath: article.legacyArtifactPath }),
    },
    { localAssetPaths: assetPaths },
  )

  if (parsed.kind === "error") {
    throw new TistoryImportFailure(
      parsed.error.kind,
      `Post validation failed: ${parsed.error.kind}`,
    )
  }

  return parsed.value
}

const writeImportOutput = async (
  result: TistoryImportResult,
  entries: SourceEntries,
  options: ImportTistoryOptions,
): Promise<void> => {
  const root = options.outputDir ?? process.cwd()
  const contentDir = options.contentDir ?? path.join(root, "src", "content", "tistory")
  const publicDir = options.publicDir ?? path.join(root, "public")
  const legacyDir = path.join(publicDir, "legacy", "14")

  await rm(contentDir, { force: true, recursive: true })
  await mkdir(contentDir, { recursive: true })
  await writeAssetManifest(result.assetManifest, entries, publicDir)
  await mkdir(legacyDir, { recursive: true })
  await writeFile(
    path.join(legacyDir, "index.html"),
    legacyHtmlForArticle14(result.inventory),
    "utf8",
  )

  for (const post of result.posts) {
    await writeFile(
      path.join(contentDir, `${post.id.toString()}.json`),
      `${JSON.stringify(post, null, 2)}\n`,
      "utf8",
    )
  }
}

const legacyHtmlForArticle14 = (inventory: TistoryInventory): string => {
  const article = inventory.articlesById[14]
  if (article === undefined) {
    throw new TistoryImportFailure("MissingMetadata", "Article 14 is required for legacy output")
  }

  const bodyHtml = sanitizeHtmlFragment(article.legacyBodyHtml ?? article.description)
  return wrapLegacyHtml(article.title, bodyHtml)
}

const zipPathOptions = (options: ImportTistoryOptions): ZipPathOptions => ({
  ...(options.zipPath === undefined ? {} : { cliZipPath: options.zipPath }),
  ...(options.env === undefined ? {} : { env: options.env }),
})

const existingZipPathOrThrow = (candidatePath: string, source: string): string => {
  if (existsSync(candidatePath)) {
    return candidatePath
  }

  throw new TistoryImportFailure(
    "MissingZip",
    `Missing Tistory backup ZIP from ${source}: ${candidatePath}. Provide --zip {path}, set TISTORY_BACKUP_ZIP, or place the backup at ${defaultZipPath}.`,
  )
}

const range = (min: number, max: number): readonly number[] =>
  Array.from({ length: max - min + 1 }, (_, index) => min + index)
