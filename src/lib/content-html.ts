import * as cheerio from "cheerio"

const voidHtmlTags = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
])

const htmlTagPattern = /<\/?([a-zA-Z][a-zA-Z0-9:-]*)(?:\s[^<>]*)?>/g
const urlSchemePattern = /^[a-z][a-z0-9+.-]*:/i
const assetExtensionPattern = /\.[a-z0-9]+(?:[?#].*)?$/i

export const bodyHtmlLocalAssets = (bodyHtml: string): readonly string[] => {
  const $ = cheerio.load(bodyHtml, {}, false)
  const paths: string[] = []

  $("[src], [href]").each((_, element) => {
    for (const attribute of ["src", "href"] as const) {
      const path = $(element).attr(attribute)
      if (path !== undefined && isLocalAssetPath(path)) {
        paths.push(path)
      }
    }
  })

  return paths
}

export const isLocalAssetPath = (path: string): boolean =>
  !path.startsWith("#") &&
  !path.startsWith("//") &&
  !urlSchemePattern.test(path) &&
  assetExtensionPattern.test(path)

export const htmlIsBalanced = (bodyHtml: string): boolean => {
  const stack: string[] = []
  const residue = bodyHtml.replace(htmlTagPattern, "")

  if (residue.includes("<") || residue.includes(">")) {
    return false
  }

  for (const match of bodyHtml.matchAll(htmlTagPattern)) {
    const rawTag = match[0]
    const name = match[1]?.toLowerCase()
    if (name === undefined || voidHtmlTags.has(name) || rawTag.endsWith("/>")) {
      continue
    }
    if (rawTag.startsWith("</")) {
      const openTag = stack.pop()
      if (openTag !== name) {
        return false
      }
    } else {
      stack.push(name)
    }
  }

  return stack.length === 0
}
