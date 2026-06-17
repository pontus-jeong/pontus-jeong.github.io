import { getCollection } from "astro:content"
import type { APIRoute } from "astro"
import { sortedVisiblePosts } from "../lib/blog.ts"
import { rssXml } from "../lib/feeds.ts"

export const GET: APIRoute = async ({ site }) => {
  const siteUrl = site ?? new URL("https://pontus-jeong.github.io")
  const posts = sortedVisiblePosts(await getCollection("tistory"))

  return new Response(rssXml(posts, siteUrl), {
    headers: { "content-type": "application/rss+xml; charset=utf-8" },
  })
}
