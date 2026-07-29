export async function getAudioDuration(blob: Blob) {
  const src = URL.createObjectURL(blob)
  try {
    return await getAudioDurationViaURL(src)
  } finally {
    URL.revokeObjectURL(src)
  }
}

export function getAudioDurationViaURL(src: string) {
  const audio = new Audio(src)
  return new Promise<number>((resolve, reject) => {
    audio.addEventListener('loadedmetadata', () => resolve(audio.duration))
    audio.addEventListener('error', reject)
  })
}

export async function getImageSize(blob: Blob) {
  const src = URL.createObjectURL(blob)
  try {
    return await getImageSizeViaURL(src)
  } finally {
    URL.revokeObjectURL(src)
  }
}

export function getImageSizeViaURL(src: string) {
  const image = new Image()
  image.src = src
  return new Promise<[number, number]>((resolve, reject) => {
    image.addEventListener('load', () => resolve([image.width, image.height]))
    image.addEventListener('error', reject)
  })
}
