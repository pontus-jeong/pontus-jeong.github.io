import { TistoryImportFailure } from "../src/import/import-types.ts"
import { importTistoryBackup } from "../src/import/importer.ts"

type CliOptions = Readonly<{
  zipPath?: string
  dryRun: boolean
}>

const parseArgs = (args: readonly string[]): CliOptions => {
  let zipPath: string | undefined
  let dryRun = false

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--") {
      continue
    }
    if (arg === "--dry-run") {
      dryRun = true
      continue
    }
    if (arg === "--zip") {
      const value = args[index + 1]
      if (value === undefined) {
        throw new TistoryImportFailure("MissingZip", "Missing value for --zip")
      }
      zipPath = value
      index += 1
      continue
    }
    throw new TistoryImportFailure("MalformedPost", `Unknown argument: ${arg ?? ""}`)
  }

  return { ...(zipPath === undefined ? {} : { zipPath }), dryRun }
}

const main = async (): Promise<void> => {
  const options = parseArgs(process.argv.slice(2))
  const result = await importTistoryBackup({
    ...(options.zipPath === undefined ? {} : { zipPath: options.zipPath }),
    dryRun: options.dryRun,
    env: process.env,
  })

  process.stdout.write(
    [
      `articles: ${result.report.articles.toString()}`,
      `ids: ${result.report.discoveredIds.join(",")}`,
      `missing: ${result.report.missingIds.join(",")}`,
      `images: ${result.report.images.toString()}`,
      `copied assets: ${result.report.copiedAssets.toString()}`,
    ].join("\n"),
  )
  process.stdout.write("\n")
}

try {
  await main()
} catch (error) {
  if (error instanceof Error) {
    process.stderr.write(`${error.name}: ${error.message}\n`)
    process.exitCode = 1
  } else {
    throw error
  }
}
