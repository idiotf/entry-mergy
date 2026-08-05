import { isObject, generateHash, deepCopy } from '@entry-mergy/common-utils'
import {
  Project,
  type IdObject,
  type Variable,
  type Func,
} from '@entry-mergy/entry-utils/types'

export { Project }

const funcPrefix = 'func_'
const primitiveBlocks = ['number', 'angle', 'text']
const preserveVarTypes = ['answer', 'timer']

function parseBlocks(map: Map<string, string>, blocks: unknown[]) {
  blocks.forEach((block, i) => {
    if (typeof block == 'string') {
      const id = map.get(block)
      if (id) blocks[i] = id
    } else if (isObject(block)) {
      if ('type' in block && typeof block.type == 'string') {
        if (primitiveBlocks.includes(block.type)) return

        if (block.type.startsWith(funcPrefix)) {
          const id = map.get(block.type)
          if (id) block.type = id
        }
      }

      if ('params' in block && Array.isArray(block.params))
        parseBlocks(map, block.params)

      if ('statements' in block && Array.isArray(block.statements))
        for (const statement of block.statements) parseBlocks(map, statement)
    }
  })
}

function parseScript(map: Map<string, string>, script: string) {
  const content = JSON.parse(script)
  for (const statement of content) parseBlocks(map, statement)
  return JSON.stringify(content)
}

function changeIdUnique<T extends IdObject>(
  map: Map<string, string>,
  obj: T,
  prefix = ''
) {
  const prevId = obj.id
  const newId = generateHash()

  obj.id = newId
  map.set(prefix + prevId, prefix + newId)
  return obj
}

function copyRef<T extends IdObject>(
  map: Map<string, string>,
  dst: T[],
  src: T[],
  mustShare?: (dstObj: T, srcObj: T) => boolean,
  prefix = ''
) {
  const idMap = new Map(dst.map((v) => [v.id, v]))

  if (mustShare) {
    src = src.filter((srcObj) => {
      const dstObj = idMap.get(srcObj.id)
      return !dstObj || !mustShare(dstObj, srcObj)
    })
  }

  dst.push(
    ...src.map((obj) =>
      idMap.has(obj.id) ? changeIdUnique(map, obj, prefix) : obj
    )
  )
}

function changeSrcId<T extends IdObject>(
  map: Map<string, string>,
  dst: T[],
  src: T[],
  prefix = ''
) {
  const idMap = new Map(dst.map((v) => [v.id, v]))
  for (const obj of src) {
    if (idMap.has(obj.id)) changeIdUnique(map, obj, prefix)
  }
}

const filterVariable = (variable: Variable, preserveVar: string[]) =>
  !preserveVar.includes(variable.name) &&
  !preserveVarTypes.includes(variable.variableType)

function checkMustShareFunc(dst: Func, src: Func) {
  if (dst.content != src.content) return false

  try {
    const dstLocalVariables = 'localVariables' in dst && dst.localVariables
    const srcLocalVariables = 'localVariables' in src && src.localVariables
    if (!Array.isArray(dstLocalVariables) || !Array.isArray(srcLocalVariables))
      return false

    if (
      !srcLocalVariables.every((srcVar) =>
        dstLocalVariables.some((dstVar) => srcVar.id == dstVar.id)
      )
    )
      return false
  } catch {
    return false
  }

  return true
}

export interface MergeOptions {
  preserveVar?: string[] | undefined
  shareFunctions?: boolean | undefined
}

export function mergeProject(
  dst: Project,
  src: Project,
  options: MergeOptions = {}
) {
  const { preserveVar = [], shareFunctions } = options

  const map = new Map<string, string>()
  src = deepCopy(src)

  const filteredVariables = src.variables.filter((v) =>
    filterVariable(v, preserveVar)
  )

  copyRef(map, dst.messages, src.messages)
  copyRef(map, dst.scenes, src.scenes)
  copyRef(map, dst.tables, src.tables)
  copyRef(map, dst.variables, filteredVariables)
  copyRef(
    map,
    dst.objects,
    src.objects.map((obj) => {
      const scene = map.get(obj.scene)
      if (scene) obj.scene = scene
      return obj
    })
  )

  changeSrcId(map, dst.functions, src.functions, funcPrefix)
  for (const func of src.functions)
    func.content = parseScript(map, func.content)

  copyRef(
    map,
    dst.functions,
    src.functions,
    shareFunctions ? checkMustShareFunc : undefined,
    funcPrefix
  )

  for (const obj of src.objects) obj.script = parseScript(map, obj.script)

  for (const variable of filteredVariables) {
    const id = variable.object && map.get(variable.object)
    if (id) variable.object = id
  }

  return dst
}

export function mergeAll(projects: Project[], options: MergeOptions = {}) {
  const base = deepCopy(projects[0]!)

  for (let i = 1; i < projects.length; ++i) {
    mergeProject(base, projects[i]!, options)
  }

  return base
}

export async function mergeAllAsync(
  projects: Promise<Project>[],
  options: MergeOptions = {}
) {
  const base = deepCopy(await projects[0]!)

  for (let i = 1; i < projects.length; ++i) {
    mergeProject(base, await projects[i]!, options)
  }

  return base
}
