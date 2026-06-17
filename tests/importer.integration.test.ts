import { spawnSync } from "node:child_process"
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  importTistoryBackup,
  loadTistoryInventory,
  resolveTistoryZipPath,
} from "../src/import/importer.ts"

const backupZipPath = "/Users/bada/Downloads/bluebada-1-1-article1-21.zip"
const discoveredIds = [1, 2, 3, 4, 5, 6, 8, 14, 15, 17, 18, 19, 20, 21] as const
const missingIds = [7, 9, 10, 11, 12, 13, 16] as const
const exactIdList = discoveredIds.join(",")

type CliRun = Readonly<{
  status: number | null
  stdout: string
  stderr: string
}>

const runImporterCli = (
  args: readonly string[],
  envOverrides: Readonly<Record<string, string | undefined>> = {},
): CliRun => {
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", join(process.cwd(), "scripts", "import-tistory.ts"), ...args],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, ...envOverrides },
    },
  )

  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

describe("Tistory importer", () => {
  it("Given Tistory ZIP When inventory is parsed Then exactly the 14 discovered IDs are returned", async () => {
    const inventory = await loadTistoryInventory({ zipPath: backupZipPath })

    expect(inventory.articleCount).toBe(14)
    expect(inventory.discoveredIds).toEqual(discoveredIds)
    expect(inventory.missingIds).toEqual(missingIds)
    expect(inventory.imageCount).toBe(81)
  })

  it("Given Korean article metadata When inventory is parsed Then titles and categories are preserved", async () => {
    const inventory = await loadTistoryInventory({ zipPath: backupZipPath })

    expect(inventory.articlesById[1]?.title).toBe("애니 추천 사이트 제작 일기(1일차)")
    expect(inventory.articlesById[15]?.title).toBe("Swift - 옵셔널(Optional)")
    expect(inventory.articlesById[17]?.title).toBe(
      "[Flutter로 개인 블로그 만들기] #1. Flutter Web을 Github Pages에 업로드하기",
    )
    expect(inventory.articlesById[17]?.category).toBe("Flutter")
    expect(inventory.articlesById[21]?.title).toBe(
      "임베디드 리눅스를 위한 Flutter, flutter-elinux에 대해서",
    )
  })

  it("Given title and code contain hash signs When tags are extracted Then only div.tags values become tags", async () => {
    const inventory = await loadTistoryInventory({ zipPath: backupZipPath })

    expect(inventory.articlesById[17]?.title).toContain("#1")
    expect(inventory.articlesById[17]?.tags).toEqual([
      "github",
      "GitHub Pages",
      "flutter",
      "github Actions",
    ])
    expect(inventory.articlesById[17]?.tags).not.toContain("1")
    expect(inventory.articlesById[18]?.tags).toEqual([])
  })

  it("Given body and code contain hash signs When tags are extracted Then arbitrary hash text is ignored", async () => {
    const inputDir = await mkdtemp(join(tmpdir(), "tistory-hash-tag-import-"))
    await mkdir(join(inputDir, "bluebada-1-1", "17"), { recursive: true })
    await writeFile(
      join(inputDir, "bluebada-1-1", "17", "17.html"),
      [
        '<html><body><h1 class="title-article">[Flutter로 개인 블로그 만들기] #1</h1>',
        '<span class="category">Flutter</span>',
        '<span class="date">2024-09-18 17:07:53</span>',
        '<div class="contents_style"><pre># code hash</pre><p>Body has #not-a-tag text.</p></div>',
        '<div class="tags">#real tag #two words </div></body></html>',
      ].join(""),
      "utf8",
    )

    const inventory = await loadTistoryInventory({ directoryPath: inputDir })

    expect(inventory.articlesById[17]?.tags).toEqual(["real tag", "two words"])
    expect(inventory.articlesById[17]?.tags).not.toContain("1")
    expect(inventory.articlesById[17]?.tags).not.toContain("code hash")
    expect(inventory.articlesById[17]?.tags).not.toContain("not-a-tag text")

    await rm(inputDir, { force: true, recursive: true })
  })

  it("Given missing TISTORY_BACKUP_ZIP path When import starts Then it fails before output", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "tistory-missing-zip-import-"))

    await expect(
      importTistoryBackup({
        dryRun: true,
        env: { TISTORY_BACKUP_ZIP: "/definitely/missing.zip" },
        outputDir,
      }),
    ).rejects.toThrow(/--zip.*TISTORY_BACKUP_ZIP.*bluebada-1-1-article1-21\.zip/s)

    await expect(rm(outputDir, { force: true, recursive: true })).resolves.toBeUndefined()
  })

  it("Given explicit zip argument When paths are resolved Then --zip wins over env and default", async () => {
    const resolved = await resolveTistoryZipPath({
      cliZipPath: backupZipPath,
      env: { TISTORY_BACKUP_ZIP: "/definitely/missing.zip" },
    })

    expect(resolved).toBe(backupZipPath)
  })

  it("Given TISTORY_BACKUP_ZIP When paths are resolved Then env wins over default", async () => {
    const resolved = await resolveTistoryZipPath({
      env: { TISTORY_BACKUP_ZIP: backupZipPath },
    })

    expect(resolved).toBe(backupZipPath)
  })

  it("Given no explicit path When paths are resolved Then the documented default ZIP is used", async () => {
    const resolved = await resolveTistoryZipPath({
      env: { TISTORY_BACKUP_ZIP: "" },
    })

    expect(resolved).toBe(backupZipPath)
  })

  it("Given explicit zip argument When CLI dry-run runs Then the exact inventory report is printed", () => {
    const result = runImporterCli(["--dry-run", "--zip", backupZipPath])

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain("articles: 14")
    expect(result.stdout).toContain(`ids: ${exactIdList}`)
    expect(result.stdout).toContain("missing: 7,9,10,11,12,13,16")
    expect(result.stdout).toContain("images: 81")
  }, 15_000)

  it("Given TISTORY_BACKUP_ZIP When CLI dry-run runs Then env ZIP is imported", () => {
    const result = runImporterCli(["--dry-run"], { TISTORY_BACKUP_ZIP: backupZipPath })

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain("articles: 14")
    expect(result.stdout).toContain(`ids: ${exactIdList}`)
  }, 15_000)

  it("Given no explicit ZIP When CLI dry-run runs Then the default ZIP is imported", () => {
    const result = runImporterCli(["--dry-run"], { TISTORY_BACKUP_ZIP: "" })

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain("articles: 14")
    expect(result.stdout).toContain(`ids: ${exactIdList}`)
  }, 15_000)

  it("Given missing TISTORY_BACKUP_ZIP When CLI dry-run runs Then all ZIP path options are named", () => {
    const result = runImporterCli(["--dry-run"], { TISTORY_BACKUP_ZIP: "/definitely/missing.zip" })

    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/--zip.*TISTORY_BACKUP_ZIP.*bluebada-1-1-article1-21\.zip/s)
  }, 15_000)

  it("Given HTML without contents_style When imported Then MissingBody is reported before output", async () => {
    const testRoot = await mkdtemp(join(tmpdir(), "tistory-missing-body-import-"))
    const inputDir = join(testRoot, "input")
    const outputDir = join(testRoot, "output")
    await mkdir(join(inputDir, "bluebada-1-1", "1"), { recursive: true })
    await writeFile(
      join(inputDir, "bluebada-1-1", "1", "1.html"),
      '<html><body><h1 class="title-article">Broken</h1><span class="category">Test</span><span class="date">2020-01-01 00:00:00</span></body></html>',
      "utf8",
    )

    await expect(loadTistoryInventory({ directoryPath: inputDir })).rejects.toMatchObject({
      kind: "MissingBody",
    })
    await expect(importTistoryBackup({ directoryPath: inputDir, outputDir })).rejects.toMatchObject(
      {
        kind: "MissingBody",
      },
    )
    await expect(access(join(outputDir, "src", "content", "tistory"))).rejects.toThrow()

    await rm(testRoot, { force: true, recursive: true })
  })
})
