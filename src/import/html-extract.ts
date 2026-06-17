import * as cheerio from "cheerio"
import { strFromU8 } from "fflate"
import { slugFromPostTitle } from "../lib/content-contracts.ts"
import { excerptFromHtml, sanitizeHtmlFragment } from "./html-sanitize.ts"
import { type ImportedArticle, type SourceEntries, TistoryImportFailure } from "./import-types.ts"

const articlePathPattern = /^bluebada-1-1\/(\d+)\/.+\.html$/u
const localImagePattern = /^\.?\/?img\//u
const remoteUrlPattern = /^https?:\/\//iu

export const extractArticles = (entries: SourceEntries): readonly ImportedArticle[] => {
  const articlePaths = [...entries.keys()]
    .filter((entryPath) => articlePathPattern.test(entryPath))
    .sort((left, right) => articleIdFromPath(left) - articleIdFromPath(right))

  return articlePaths.map((sourcePath) => extractArticle(entries, sourcePath))
}

export const countZipImages = (entries: SourceEntries): number =>
  [...entries.keys()].filter((entryPath) => /\/img\/.+/u.test(entryPath)).length

export const articleIdFromPath = (sourcePath: string): number => {
  const match = articlePathPattern.exec(sourcePath)
  const rawId = match?.[1]
  if (rawId === undefined) {
    throw new TistoryImportFailure("MalformedPost", `Invalid article path: ${sourcePath}`)
  }

  return Number.parseInt(rawId, 10)
}

const extractArticle = (entries: SourceEntries, sourcePath: string): ImportedArticle => {
  const bytes = entries.get(sourcePath)
  if (bytes === undefined) {
    throw new TistoryImportFailure("MalformedPost", `Missing entry: ${sourcePath}`)
  }

  const id = articleIdFromPath(sourcePath)
  const $ = cheerio.load(strFromU8(bytes))
  const title = requiredText($, ".title-article", "MissingTitle", sourcePath)
  const category = requiredText($, ".category", "MissingMetadata", sourcePath)
  const publishedAt = parseTistoryDate(requiredText($, ".date", "InvalidDate", sourcePath))
  const body = $(".contents_style").first()

  if (body.length === 0 || body.html()?.trim() === "") {
    throw new TistoryImportFailure("MissingBody", `Missing .contents_style in ${sourcePath}`)
  }

  const rawBodyHtml = body.html() ?? ""
  const bodyHtml = sanitizeHtmlFragment(rawBodyHtml)
  const refs = imageReferences(rawBodyHtml)
  const legacy = id === 14

  return {
    id,
    title,
    slug: slugFromPostTitle(id, title),
    description: excerptFromHtml(bodyHtml),
    category,
    tags: extractTags($),
    publishedAt,
    sourcePath,
    legacyPaths: [`/${id}/`],
    bodyHtml: legacy ? "" : bodyHtml,
    ...(legacy ? { legacyBodyHtml: bodyHtml } : {}),
    legacy,
    ...(legacy ? { legacyArtifactPath: "/legacy/14/index.html" } : {}),
    ...(legacy || refs.firstImage === undefined ? {} : { coverImage: refs.firstImage }),
    localImageReferences: refs.local,
    remoteImageReferences: refs.remote,
  }
}

const requiredText = (
  $: cheerio.CheerioAPI,
  selector: string,
  kind: TistoryImportFailure["kind"],
  sourcePath: string,
): string => {
  const value = $(selector).first().text().replace(/\s+/g, " ").trim()
  if (value.length === 0) {
    throw new TistoryImportFailure(kind, `Missing ${selector} in ${sourcePath}`)
  }

  return value
}

const parseTistoryDate = (value: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/u.exec(value)
  if (match === null) {
    throw new TistoryImportFailure("InvalidDate", `Invalid Tistory date: ${value}`)
  }

  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}+09:00`
}

const extractTags = ($: cheerio.CheerioAPI): readonly string[] => {
  const tagText = $("div.tags").first().text().replace(/\s+/g, " ").trim()
  if (tagText.length === 0 || !tagText.includes("#")) {
    return []
  }

  return tagText
    .split("#")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
}

const imageReferences = (
  bodyHtml: string,
): Readonly<{ local: readonly string[]; remote: readonly string[]; firstImage?: string }> => {
  const $ = cheerio.load(bodyHtml, null, false)
  const local: string[] = []
  const remote: string[] = []
  const images = $("img").toArray()
  let firstImage: string | undefined

  for (const image of images) {
    const source = $(image).attr("src")
    if (source === undefined || source.trim().length === 0) {
      continue
    }
    if (firstImage === undefined) {
      firstImage = source
    }
    if (localImagePattern.test(source)) {
      local.push(source)
    } else if (remoteUrlPattern.test(source)) {
      remote.push(source)
    }
  }

  return { local, remote, ...(firstImage === undefined ? {} : { firstImage }) }
}
