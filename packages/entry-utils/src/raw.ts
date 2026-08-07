import type { EntryObject } from './types'

export function getScriptOf(obj: EntryObject): unknown {
  if (typeof obj.script == 'string') return JSON.parse(obj.script)
  return obj.script
}

export function setScriptOf(obj: EntryObject, to: unknown) {
  obj.script = JSON.stringify(to)
}
