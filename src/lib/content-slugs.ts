import { createHash } from "node:crypto"
import {
  type PostSlug,
  postSlugSchema,
  type TaxonomyNamespace,
  type TaxonomySlug,
  taxonomySlugValueSchema,
  tistoryArticleIdSchema,
} from "./content-schemas.ts"

export const slugFromPostTitle = (id: number, title: string): PostSlug => {
  const articleId = tistoryArticleIdSchema.parse(id)
  const fragment = asciiFragment(title) || "post"

  return postSlugSchema.parse(`${articleId}-${fragment}`)
}

export const taxonomySlugForLabel = (namespace: TaxonomyNamespace, label: string): TaxonomySlug => {
  const fragment = asciiFragment(label)
  const digest = createHash("sha1").update(`${namespace}\0${label}`).digest("hex").slice(0, 8)
  const readable = fragment.length > 0 ? fragment : namespace

  return { label, slug: taxonomySlugValueSchema.parse(`${readable}-${digest}`) }
}

const asciiFragment = (value: string): string => {
  const runs = value
    .normalize("NFKD")
    .toLowerCase()
    .match(/[a-z0-9]+/g)

  return runs?.join("-") ?? ""
}
