import type { Project } from '@entry-mergy/entry-utils/types'

export interface Timestamp {
  start: number | null
  end: number | null
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function guessProjectTimestamp(project: Project): Timestamp {
  // temp
  return {
    start: null,
    end: null,
  }
}
