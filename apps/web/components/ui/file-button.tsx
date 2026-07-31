import { useCallback } from 'react'
import { FileIcon } from 'lucide-react'
import { Button } from './button'
import { selectFile, type SelectFileOptions } from '@/utils/select-file'
import { cn } from '@/lib/utils'

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

export interface FileSelectZoneProps extends FileButtonProps {
  selected?: boolean
}

export function FileSelectZone({
  selected,
  children,
  className,
  ...props
}: FileSelectZoneProps) {
  return (
    <FileButton
      variant='ghost'
      {...props}
      className={cn(
        'flex h-36.5 w-64.5! flex-col items-center justify-center rounded-sm border transition-colors [&>img]:size-full [&>svg]:size-12!',
        selected ? 'overflow-hidden p-0' : 'border-dashed',
        className
      )}
    >
      {children}
    </FileButton>
  )
}
