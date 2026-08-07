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

function parseBlock(block: unknown, i?: number) {
  if (!isDictionary(block)) return

  delete block.id
  if (block.assemble === true) delete block.assemble
  if (block.copyable === true) delete block.copyable
  if (block.deletable === 1) delete block.deletable
  if (block.emphasized === false) delete block.emphasized
  if (block.movable === null) delete block.movable
  if (block.readOnly === null) delete block.readOnly
  if (Array.isArray(block.extensions) && block.extensions.length == 0)
    delete block.extensions

  if (i != 0) {
    delete block.x
    delete block.y
  }

  if (Array.isArray(block.params)) {
    if (block.params.length == 0) delete block.params
    else parseThread(block.params)
  }

  if (Array.isArray(block.statements)) {
    if (block.statements.length == 0) delete block.statements
    else parseScript(block.statements)
  }
}

export function minifyProject(project: Project) {
  project.objects.forEach((obj) => {
    const script = getScriptOf(obj)
    parseScript(script)
    obj.script = script
    return obj
  })

  project.functions.forEach((func) => {
    const content = JSON.parse(func.content)
    parseScript(content)
    func.content = JSON.stringify(content)
    return func
  })

  return project
}
