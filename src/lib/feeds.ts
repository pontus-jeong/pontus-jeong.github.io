import { absoluteUrl, postHref, type TistoryEntry } from "./blog.ts"

export type SearchRecord = Readonly<{
  title: string
  category: string
  tags: readonly string[]
  date: string
  excerpt: string
  url: string
}>

export const searchRecords = (posts: readonly TistoryEntry[], site: URL): readonly SearchRecord[] =>
  posts.map((post) => ({
    title: post.data.title,
    category: post.data.category,
    tags: post.data.tags,
    date: post.data.publishedAt,
    excerpt: post.data.description,
    url: absoluteUrl(site, postHref(post)),
  }))

export const rssXml = (
  posts: readonly TistoryEntry[],
  site: URL,
): string => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>BlueBada</title>
    <link>${xmlEscape(absoluteUrl(site, "/"))}</link>
    <description>BlueBada technical notes and migrated Tistory archive.</description>
    ${posts
      .map(
        (post) => `<item>
      <title>${xmlEscape(post.data.title)}</title>
      <link>${xmlEscape(absoluteUrl(site, postHref(post)))}</link>
      <guid>${xmlEscape(absoluteUrl(site, postHref(post)))}</guid>
      <pubDate>${new Date(post.data.publishedAt).toUTCString()}</pubDate>
      <description>${xmlEscape(post.data.description)}</description>
    </item>`,
      )
      .join("\n    ")}
  </channel>
</rss>
`

export const sitemapXml = (
  paths: readonly string[],
  site: URL,
): string => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((path) => `  <url><loc>${xmlEscape(absoluteUrl(site, path))}</loc></url>`).join("\n")}
</urlset>
`

const xmlEscape = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
