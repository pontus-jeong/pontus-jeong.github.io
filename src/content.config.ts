import { defineCollection } from "astro:content"
import { glob } from "astro/loaders"
import { z } from "astro/zod"

const nonEmptyString = z.string().trim().min(1)

export const tistoryPostSchema = z
  .object({
    id: z.number().int().positive(),
    title: nonEmptyString,
    slug: nonEmptyString.regex(/^\d+-[a-z0-9]+(?:-[a-z0-9]+)*$/),
    description: nonEmptyString,
    category: nonEmptyString,
    tags: z.array(nonEmptyString),
    publishedAt: z.iso.datetime({ offset: true }),
    sourcePath: nonEmptyString,
    legacyPaths: z.array(nonEmptyString),
    coverImage: nonEmptyString.optional(),
    bodyHtml: z.string(),
    legacy: z.boolean().default(false),
    draft: z.boolean().default(false),
    legacyArtifactPath: nonEmptyString.optional(),
  })
  .superRefine((post, context) => {
    if (!post.legacy && post.bodyHtml.trim().length === 0) {
      context.addIssue({
        code: "custom",
        message: "bodyHtml is required for normal imported posts",
        path: ["bodyHtml"],
      })
    }

    if (!post.legacy && post.legacyArtifactPath !== undefined) {
      context.addIssue({
        code: "custom",
        message: "legacyArtifactPath is only allowed when legacy is true",
        path: ["legacyArtifactPath"],
      })
    }

    if (post.legacy && post.legacyArtifactPath === undefined) {
      context.addIssue({
        code: "custom",
        message: "legacyArtifactPath is required when legacy is true",
        path: ["legacyArtifactPath"],
      })
    }
  })

const tistory = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/tistory" }),
  schema: tistoryPostSchema,
})

export const collections = { tistory }
