import type { EntryObject } from './types'

export function getScriptOf(obj: EntryObject): unknown {
  if (typeof obj.script == 'string') {
    try {
      return JSON.parse(obj.script)
    } catch {
      /* empty */
    }
  }
  return obj.script
}

export function setScriptOf(obj: EntryObject, to: unknown) {
  obj.script = JSON.stringify(to)
}
