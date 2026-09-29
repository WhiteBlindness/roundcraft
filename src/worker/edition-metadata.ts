import { z } from 'zod'

/** The only edition metadata that may leave D1. Unknown keys are stripped. */
export const publicMetadataSchema = z.object({
  case_number: z.number().int().positive(),
  edition_date_utc: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  estimated_minutes: z.number().int().min(5).max(8),
  focus: z.string().min(1).max(80),
  origin_label: z.string().min(1).max(160),
})

export type PublicMetadata = z.infer<typeof publicMetadataSchema>

export function parsePublicMetadata(json: string): PublicMetadata | null {
  try {
    const parsed = publicMetadataSchema.safeParse(JSON.parse(json))

    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
