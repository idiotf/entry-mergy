import type { Project } from '@entry-mergy/entry-utils/types'

export interface Asset {
  name: string
  /**
   * Lazily creates and caches the underlying ReadableStream.
   *
   * The returned stream is cached and is *not* recreated on subsequent accesses.
   * Consumers must treat the stream as single-use.
   */
  get data(): ReadableStream<Uint8Array<ArrayBuffer>>
}

export interface ImportedProject {
  project: Promise<Project>
  assets: AsyncIterable<Asset>
  cancelProject(): void
  cancelAssets(): void
}
