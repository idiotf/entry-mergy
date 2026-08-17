// #region Objects

export const isObject = (v: unknown) => !!(typeof v == 'object' && v)

export function deepCopy<T>(obj: T): T {
  if (!obj || typeof obj != 'object') return obj

  if (obj instanceof Array) {
    return obj.map(deepCopy) as T
  }

  const copy = { ...obj }
  for (const k in obj) {
    copy[k] = deepCopy(obj[k])
  }
  return copy
}

// #endregion
// #region Assertion

export function assert(
  condition: boolean,
  error: unknown = TypeError('Assertion failed')
): asserts condition {
  if (!condition) throw error
}

// #endregion
// #region Unique Hash

const hashTable = new Set<string>()
const hashString = '0123456789abcdefghijklmnopqrstuvwxyz'

export function generateUniqueId(length: number) {
  for (;;) {
    const hash = [...crypto.getRandomValues(new Uint8Array(length))]
      .map((v) => hashString[v % hashString.length])
      .join('')

    if (hashTable.has(hash)) continue
    hashTable.add(hash)
    return hash
  }
}

export const generateHash = (length = 4) => generateUniqueId(length)

// #endregion
