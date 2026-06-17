import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const runVerifier = (planPath: string, manifestPath: string) =>
  spawnSync("node", ["scripts/verify-plan-compliance.mjs", planPath, manifestPath], {
    encoding: "utf8",
  })

describe("plan compliance verifier", () => {
  it("Given missing task evidence When verifier runs Then it fails loudly", () => {
    const dir = mkdtempSync(join(tmpdir(), "plan-compliance-"))
    const planPath = join(dir, "plan.md")
    const manifestPath = join(dir, "manifest.json")
    writeFileSync(planPath, "- [x] 1. Example task\n", "utf8")
    writeFileSync(
      manifestPath,
      JSON.stringify({ plan: planPath, tasks: [{ id: 1, title: "Example task" }] }),
      "utf8",
    )

    const result = runVerifier(planPath, manifestPath)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("missing RED")
  })

  it("Given current completed task evidence When verifier runs Then it passes", () => {
    const output = execFileSync(
      "node",
      [
        "scripts/verify-plan-compliance.mjs",
        "plans/2026-06-14-tistory-github-pages-blog.md",
        "evidence/plan-compliance.json",
      ],
      { encoding: "utf8" },
    )

    expect(output).toContain("plan compliance passed")
  })
})
