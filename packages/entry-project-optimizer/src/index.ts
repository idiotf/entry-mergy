import { getScriptOf } from '@entry-mergy/entry-utils/raw'
import type { Project } from '@entry-mergy/entry-utils/types'

function isDictionary(obj: unknown): obj is Record<string, unknown> {
  return typeof obj == 'object' && obj !== null
}

function parseScript(script: unknown) {
  if (!Array.isArray(script)) return
  script.forEach(parseThread)
}

function parseThread(thread: unknown) {
  if (!Array.isArray(thread)) return
  thread.forEach(parseBlock)
}

function parseBlock(block: unknown) {
  if (!isDictionary(block)) return

  block.id = undefined
  block._backupParams = undefined
  if (block.assemble === true) block.assemble = undefined
  if (block.copyable === true) block.copyable = undefined
  if (block.deletable === 1) block.deletable = undefined
  if (block.emphasized === false) block.emphasized = undefined
  if (block.movable === null) block.movable = undefined
  if (block.readOnly === null) block.readOnly = undefined
  if (Array.isArray(block.extensions) && block.extensions.length == 0)
    block.extensions = undefined

  block.x ||= undefined
  block.y ||= undefined

  if (Array.isArray(block.params)) {
    if (block.params.length == 0) block.params = undefined
    else parseThread(block.params)
  }

  if (Array.isArray(block.statements)) {
    if (block.statements.length == 0) block.statements = undefined
    else parseScript(block.statements)
  }
}

export interface MinifyProjectOptions {
  convertScriptToObject?: boolean
}

export function minifyProject(
  project: Project,
  options: MinifyProjectOptions = {}
) {
  project.objects.forEach((obj) => {
    const script = getScriptOf(obj)
    parseScript(script)
    obj.script = options.convertScriptToObject ? script : JSON.stringify(script)
  })

  project.functions.forEach((func) => {
    try {
      const content = JSON.parse(func.content)
      parseScript(content)
      func.content = JSON.stringify(content)
    } catch {
      /* empty */
    }
  })

  return project
}
