import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import path from "node:path"

class PlanComplianceError extends Error {
  constructor(message) {
    super(message)
    this.name = "PlanComplianceError"
  }
}

const parseArgs = () => {
  const rawArgs = process.argv.slice(2)
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs
  if (args.length !== 2) {
    throw new PlanComplianceError(
      "Usage: node scripts/verify-plan-compliance.mjs <plan.md> <plan-compliance.json>",
    )
  }

  const planPath = args[0]
  const manifestPath = args[1]
  if (planPath === undefined || manifestPath === undefined) {
    throw new PlanComplianceError("Both plan and manifest paths are required")
  }

  return { manifestPath, planPath }
}

const completedTasks = (planText) =>
  Array.from(planText.matchAll(/^- \[x\] (\d+)\. (.+)$/gmu)).map((match) => {
    const idText = match[1]
    const title = match[2]
    if (idText === undefined || title === undefined) {
      throw new PlanComplianceError("Malformed completed task line")
    }

    return { id: Number.parseInt(idText, 10), title }
  })

const requireArtifact = (rootDir, taskId, label, artifactPath) => {
  if (typeof artifactPath !== "string" || artifactPath.trim().length === 0) {
    throw new PlanComplianceError(`Task ${taskId.toString()} missing ${label} artifact path`)
  }

  if (!existsSync(path.resolve(rootDir, artifactPath))) {
    throw new PlanComplianceError(
      `Task ${taskId.toString()} ${label} artifact not found: ${artifactPath}`,
    )
  }
}

const verifyTask = (rootDir, task) => {
  requireArtifact(rootDir, task.id, "RED", task.red?.path)
  requireArtifact(rootDir, task.id, "GREEN", task.green?.path)

  if (!Array.isArray(task.qa) || task.qa.length === 0) {
    throw new PlanComplianceError(`Task ${task.id.toString()} missing manual QA evidence`)
  }

  for (const qaItem of task.qa) {
    requireArtifact(rootDir, task.id, "manual QA", qaItem?.path)
  }

  requireArtifact(rootDir, task.id, "cleanup", task.cleanup?.path)
}

const main = async () => {
  const { manifestPath, planPath } = parseArgs()
  const rootDir = process.cwd()
  const planText = await readFile(planPath, "utf8")
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
  if (!Array.isArray(manifest.tasks)) {
    throw new PlanComplianceError("Manifest must contain a tasks array")
  }

  const byId = new Map(manifest.tasks.map((task) => [task.id, task]))
  const checkedTasks = completedTasks(planText)

  for (const checkedTask of checkedTasks) {
    const manifestTask = byId.get(checkedTask.id)
    if (manifestTask === undefined) {
      throw new PlanComplianceError(
        `Completed task ${checkedTask.id.toString()} missing from manifest`,
      )
    }
    verifyTask(rootDir, manifestTask)
  }

  process.stdout.write(
    `plan compliance passed: ${checkedTasks.length.toString()} completed task(s) verified\n`,
  )
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
