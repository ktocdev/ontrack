/**
 * Shrink a photo before upload: longest side at most `max` px, re-encoded as
 * JPEG. Phones hand over 4000px images; a profile photo is shown at 88px.
 * Re-encoding also drops EXIF (location) data. createImageBitmap applies the
 * EXIF rotation, so portrait photos stay upright.
 */
export async function resizeToJpeg(file: Blob, max: number, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read that image'))), 'image/jpeg', quality),
  )
}
