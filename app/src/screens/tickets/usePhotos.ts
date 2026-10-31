import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { resizeToJpeg } from '../../lib/image'
import { requireSupabase } from '../../lib/supabase'

/**
 * Ticket photos. A picked photo is shrunk to 1600px right away, so a file the phone
 * can't read says so before anyone writes anything, and what goes up stays small.
 * Files live under the ticket's id, and the storage policies follow the ticket.
 */

const BUCKET = 'ticket-photos'
const MAX_SIDE = 1600
const MAX_PHOTOS = 6
const URL_TTL = 3600

export type PickedPhoto = { id: string; blob: Blob; url: string }

export function usePickedPhotos() {
  const [photos, setPhotos] = useState<PickedPhoto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)

  // Whatever is still picked when the screen goes away.
  const current = useRef(photos)
  useEffect(() => {
    current.current = photos
  }, [photos])
  useEffect(() => () => current.current.forEach((p) => URL.revokeObjectURL(p.url)), [])

  const add = useCallback(
    async (files: File[]) => {
      setError(null)
      const room = MAX_PHOTOS - photos.length
      if (files.length > room) setError(`A ticket update can hold ${MAX_PHOTOS} photos.`)
      setReading(true)
      try {
        const next = await Promise.all(
          files.slice(0, Math.max(room, 0)).map(async (file) => {
            const blob = await resizeToJpeg(file, MAX_SIDE)
            return { id: crypto.randomUUID(), blob, url: URL.createObjectURL(blob) }
          }),
        )
        setPhotos((prev) => [...prev, ...next])
      } catch {
        setError("That photo couldn't be read. Try a JPG or PNG.")
      } finally {
        setReading(false)
      }
    },
    [photos.length],
  )

  const remove = useCallback((id: string) => {
    setError(null)
    setPhotos((prev) => {
      const gone = prev.find((p) => p.id === id)
      if (gone) URL.revokeObjectURL(gone.url)
      return prev.filter((p) => p.id !== id)
    })
  }, [])

  const clear = useCallback(() => {
    setError(null)
    setPhotos((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.url))
      return []
    })
  }, [])

  return { photos, error, reading, add, remove, clear }
}

/** Puts the photos in the ticket's folder and gives back their paths. */
export async function uploadPhotos(ticketId: string, photos: PickedPhoto[]) {
  const storage = requireSupabase().storage.from(BUCKET)
  return Promise.all(
    photos.map(async (p) => {
      const path = `${ticketId}/${p.id}.jpg`
      const { error } = await storage.upload(path, p.blob, { contentType: 'image/jpeg', upsert: false })
      if (error) throw error
      return path
    }),
  )
}

/**
 * Links to a ticket's photos, read apart from the thread so its 30-second reread
 * doesn't reload every image. A file that is missing simply has no link.
 */
export function useSignedPhotos(paths: string[]) {
  return useQuery({
    queryKey: ['ticket-photo-urls', paths],
    enabled: paths.length > 0,
    staleTime: (URL_TTL - 300) * 1000,
    queryFn: async () => {
      const { data, error } = await requireSupabase().storage.from(BUCKET).createSignedUrls(paths, URL_TTL)
      if (error) throw error
      const urls = new Map<string, string>()
      for (const d of data) if (d.path && d.signedUrl) urls.set(d.path, d.signedUrl)
      return urls
    },
  })
}
