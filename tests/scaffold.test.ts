import { execFile } from "node:child_process"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import { describe, expect, it } from "vitest"

const execFileAsync = promisify(execFile)

const requiredScripts = [
  "dev",
  "build",
  "preview",
  "check",
  "test",
  "test:watch",
  "import:tistory",
  "verify:links",
] as const

const requiredStrictFlags = [
  "strict",
  "noUncheckedIndexedAccess",
  "exactOptionalPropertyTypes",
  "verbatimModuleSyntax",
] as const

const compilerOptionsKey = "compilerOptions"
const scriptsKey = "scripts"

type CommandFailure = Error & {
  readonly stderr?: unknown
  readonly stdout?: unknown
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const readJsonRecord = async (path: string): Promise<Readonly<Record<string, unknown>>> => {
  const rawFile = await readFile(path, "utf8")
  const parsed: unknown = JSON.parse(rawFile)

  if (!isRecord(parsed)) {
    throw new TypeError(`${path} must contain a JSON object`)
  }

  return parsed
}

const commandFailureOutput = (error: CommandFailure): string => {
  const stdout = typeof error.stdout === "string" ? error.stdout : ""
  const stderr = typeof error.stderr === "string" ? error.stderr : ""
  return `${stdout}${stderr}`
}

const createTemporaryDist = async (name: string): Promise<string> => {
  return await mkdtemp(path.join(tmpdir(), `${name}-`))
}

const runVerifyLinks = async (distPath: string) => {
  return await execFileAsync(process.execPath, ["scripts/verify-links.mjs", "--dist", distPath])
}

const runVerifyLinksExpectingFailure = async (distPath: string): Promise<string> => {
  try {
    await runVerifyLinks(distPath)
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }

    const output = commandFailureOutput(error)
    if (output.length === 0) {
      throw error
    }

    return output
  }

  throw new Error("verify-links was expected to fail")
}

describe("scaffold config", () => {
  it("Given scaffold config When scripts are inspected Then required scripts exist", async () => {
    const packageJson = await readJsonRecord("package.json")
    const scripts = packageJson[scriptsKey]

    if (!isRecord(scripts)) {
      throw new TypeError("package.json scripts must be a JSON object")
    }

    for (const scriptName of requiredScripts) {
      expect(scripts[scriptName], `missing script ${scriptName}`).toBeTruthy()
    }

    expect(scripts["verify:links"]).toBe("node scripts/verify-links.mjs")
  })

  it("Given strict config When tsconfig is parsed Then strict flags are enabled", async () => {
    const tsconfig = await readJsonRecord("tsconfig.json")
    const compilerOptions = tsconfig[compilerOptionsKey]

    if (!isRecord(compilerOptions)) {
      throw new TypeError("tsconfig.json compilerOptions must be a JSON object")
    }

    for (const flagName of requiredStrictFlags) {
      expect(compilerOptions[flagName], `strict flag ${flagName} must be enabled`).toBe(true)
    }
  })

  it("Given a minimal built site When verify-links runs Then root-relative assets resolve", async () => {
    const distPath = await createTemporaryDist("verify-links-pass")

    try {
      await mkdir(path.join(distPath, "about"), { recursive: true })
      await mkdir(path.join(distPath, "assets"), { recursive: true })
      await writeFile(
        path.join(distPath, "index.html"),
        '<a href="/about/">About</a><img src="/assets/logo.svg" alt="">',
      )
      await writeFile(path.join(distPath, "about", "index.html"), "<h1>About</h1>")
      await writeFile(path.join(distPath, "assets", "logo.svg"), "<svg></svg>")

      const result = await runVerifyLinks(distPath)

      expect(result.stdout).toContain("verify:links passed")
    } finally {
      await rm(distPath, { recursive: true, force: true })
    }
  })

  it("Given missing dist index When verify-links runs Then it fails clearly", async () => {
    const distPath = await createTemporaryDist("verify-links-missing-index")

    try {
      const output = await runVerifyLinksExpectingFailure(distPath)

      expect(output).toContain("Missing required built page")
    } finally {
      await rm(distPath, { recursive: true, force: true })
    }
  })

  it("Given a broken root-relative asset When verify-links runs Then it reports the broken reference", async () => {
    const distPath = await createTemporaryDist("verify-links-broken-reference")

    try {
      await writeFile(
        path.join(distPath, "index.html"),
        '<link rel="stylesheet" href="/assets/missing.css">',
      )

      const output = await runVerifyLinksExpectingFailure(distPath)

      expect(output).toContain("Broken root-relative references")
      expect(output).toContain("/assets/missing.css")
    } finally {
      await rm(distPath, { recursive: true, force: true })
    }
  })
})
