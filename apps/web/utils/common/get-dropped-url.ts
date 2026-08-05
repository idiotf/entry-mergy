export interface DroppedURLData {
  url: string
  name?: string
}

export function getDroppedUrl(dt: DataTransfer): DroppedURLData | null {
  const uriList = dt.getData('text/uri-list')
  if (uriList) {
    return { url: uriList }
  }

  const xMozUrl = dt.getData('text/x-moz-url')
  if (xMozUrl) {
    const [url, name] = xMozUrl.split('\n')
    if (url) return name ? { url, name } : { url }
  }

  const plain = dt.getData('text/plain')
  if (plain) {
    return { url: plain }
  }

  return null
}
