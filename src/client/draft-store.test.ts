import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'

import {
  loadDraft,
  saveDraft,
  clearDraft,
  loadIdempotencyKey,
  saveIdempotencyKey,
  clearIdempotencyKey,
  loadDraftState,
  type MainDraft,
} from './draft-store'

const testDraft: MainDraft = {
  evidence_ids: ['ev_radar', 'ev_economy'],
  action_id: 'hold_b',
  qualifier_id: 'aggressive',
  confidence_id: 'high',
}

describe('draft-store', () => {
  describe('saveDraft and loadDraft', () => {
    it('returns null when no draft exists', async () => {
      const result = await loadDraft('load_missing_001')
      expect(result).toBeNull()
    })

    it('persists and retrieves a draft', async () => {
      await saveDraft('persist_002', testDraft)
      const result = await loadDraft('persist_002')
      expect(result).toEqual(testDraft)
    })

    it('overwrites an existing draft', async () => {
      await saveDraft('overwrite_003', testDraft)
      const updated: MainDraft = { ...testDraft, action_id: 'push_a' }
      await saveDraft('overwrite_003', updated)
      const result = await loadDraft('overwrite_003')
      expect(result?.action_id).toBe('push_a')
    })

    it('isolates drafts by attempt id', async () => {
      await saveDraft('isolate_a', testDraft)
      await saveDraft('isolate_b', { ...testDraft, action_id: 'rotate' })
      expect((await loadDraft('isolate_a'))?.action_id).toBe('hold_b')
      expect((await loadDraft('isolate_b'))?.action_id).toBe('rotate')
    })
  })

  describe('clearDraft', () => {
    it('removes an existing draft', async () => {
      await saveDraft('clear_del', testDraft)
      await clearDraft('clear_del')
      expect(await loadDraft('clear_del')).toBeNull()
    })

    it('does not throw when clearing a missing draft', async () => {
      await expect(clearDraft('clear_nonexistent')).resolves.toBeUndefined()
    })
  })

  describe('idempotency keys', () => {
    it('generates a UUID when no key is stored', async () => {
      const key = await loadIdempotencyKey('key_new')
      expect(key).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      )
    })

    it('persists and retrieves a key', async () => {
      const original = crypto.randomUUID()
      await saveIdempotencyKey('key_persist', original)
      const loaded = await loadIdempotencyKey('key_persist')
      expect(loaded).toBe(original)
    })

    it('removes a stored key', async () => {
      const key = crypto.randomUUID()
      await saveIdempotencyKey('key_clear', key)
      await clearIdempotencyKey('key_clear')
      const loaded = await loadIdempotencyKey('key_clear')
      expect(loaded).not.toBe(key)
    })
  })

  describe('loadDraftState', () => {
    it('loads draft and key together', async () => {
      const key = crypto.randomUUID()
      await saveDraft('state_both', testDraft)
      await saveIdempotencyKey('state_both', key)
      const state = await loadDraftState('state_both')
      expect(state.draft).toEqual(testDraft)
      expect(state.idempotencyKey).toBe(key)
    })

    it('returns null draft and fresh key when nothing is stored', async () => {
      const state = await loadDraftState('state_empty')
      expect(state.draft).toBeNull()
      expect(state.idempotencyKey).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      )
    })
  })
})
