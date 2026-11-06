import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requireSupabase } from '../../lib/supabase'
import type { Area } from './equipment'

/**
 * Add and Edit equipment. The row is written first, since a unit's files live under its
 * id (manuals/<id>/, equipment-photos/<id>/), then the manual and data plate photo go
 * up. If a file fails the unit still stands and the screen says so, as a ticket's photos
 * do. RLS and equipment_guard decide what is allowed: edit_equipment at that restaurant,
 * and moving restaurants only while nothing points to the unit. Retire, Restore and
 * Delete go through their logged functions; Delete takes the files away first, while the
 * storage policies can still find the unit they belong to.
 */

export type EquipmentValues = {
  restaurantId: string
  categoryId: string
  name: string
  brand: string
  model: string
  serial: string
  location: string
  /** "2022-03" from a month field, or empty. */
  installed: string
  warrantyThrough: string
}

/** What happens to the manual or the photo on save. */
export type FileChange = { kind: 'keep' } | { kind: 'remove' } | { kind: 'set'; blob: Blob; name: string }

export type Category = { id: string; name: string; area: Area; sort_order: number; active: boolean }

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await requireSupabase()
        .from('categories')
        .select('id, name, area, sort_order, active')
        .order('sort_order')
      if (error) throw error
      return data
    },
  })
}

export function useEquipmentToEdit(id: string) {
  return useQuery({
    queryKey: ['equipment-edit', id],
    queryFn: async () => {
      const sb = requireSupabase()
      const [unit, history] = await Promise.all([
        sb
          .from('equipment')
          .select(
            'id, restaurant_id, category_id, name, brand, model, serial, location_note, installed_on, warranty_until, warranty_note, manual_path, plate_photo_path, retired_at, category:categories (area)',
          )
          .eq('id', id)
          .maybeSingle(),
        sb.from('v_equipment_history').select('in_use').eq('equipment_id', id).maybeSingle(),
      ])
      if (unit.error) throw unit.error
      if (history.error) throw history.error
      if (!unit.data) return null
      const plate = unit.data.plate_photo_path
        ? await sb.storage.from('equipment-photos').createSignedUrl(unit.data.plate_photo_path, 3600)
        : null
      return { ...unit.data, inUse: history.data?.in_use ?? true, plateUrl: plate?.data?.signedUrl ?? null }
    },
  })
}

export type EquipmentToEdit = NonNullable<ReturnType<typeof useEquipmentToEdit>['data']>

const day = (month: string, last: boolean) => {
  const [y, m] = month.split('-').map(Number)
  const d = last ? new Date(y!, m!, 0).getDate() : 1
  return `${month}-${String(d).padStart(2, '0')}`
}
const blank = (v: string) => v.trim() || null
const fileName = (name: string) => name.replace(/[^A-Za-z0-9._-]+/g, '-').slice(-120) || 'manual.pdf'

export function useSaveEquipment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      values: v,
      editing,
      manual,
      plate,
    }: {
      values: EquipmentValues
      editing?: EquipmentToEdit
      manual: FileChange
      plate: FileChange
    }) => {
      const sb = requireSupabase()
      // A month left as it was keeps its day; a changed warranty drops the old free-text note.
      const installed_on = !v.installed
        ? null
        : editing?.installed_on?.startsWith(v.installed)
          ? editing.installed_on
          : day(v.installed, false)
      const warranty_until = !v.warrantyThrough
        ? null
        : editing?.warranty_until?.startsWith(v.warrantyThrough)
          ? editing.warranty_until
          : day(v.warrantyThrough, true)
      const row = {
        restaurant_id: v.restaurantId,
        category_id: v.categoryId,
        name: v.name.trim(),
        brand: blank(v.brand),
        model: blank(v.model),
        serial: blank(v.serial),
        location_note: blank(v.location),
        installed_on,
        warranty_until,
        ...(editing && warranty_until !== editing.warranty_until ? { warranty_note: null } : {}),
      }
      const saved = editing
        ? await sb.from('equipment').update(row).eq('id', editing.id).select('id').single()
        : await sb.from('equipment').insert(row).select('id').single()
      if (saved.error) throw saved.error
      const id = saved.data.id

      let filesFailed = false
      const files: { manual_path?: string | null; plate_photo_path?: string | null } = {}
      const step = async (
        change: FileChange,
        bucket: string,
        old: string | null | undefined,
        path: () => string,
        key: 'manual_path' | 'plate_photo_path',
      ) => {
        if (change.kind === 'keep') return
        try {
          const store = sb.storage.from(bucket)
          if (change.kind === 'set') {
            const to = path()
            const up = await store.upload(to, change.blob, { contentType: change.blob.type, upsert: true })
            if (up.error) throw up.error
            files[key] = to
            if (old && old !== to) await store.remove([old])
          } else {
            files[key] = null
            if (old) await store.remove([old])
          }
        } catch {
          filesFailed = true
        }
      }
      await step(
        manual,
        'manuals',
        editing?.manual_path,
        () => `${id}/${fileName(manual.kind === 'set' ? manual.name : '')}`,
        'manual_path',
      )
      await step(
        plate,
        'equipment-photos',
        editing?.plate_photo_path,
        () => `${id}/${crypto.randomUUID()}.jpg`,
        'plate_photo_path',
      )
      if (Object.keys(files).length) {
        const { error } = await sb.from('equipment').update(files).eq('id', id)
        if (error) filesFailed = true
      }
      return { id, filesFailed }
    },
    onSuccess: (_, { editing }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tickets'] }),
        editing && queryClient.invalidateQueries({ queryKey: ['equipment-edit', editing.id] }),
      ]),
  })
}

export function useSetRetired() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, retired }: { id: string; retired: boolean }) => {
      const { error } = await requireSupabase().rpc('set_equipment_retired', { p_id: id, p_retired: retired })
      if (error) throw error
    },
    onSuccess: (_, { id }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tickets'] }),
        queryClient.invalidateQueries({ queryKey: ['equipment-edit', id] }),
      ]),
  })
}

export function useDeleteEquipment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (unit: EquipmentToEdit) => {
      const sb = requireSupabase()
      // Checked again just before the files go, so a unit that gained a ticket meanwhile keeps them.
      const history = await sb.from('v_equipment_history').select('in_use').eq('equipment_id', unit.id).maybeSingle()
      if (history.error) throw history.error
      if (history.data?.in_use !== false) throw new Error('in use')
      // A file that won't go stops the delete, so nothing is left in a folder with no unit (OT-84).
      for (const [bucket, path] of [
        ['manuals', unit.manual_path],
        ['equipment-photos', unit.plate_photo_path],
      ] as const) {
        if (!path) continue
        const removed = await sb.storage.from(bucket).remove([path])
        if (removed.error) throw removed.error
      }
      const { error } = await sb.rpc('delete_equipment', { p_id: unit.id })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  })
}
