import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { unzipSync } from "fflate"
import type { SourceEntries } from "./import-types.ts"

export const readZipEntries = async (zipPath: string): Promise<SourceEntries> => {
  const bytes = new Uint8Array(await readFile(zipPath))
  const unzipped = unzipSync(bytes)
  const entries = new Map<string, Uint8Array>()

  for (const [entryPath, entryBytes] of Object.entries(unzipped)) {
    entries.set(normalizeEntryPath(entryPath), entryBytes)
  }

  return entries
}

export const readDirectoryEntries = async (directoryPath: string): Promise<SourceEntries> => {
  const root = path.resolve(directoryPath)
  const entries = new Map<string, Uint8Array>()
  const files = await collectFiles(root)

  for (const filePath of files) {
    const relativePath = path.relative(root, filePath).split(path.sep).join("/")
    entries.set(normalizeEntryPath(relativePath), new Uint8Array(await readFile(filePath)))
  }

  return entries
}

export const normalizeEntryPath = (entryPath: string): string =>
  entryPath.replaceAll("\\", "/").replace(/^\/+/, "")

const collectFiles = async (directoryPath: string): Promise<readonly string[]> => {
  const entries = await readdir(directoryPath, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath)))
      continue
    }
    if (entry.isFile()) {
      files.push(entryPath)
    }
  }

  return files
}
