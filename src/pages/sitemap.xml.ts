import { getCollection } from "astro:content"
import type { APIRoute } from "astro"
import { categorySummaries, postHref, sortedVisiblePosts, tagSummaries } from "../lib/blog.ts"
import { sitemapXml } from "../lib/feeds.ts"

export const GET: APIRoute = async ({ site }) => {
  const siteUrl = site ?? new URL("https://pontus-jeong.github.io")
  const posts = sortedVisiblePosts(await getCollection("tistory"))
  const paths = [
    "/",
    "/archive/",
    "/categories/",
    "/tags/",
    ...categorySummaries(posts).map((category) => category.href),
    ...tagSummaries(posts).map((tag) => tag.href),
    ...posts.map((post) => postHref(post)),
  ]

  return new Response(sitemapXml(paths, siteUrl), {
    headers: { "content-type": "application/xml; charset=utf-8" },
  })
}
