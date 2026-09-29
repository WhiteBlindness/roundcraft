import { z } from 'zod'

import { publicMetadataSchema as workerPublicMetadataSchema } from '../../src/worker/edition-metadata'

/**
 * Editorial wrapper around the four payloads that end up in D1.
 *
 * The payloads themselves (brief, followup, reveal, rubric) are validated
 * with the runtime domain schemas in src/domain; this file only describes the
 * editorial envelope that never reaches production.
 */

export const CASE_STATUSES = [
  'draft',
  'technically_validated',
  'tactically_reviewed',
  'ready',
  'withdrawn',
] as const

export type CaseStatus = (typeof CASE_STATUSES)[number]

/** Rank used for "status >= technically_validated" style comparisons. */
export const STATUS_RANK: Readonly<Record<CaseStatus, number>> = {
  draft: 0,
  technically_validated: 1,
  tactically_reviewed: 2,
  ready: 3,
  withdrawn: 3,
}

/** Label mandated by the PRD for every original (synthetic) case. */
export const SYNTHETIC_ORIGIN_LABEL =
  'Synthetic scenario — editorial tactical analysis.'

export const identifierSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9_]+$/)

/**
 * The Worker compares these strings lexicographically against
 * `new Date().toISOString()`, so the exact millisecond format matters.
 */
export const isoInstantSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    'must be a UTC instant like 2026-10-01T06:00:00.000Z',
  )
  .refine((value) => !Number.isNaN(Date.parse(value)), 'must be a real date')

/**
 * Same schema the Worker reads (src/worker/edition-metadata.ts), made strict so
 * that typos and stray fields are caught before they reach D1.
 */
export const publicMetadataSchema = workerPublicMetadataSchema.strict()

const reviewerSchema = z
  .object({
    name: z.string().trim().min(1),
    reviewedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z)?$/),
    verdict: z.enum(['approved', 'changes_requested']),
    notes: z.string(),
  })
  .strict()

const referenceSchema = z
  .object({
    label: z.string().min(1),
    detail: z.string().min(1),
    kind: z.enum(['background_reading', 'source']),
    url: z.string().optional(),
  })
  .strict()

export const editorialSchema = z
  .object({
    status: z.enum(CASE_STATUSES),
    /** The case_revision id; must equal caseRevision in all four payloads. */
    revision: identifierSchema,
    rubricRevision: identifierSchema,
    author: z.string().trim().min(1),
    reviewers: z.array(reviewerSchema),
    references: z.array(referenceSchema),
    knownIssues: z.array(z.string().min(1)),
    notes: z.string().optional(),
    /** Required (non-empty) for origin "professional". */
    provenance: z.string().optional(),
    /** Required (non-empty) for origin "professional". */
    rights: z.string().optional(),
  })
  .strict()

export const editionSchema = z
  .object({
    editionId: identifierSchema,
    /** null while the case is not scheduled; required once `ready`. */
    releaseAt: isoInstantSchema.nullable(),
    officialEndAt: isoInstantSchema.nullable(),
    graceEndAt: isoInstantSchema.nullable(),
    publicMetadata: publicMetadataSchema,
  })
  .strict()

const payloadSchema = z.record(z.string(), z.unknown())

export const caseFileSchema = z
  .object({
    caseId: identifierSchema,
    origin: z.enum(['synthetic', 'professional']),
    /** Technical fixture: local preview/E2E only, never published. */
    fixture: z.literal(true).optional(),
    editorial: editorialSchema,
    edition: editionSchema,
    brief: payloadSchema,
    followup: payloadSchema,
    reveal: payloadSchema,
    rubric: payloadSchema,
  })
  .strict()

export type CaseFileEnvelope = z.infer<typeof caseFileSchema>
