/** Turn whatever the user picked, pasted or dropped into a plain JPEG before upload.
 *
 * iPhone photos can be HEIC or multi-picture JPEGs, and phone photos are often 5 MB or more.
 * Re-encoding in the browser fixes both. If the browser cannot decode the file, the original is
 * sent and the server decides.
 */
const MAX_SIDE = 2048

export function isImageFile(f: File) {
  return f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name)
}

export async function normalizeImage(file: File): Promise<File> {
  let bmp: ImageBitmap
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale)
  c.height = Math.round(bmp.height * scale)
  const g = c.getContext('2d')
  if (!g) return file
  g.fillStyle = '#fff' // transparent PNGs (stickers, screenshots) would turn black as JPEG
  g.fillRect(0, 0, c.width, c.height)
  g.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close()
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.9))
  return blob ? new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }) : file
}

/** The first image in a paste or drop, if any. */
export function imageFromTransfer(dt: DataTransfer | null): File | null {
  if (!dt) return null
  for (const f of Array.from(dt.files)) if (isImageFile(f)) return f
  for (const it of Array.from(dt.items)) {
    if (it.kind === 'file' && it.type.startsWith('image/')) return it.getAsFile()
  }
  return null
}

/** Read an image with the async Clipboard API (the Paste button). Returns null if there is none. */
export async function imageFromClipboard(): Promise<File | null> {
  for (const item of await navigator.clipboard.read()) {
    const type = item.types.find((t) => t.startsWith('image/'))
    if (type) return new File([await item.getType(type)], `pasted.${type.split('/')[1]}`, { type })
  }
  return null
}
