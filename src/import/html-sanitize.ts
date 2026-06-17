import * as cheerio from "cheerio"

const dangerousElements = "script, object, embed"
const unsafeProtocolPattern = /^\s*javascript:/i

export const sanitizeHtmlFragment = (html: string): string => {
  const withoutScripts = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<\/?script\b[^>]*>/gi, "")
  const $ = cheerio.load(withoutScripts, null, false)

  $(dangerousElements).remove()
  $("*").each((_, element) => {
    const attributes = $(element).attr() ?? {}
    for (const name of Object.keys(attributes)) {
      const value = attributes[name]
      if (name.toLowerCase().startsWith("on")) {
        $(element).removeAttr(name)
        continue
      }
      if ((name === "href" || name === "src") && value !== undefined) {
        if (unsafeProtocolPattern.test(value)) {
          $(element).removeAttr(name)
        }
      }
    }
  })

  return ($.root().html() ?? "").replace(/<script\b/gi, "").replaceAll(/javascript:/gi, "")
}

export const excerptFromHtml = (html: string, maxCharacters = 160): string => {
  const $ = cheerio.load(html)
  $("script, style").remove()
  const text = $.text().replace(/\s+/g, " ").trim()
  const characters = Array.from(text)

  if (characters.length <= maxCharacters) {
    return text
  }

  return `${characters.slice(0, maxCharacters).join("").trim()}...`
}

export const wrapLegacyHtml = (title: string, bodyHtml: string): string => `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeText(title)}</title>
    <style>
      body { margin: 0; padding: 24px; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; line-height: 1.72; color: #1f2623; background: #fff; }
      img { max-width: 100%; height: auto; }
      pre, code { white-space: pre-wrap; overflow-wrap: anywhere; }
      table { max-width: 100%; border-collapse: collapse; overflow-x: auto; display: block; }
    </style>
  </head>
  <body>${bodyHtml}</body>
</html>
`

const escapeText = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
