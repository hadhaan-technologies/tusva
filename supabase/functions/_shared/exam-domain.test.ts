import { describe, expect, it } from 'vitest'
import { canSeeResult, computeDeadline, gradeObjective, isTerminal, sniffImageMime, validateAnswer } from './exam-domain'

describe('server exam domain', () => {
  it('validates autosave payloads against question type and option membership', () => {
    expect(validateAnswer('single_select', { optionIds: ['a', 'a'] }, ['a', 'b'])).toEqual({ optionIds: ['a'] })
    expect(validateAnswer('single_select', { optionIds: ['a', 'b'] }, ['a', 'b'])).toBeNull()
    expect(validateAnswer('multiple_select', { optionIds: ['a', 'z'] }, ['a', 'b'])).toBeNull()
    expect(validateAnswer('numerical', { value: '' }, [])).toBeNull()
    expect(validateAnswer('short_answer', { text: 'answer' }, [])).toEqual({ text: 'answer' })
  })

  it('grades choices and numerical tolerance on the server', () => {
    expect(gradeObjective('multiple_select', 4, 1, { optionIds: ['a', 'b'] }, { correctOptionIds: ['b', 'a'] }, true)).toEqual({ correct: true, score: 4 })
    expect(gradeObjective('single_select', 4, 1, { optionIds: ['b'] }, { correctOptionIds: ['a'] }, true).score).toBe(-1)
    expect(gradeObjective('numerical', 2, 1, { value: 9.98 }, { numericalAnswer: 10, numericalTolerance: 0.03 }, false).score).toBe(2)
    expect(gradeObjective('single_select', 4, 1, { optionIds: ['b'] }, { correctOptionIds: ['a'] }, false).score).toBe(0)
  })

  it('uses the earlier server deadline and gates result release', () => {
    const start = new Date('2026-01-01T00:00:00Z')
    expect(computeDeadline(start, 3600, new Date('2026-01-01T00:30:00Z')).toISOString()).toBe('2026-01-01T00:30:00.000Z')
    const now = new Date('2026-01-02T00:00:00Z')
    expect(canSeeResult('hidden', null, 'graded', now)).toBe(false)
    expect(canSeeResult('after_submission', null, 'submitted', now)).toBe(true)
    expect(canSeeResult('after_release', '2026-01-03T00:00:00Z', 'graded', now)).toBe(false)
    expect(canSeeResult('after_release', '2026-01-01T00:00:00Z', 'graded', now)).toBe(true)
  })

  it('keeps repeated submissions terminal and idempotent', () => {
    expect(isTerminal('in_progress')).toBe(false)
    expect(isTerminal('submitted')).toBe(true)
    expect(isTerminal('graded')).toBe(true)
    expect(isTerminal('terminated')).toBe(true)
  })

  it('accepts only supported JPEG, PNG, and WebP signatures', () => {
    expect(sniffImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0]))).toBe('image/jpeg')
    expect(sniffImageMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png')
    expect(sniffImageMime(new TextEncoder().encode('RIFF0000WEBP'))).toBe('image/webp')
    expect(sniffImageMime(new TextEncoder().encode('text/html'))).toBeNull()
  })
})
