import type { Project } from '@entry-mergy/entry-utils/types'

export interface Asset {
  name: string
  data: ReadableStream<Uint8Array<ArrayBuffer>>
}

export interface ImportedProject {
  project: Promise<Project>
  assets?: AsyncIterable<Asset>
}
