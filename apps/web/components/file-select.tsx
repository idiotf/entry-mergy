import Image from 'next/image'
import { useCallback } from 'react'
import { ImageIcon, Music4Icon } from 'lucide-react'
import {
  FileSelectZone,
  type FileSelectZoneProps,
} from './ui/file-button'

type BaseSelectZoneProps = Omit<
  FileSelectZoneProps,
  'accept' | 'selected' | 'onFileSelect' | 'children'
>

export interface ImageFile {
  file: File
  url: string
}

export interface ImageSelectZoneProps extends BaseSelectZoneProps {
  image: ImageFile | undefined
  onImageChange: (file: File | undefined) => void
}

export function ImageSelectZone({
  image,
  onImageChange,
  ...props
}: ImageSelectZoneProps) {
  const onFileSelect = useCallback(
    (list: FileList) => {
      const file = list[0]
      if (!file) return
      onImageChange(file)
    },
    [onImageChange]
  )

  return (
    <FileSelectZone
      {...props}
      accept={['image/*']}
      selected={!!image}
      onFileSelect={onFileSelect}
    >
      {image ? (
        <Image
          src={image.url}
          alt=''
          width={960}
          height={540}
          unoptimized
        />
      ) : (
        <>
          <ImageIcon />
          이미지를 드롭하거나 선택
        </>
      )}
    </FileSelectZone>
  )
}

export interface SoundFile {
  file: File
  spectrum?: number[]
}

export interface BGMSelectZoneProps extends BaseSelectZoneProps {
  sound: SoundFile | undefined
  onSoundChange: (file: File | undefined) => void
}

export function BGMSelectZone({
  sound,
  onSoundChange,
  ...props
}: BGMSelectZoneProps) {
  return (
    <FileSelectZone
      {...props}
      accept={['audio/*']}
      selected={!!sound}
      onFileSelect={onSoundChange}
    >
      <Music4Icon />
      BGM을 드롭하거나 선택
    </FileSelectZone>
  )
}
