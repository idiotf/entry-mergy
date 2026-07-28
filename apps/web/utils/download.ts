let anchor: HTMLAnchorElement

export function downloadFromURL(url: string, fileName = '') {
  anchor ||= document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
}

export function downloadBlob(blob: Blob, fileName?: string) {
  const objectURL = URL.createObjectURL(blob)
  downloadFromURL(objectURL, fileName)
  setTimeout(URL.revokeObjectURL, 100, objectURL)
}
