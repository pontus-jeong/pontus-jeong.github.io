import type { CollectionEntry } from "astro:content"
import { taxonomySlugForLabel } from "./content-slugs.ts"

export type TistoryEntry = CollectionEntry<"tistory">

export type CategorySummary = Readonly<{
  count: number
  href: string
  label: string
  slug: string
}>

export type AdjacentPosts = Readonly<{
  newer?: TistoryEntry
  older?: TistoryEntry
}>

export const sortedVisiblePosts = (posts: readonly TistoryEntry[]): readonly TistoryEntry[] =>
  posts
    .filter((post) => !post.data.draft)
    .toSorted((left, right) => right.data.publishedAt.localeCompare(left.data.publishedAt))

export const postHref = (post: TistoryEntry): string => `/posts/${post.data.slug}/`

export const categoryHref = (label: string): string =>
  `/categories/${taxonomySlugForLabel("category", label).slug}/`

export const tagHref = (label: string): string =>
  `/tags/${taxonomySlugForLabel("tag", label).slug}/`

export const formattedDate = (isoDate: string): string => {
  const parts = isoDate.slice(0, 10).split("-")
  const year = parts[0] ?? "0000"
  const month = parts[1] ?? "00"
  const day = parts[2] ?? "00"

  return `${year}. ${month}. ${day}`
}

export const categorySummaries = (posts: readonly TistoryEntry[]): readonly CategorySummary[] => {
  const counts = new Map<string, number>()
  for (const post of posts) {
    counts.set(post.data.category, (counts.get(post.data.category) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({
      count,
      href: categoryHref(label),
      label,
      slug: taxonomySlugForLabel("category", label).slug,
    }))
    .toSorted((left, right) => right.count - left.count || left.label.localeCompare(right.label))
}

export const tagSummaries = (posts: readonly TistoryEntry[]): readonly CategorySummary[] => {
  const counts = new Map<string, number>()
  for (const post of posts) {
    for (const tag of post.data.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({
      count,
      href: tagHref(label),
      label,
      slug: taxonomySlugForLabel("tag", label).slug,
    }))
    .toSorted((left, right) => right.count - left.count || left.label.localeCompare(right.label))
}

export const postsForCategory = (
  posts: readonly TistoryEntry[],
  category: string,
): readonly TistoryEntry[] => posts.filter((post) => post.data.category === category)

export const postsForTag = (posts: readonly TistoryEntry[], tag: string): readonly TistoryEntry[] =>
  posts.filter((post) => post.data.tags.includes(tag))

export const absoluteUrl = (site: URL, path: string): string => new URL(path, site).toString()

export const adjacentPosts = (
  posts: readonly TistoryEntry[],
  currentSlug: string,
): AdjacentPosts => {
  const index = posts.findIndex((post) => post.data.slug === currentSlug)
  if (index < 0) {
    return {}
  }

  const newer = posts[index - 1]
  const older = posts[index + 1]

  return {
    ...(newer === undefined ? {} : { newer }),
    ...(older === undefined ? {} : { older }),
  }
}
