import type { MergeOptions } from '@entry-mergy/core'

interface Asset {
  url: string
  format: string
}

export interface Thumbnail extends Asset {
  width: number
  height: number
}

export interface BGM extends Asset {
  duration: number
}

export interface WaitForBGMOptions {
  useCache?: boolean | undefined
}

export interface KineticMergeOptions {
  timestamps: number[]
  thumbnail: Thumbnail
  bgm: BGM
  coreOptions?: MergeOptions | undefined
  timestampGap?: number | undefined
  waitForBGM?: boolean | WaitForBGMOptions | undefined
  memos?: string[] | undefined
}
