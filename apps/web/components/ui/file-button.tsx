import { useCallback } from 'react'
import { FileIcon } from 'lucide-react'
import { Button } from './button'
import { selectFile, type SelectFileOptions } from '@/utils/select-file'

export interface FileButtonProps
  extends React.ComponentProps<typeof Button>, SelectFileOptions {
  onFileSelect(files: FileList): void
}

type ClickHandler = NonNullable<React.ComponentProps<typeof Button>['onClick']>

export function FileButton({
  children,
  multiple,
  accept,
  capture,
  onClick,
  onFileSelect,
  ...props
}: FileButtonProps) {
  const handleClick = useCallback<ClickHandler>(
    (event) => {
      selectFile({
        multiple,
        accept,
        capture,
      }).then(onFileSelect)
      onClick?.(event)
    },
    [accept, capture, multiple, onClick, onFileSelect]
  )

  return (
    <Button {...props} onClick={handleClick}>
      {children}
    </Button>
  )
}

export type FileButtonWithLabelProps = Omit<FileButtonProps, 'children'>

export function FileButtonWithLabel(props: FileButtonWithLabelProps) {
  return (
    <FileButton {...props}>
      <FileIcon />
      파일 선택
    </FileButton>
  )
}
