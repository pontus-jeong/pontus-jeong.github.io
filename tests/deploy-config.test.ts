import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { describe, expect, it } from "vitest"
import { parse } from "yaml"

const workflowPath = ".github/workflows/deploy.yml"

const readText = async (path: string): Promise<string> => readFile(path, "utf8")

type AstroDeployConfig = {
  readonly site: string
  readonly hasBase: boolean
}

type WorkflowStep = {
  readonly uses?: string
}

type WorkflowJob = {
  readonly steps: readonly WorkflowStep[]
}

type DeployWorkflow = {
  readonly triggers: {
    readonly pushBranches: readonly string[]
    readonly hasWorkflowDispatch: boolean
  }
  readonly permissions: {
    readonly contents: string
    readonly pages: string
    readonly idToken: string
  }
  readonly jobs: {
    readonly build: WorkflowJob
    readonly deploy: WorkflowJob
  }
}

class DeployConfigParseError extends Error {
  readonly field: string

  constructor(field: string) {
    super(`Invalid deploy config field: ${field}`)
    this.field = field
  }
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((item: unknown) => typeof item === "string")

const readUnknownField = (value: Readonly<Record<string, unknown>>, field: string): unknown =>
  value[field]

const readStringField = (
  value: Readonly<Record<string, unknown>>,
  field: string,
  errorField: string,
): string => {
  const fieldValue = readUnknownField(value, field)
  if (typeof fieldValue !== "string") {
    throw new DeployConfigParseError(errorField)
  }

  return fieldValue
}

const readAstroDeployConfig = async (): Promise<AstroDeployConfig> => {
  const configUrl = pathToFileURL(resolve("astro.config.mjs")).href
  const loadedModule: unknown = await import(configUrl)

  if (!isRecord(loadedModule)) {
    throw new DeployConfigParseError("astro.config.default")
  }

  const config = readUnknownField(loadedModule, "default")
  if (!isRecord(config)) {
    throw new DeployConfigParseError("astro.config.default")
  }

  const site = readUnknownField(config, "site")
  if (typeof site !== "string") {
    throw new DeployConfigParseError("astro.config.site")
  }

  return {
    site,
    hasBase: Object.hasOwn(config, "base"),
  }
}

const toWorkflowStep = (value: unknown): WorkflowStep | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const uses = readUnknownField(value, "uses")
  if (uses !== undefined && typeof uses !== "string") {
    return undefined
  }

  return uses === undefined ? {} : { uses }
}

const readWorkflowJob = (jobs: Readonly<Record<string, unknown>>, jobName: string): WorkflowJob => {
  const job = jobs[jobName]
  if (!isRecord(job)) {
    throw new DeployConfigParseError(`jobs.${jobName}.steps`)
  }

  const stepsValue = readUnknownField(job, "steps")
  if (!Array.isArray(stepsValue)) {
    throw new DeployConfigParseError(`jobs.${jobName}.steps`)
  }

  const steps = stepsValue.map(toWorkflowStep)
  if (!steps.every((step: WorkflowStep | undefined): step is WorkflowStep => step !== undefined)) {
    throw new DeployConfigParseError(`jobs.${jobName}.steps.uses`)
  }

  return { steps }
}

const parseDeployWorkflow = (source: string): DeployWorkflow => {
  const parsed: unknown = parse(source)
  if (!isRecord(parsed)) {
    throw new DeployConfigParseError("workflow")
  }

  const triggers = readUnknownField(parsed, "on")
  if (!isRecord(triggers)) {
    throw new DeployConfigParseError("on")
  }

  const push = readUnknownField(triggers, "push")
  if (!isRecord(push)) {
    throw new DeployConfigParseError("on.push.branches")
  }

  const pushBranches = readUnknownField(push, "branches")
  if (!isStringArray(pushBranches)) {
    throw new DeployConfigParseError("on.push.branches")
  }

  const permissions = readUnknownField(parsed, "permissions")
  if (!isRecord(permissions)) {
    throw new DeployConfigParseError("permissions")
  }

  const jobs = readUnknownField(parsed, "jobs")
  if (!isRecord(jobs)) {
    throw new DeployConfigParseError("jobs")
  }

  return {
    triggers: {
      pushBranches,
      hasWorkflowDispatch: Object.hasOwn(triggers, "workflow_dispatch"),
    },
    permissions: {
      contents: readStringField(permissions, "contents", "permissions.contents"),
      pages: readStringField(permissions, "pages", "permissions.pages"),
      idToken: readStringField(permissions, "id-token", "permissions.id-token"),
    },
    jobs: {
      build: readWorkflowJob(jobs, "build"),
      deploy: readWorkflowJob(jobs, "deploy"),
    },
  }
}

const readDeployWorkflow = async (): Promise<DeployWorkflow> =>
  parseDeployWorkflow(await readText(workflowPath))

const collectDeployWorkflowProblems = (workflow: DeployWorkflow): readonly string[] => {
  const problems: string[] = []
  const buildActions = workflow.jobs.build.steps.map((step) => step.uses)
  const deployActions = workflow.jobs.deploy.steps.map((step) => step.uses)

  if (!workflow.triggers.pushBranches.includes("main")) {
    problems.push("on.push.branches")
  }
  if (!workflow.triggers.hasWorkflowDispatch) {
    problems.push("on.workflow_dispatch")
  }
  if (workflow.permissions.contents !== "read") {
    problems.push("permissions.contents")
  }
  if (workflow.permissions.pages !== "write") {
    problems.push("permissions.pages")
  }
  if (workflow.permissions.idToken !== "write") {
    problems.push("permissions.id-token")
  }
  if (!buildActions.includes("withastro/action@v6")) {
    problems.push("jobs.build.withastro/action")
  }
  if (!deployActions.includes("actions/deploy-pages@v5")) {
    problems.push("jobs.deploy.actions/deploy-pages")
  }

  return problems
}

const deployWorkflowFixtureWithoutPagesWrite = `
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  id-token: write
jobs:
  build:
    steps:
      - uses: withastro/action@v6
  deploy:
    steps:
      - uses: actions/deploy-pages@v5
`

describe("deploy config", () => {
  it("Given user Pages repo When Astro config is loaded Then site has no base", async () => {
    const config = await readAstroDeployConfig()

    expect(config.site).toBe("https://pontus-jeong.github.io")
    expect(config.hasBase).toBe(false)
  })

  it("Given deploy workflow When parsed Then Pages actions and permissions are correct", async () => {
    const workflow = await readDeployWorkflow()
    const problems = collectDeployWorkflowProblems(workflow)

    expect(problems).toEqual([])
  })

  it("Given workflow fixture without pages:write When parsed Then deployment config validation fails", () => {
    expect(() => parseDeployWorkflow(deployWorkflowFixtureWithoutPagesWrite)).toThrow(
      "permissions.pages",
    )
  })
})
