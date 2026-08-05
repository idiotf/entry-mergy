export interface SelectFileOptions {
  multiple?: boolean | undefined
  accept?: string[] | undefined
  capture?: string | undefined
}

export async function selectFile(options?: SelectFileOptions) {
  const input = document.createElement('input')
  input.type = 'file'

  if (options?.multiple) input.multiple = true
  if (options?.accept) input.accept = options.accept.join(',')
  if (options?.capture) input.capture = options.capture

  return new Promise<FileList>((resolve) => {
    input.addEventListener(
      'change',
      () => {
        if (input.files) resolve(input.files)
      },
      { once: true }
    )

    input.click()
  })
}
