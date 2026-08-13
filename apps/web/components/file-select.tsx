import Image from 'next/image'
import { useCallback } from 'react'
import { ImageIcon } from 'lucide-react'
import { FileSelectZone } from './ui/file-button'

export interface ImageFile {
  file: File
  url: string
}

export interface ImageSelectZoneProps {
  image: ImageFile | undefined
  onImageChange: (file: File | undefined) => void
}

export function ImageSelectZone({
  image,
  onImageChange,
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
