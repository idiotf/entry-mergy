import { isObject, generateHash, deepCopy } from '@entry-mergy/common-utils'
import { getScriptOf, setScriptOf } from '@entry-mergy/entry-utils/raw'
import {
  Project,
  type IdObject,
  type Variable,
  type Func,
  type EntryObject,
} from '@entry-mergy/entry-utils/types'

export { Project }

const funcPrefix = 'func_'
const primitiveBlocks = ['number', 'angle', 'text']
const preserveVarTypes = ['answer', 'timer']

function parseBlocks(map: Map<string, string>, blocks: unknown) {
  if (!Array.isArray(blocks)) return

  blocks.forEach((block: unknown, i) => {
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

function parseScript(map: Map<string, string>, content: unknown) {
  if (!Array.isArray(content)) return content
  for (const statement of content) parseBlocks(map, statement)
  return content
}

function changeIdUnique<T extends IdObject>(
  idCollisionMap: Map<string, string>,
  obj: T,
  prefix = ''
) {
  const prevId = obj.id
  const newId = generateHash()

  obj.id = newId
  idCollisionMap.set(prefix + prevId, prefix + newId)
  return obj
}

type MustShareDecider<Dst, Src> = (
  dstObj: Dst,
  srcObj: Src,
  dstMap: Map<string, Dst>,
  srcMap: Map<string, Src>
) => boolean

function copyRef<Dst extends IdObject, Src extends Dst>(
  idCollisionMap: Map<string, string>,
  dst: Dst[],
  src: Src[],
  mustShare?: MustShareDecider<Dst, Src>,
  prefix = ''
) {
  const dstMap = new Map(dst.map((v) => [v.id, v]))
  const srcMap = new Map(src.map((v) => [v.id, v]))

  if (mustShare) {
    src = src.filter((srcObj) => {
      const dstObj = dstMap.get(srcObj.id)
      return !dstObj || !mustShare(dstObj, srcObj, dstMap, srcMap)
    })
  }

  dst.push(
    ...src.map((obj) =>
      dstMap.has(obj.id) ? changeIdUnique(idCollisionMap, obj, prefix) : obj
    )
  )
}

const filterVariable = (variable: Variable, preserveVar: string[]) =>
  !preserveVar.includes(variable.name) &&
  !preserveVarTypes.includes(variable.variableType)

function seemsLikeSharableFunc(dst: Func, src: Func) {
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

function getScriptDeps(script: unknown) {
  if (!Array.isArray(script)) return []
  return script.flatMap(getThreadDeps)
}

function getThreadDeps(thread: unknown) {
  if (!Array.isArray(thread)) return []
  return thread.flatMap(getBlockDeps)
}

function getBlockDeps(block: unknown) {
  const deps: string[] = []
  if (!isObject(block)) return deps

  if (
    'id' in block &&
    typeof block.id == 'string' &&
    block.id.startsWith(funcPrefix)
  )
    deps.push(block.id)

  if ('params' in block && Array.isArray(block.params))
    deps.push(...getThreadDeps(block.params))

  if ('statements' in block && Array.isArray(block.statements))
    deps.push(...getScriptDeps(block.statements))

  return deps
}

function getFuncDeps(func: PreProcessedFunc) {
  return getScriptDeps(func.parsedContent)
}

function checkMustShareFunc(
  memo: WeakMap<Func, boolean>,
  dst: Func,
  src: PreProcessedFunc,
  dstMap: Map<string, Func>,
  srcMap: Map<string, PreProcessedFunc>,
  visited = new WeakSet<Func>()
): boolean {
  const memoized = memo.get(src)
  if (memoized !== undefined) return memoized

  if (visited.has(src)) return true
  visited.add(src)

  const canShare =
    seemsLikeSharableFunc(dst, src) &&
    getFuncDeps(src).every((node) => {
      const dst = dstMap.get(node)
      const src = srcMap.get(node)
      return dst && src
        ? checkMustShareFunc(memo, dst, src, dstMap, srcMap, visited)
        : true
    })
  memo.set(src, canShare)
  return canShare
}

function replaceFuncRef(
  map: Map<string, string>,
  functions: PreProcessedFunc[]
) {
  for (const func of functions) {
    parseScript(map, func.parsedContent)
  }
}

interface PreProcessedProject extends Project {
  objects: PreProcessedEntryObject[]
  functions: PreProcessedFunc[]
}

interface PreProcessedEntryObject extends EntryObject {
  parsedScript?: unknown
}

interface PreProcessedFunc extends Func {
  parsedContent?: unknown
}

export function preProcess(project: Project): PreProcessedProject {
  const projectCopy = deepCopy(project)

  return Object.assign(projectCopy, {
    objects: projectCopy.objects.map((obj) => Object.assign(obj, {
      parsedScript: getScriptOf(obj),
    })),
    functions: projectCopy.functions.map((func) => Object.assign(func, {
      parsedContent: JSON.parse(func.content),
    })),
  })
}

export function replacePreProcessed(project: Project) {
  for (const obj of project.objects) {
    if ('parsedScript' in obj) {
      setScriptOf(obj, obj.parsedScript)
      obj.parsedScript = undefined
    }
  }

  for (const func of project.functions) {
    if ('parsedContent' in func) {
      func.content = JSON.stringify(func.parsedContent)
      func.parsedContent = undefined
    }
  }
}

export interface MergeOptions {
  preserveVar?: string[] | undefined
  shareFunctions?: boolean | undefined
}

export function mergePreProcessedProject(
  dst: PreProcessedProject,
  src: PreProcessedProject,
  options: MergeOptions = {}
) {
  const { preserveVar = [], shareFunctions } = options

  const map = new Map<string, string>()

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

  if (shareFunctions) replaceFuncRef(map, src.functions)
  copyRef(
    map,
    dst.functions,
    src.functions,
    shareFunctions ? checkMustShareFunc.bind(null, new WeakMap()) : undefined,
    funcPrefix
  )
  replaceFuncRef(map, src.functions)

  for (const obj of src.objects) {
    parseScript(map, obj.parsedScript)
  }

  for (const variable of filteredVariables) {
    const id = variable.object && map.get(variable.object)
    if (id) variable.object = id
  }

  return dst
}

export function mergeProject(
  dst: Project,
  src: Project,
  options: MergeOptions = {}
) {
  const preProcessedSrc = preProcess(src)
  mergePreProcessedProject(dst, preProcessedSrc, options)
  replacePreProcessed(preProcessedSrc)
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
