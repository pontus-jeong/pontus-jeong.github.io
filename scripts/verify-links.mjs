import { existsSync } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

class LinkVerificationError extends Error {
  constructor(message) {
    super(message)
    this.name = "LinkVerificationError"
  }
}

const parseDistArg = () => {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    return "dist"
  }

  if (args.length === 2 && args[0] === "--dist" && args[1]) {
    return args[1]
  }

  throw new LinkVerificationError("Usage: node scripts/verify-links.mjs [--dist dist]")
}

const collectHtmlFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await collectHtmlFiles(entryPath)))
      continue
    }

    if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(entryPath)
    }
  }

  return files
}

const extractReferences = (html) => {
  const references = []
  const attributePattern = /\b(?:href|src)\s*=\s*(["'])(.*?)\1/gis
  const srcsetPattern = /\bsrcset\s*=\s*(["'])(.*?)\1/gis

  for (const match of html.matchAll(attributePattern)) {
    const reference = match[2]
    if (reference) {
      references.push(reference)
    }
  }

  for (const match of html.matchAll(srcsetPattern)) {
    const srcset = match[2]
    if (!srcset) {
      continue
    }

    for (const candidate of srcset.split(",")) {
      const reference = candidate.trim().split(/\s+/, 1)[0]
      if (reference) {
        references.push(reference)
      }
    }
  }

  return references
}

const isExternalOrNonStaticReference = (reference) =>
  reference.startsWith("#") || reference.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(reference)

const stripQueryAndHash = (reference) => reference.split(/[?#]/, 1)[0] ?? ""

const candidatePathsForReference = (distRoot, reference) => {
  const cleanReference = stripQueryAndHash(reference)

  if (!cleanReference.startsWith("/") || cleanReference === "") {
    return []
  }

  let relativePath
  try {
    relativePath = decodeURIComponent(cleanReference.slice(1))
  } catch (error) {
    if (error instanceof URIError) {
      throw new LinkVerificationError(`Invalid encoded URL path: ${reference}`)
    }
    throw error
  }

  const resolvedPath = path.resolve(distRoot, relativePath)
  const rootPrefix = `${distRoot}${path.sep}`
  if (resolvedPath !== distRoot && !resolvedPath.startsWith(rootPrefix)) {
    throw new LinkVerificationError(`Root-relative reference escapes dist: ${reference}`)
  }

  if (cleanReference.endsWith("/")) {
    return [path.join(resolvedPath, "index.html")]
  }

  if (path.extname(relativePath)) {
    return [resolvedPath]
  }

  return [path.join(resolvedPath, "index.html"), `${resolvedPath}.html`]
}

const verifyLinks = async (distDirectory) => {
  const distRoot = path.resolve(distDirectory)
  const indexPath = path.join(distRoot, "index.html")

  if (!existsSync(indexPath)) {
    throw new LinkVerificationError(`Missing required built page: ${indexPath}`)
  }

  const htmlFiles = await collectHtmlFiles(distRoot)
  const brokenReferences = []

  for (const htmlFile of htmlFiles) {
    const html = await readFile(htmlFile, "utf8")
    for (const reference of extractReferences(html)) {
      if (isExternalOrNonStaticReference(reference)) {
        continue
      }

      const candidates = candidatePathsForReference(distRoot, reference)
      if (candidates.length === 0) {
        continue
      }

      if (!candidates.some((candidate) => existsSync(candidate))) {
        brokenReferences.push(`${path.relative(distRoot, htmlFile)} -> ${reference}`)
      }
    }
  }

  if (brokenReferences.length > 0) {
    throw new LinkVerificationError(
      `Broken root-relative references:\n${brokenReferences.join("\n")}`,
    )
  }

  process.stdout.write(
    `verify:links passed: checked ${htmlFiles.length.toString()} HTML file(s) in ${distRoot}\n`,
  )
}

try {
  await verifyLinks(parseDistArg())
} catch (error) {
  if (error instanceof Error) {
    process.stderr.write(`${error.name}: ${error.message}\n`)
    process.exitCode = 1
  } else {
    throw error
  }
}
