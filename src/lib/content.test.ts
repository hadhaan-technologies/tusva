import { describe, expect, it } from 'vitest'
import { emptyQuestion, gradeChoiceAnswer, normalizeContent, validateQuestion } from './content'
import { sniffImageMime } from './media'

describe('rich question content', () => {
  it('accepts text, a mathematical expression, and an image reference in order', () => {
    const content = normalizeContent({ version: 1, blocks: [
      { type: 'text', text: 'Find the voltage.' }, { type: 'math', latex: 'V = IR' },
      { type: 'image', assetId: 'stable-asset-id', alt: 'Circuit diagram' },
    ] })
    expect(content.blocks.map((block) => block.type)).toEqual(['text','math','image'])
  })
  it('rejects image blocks without stable stored asset references', () => {
    expect(() => normalizeContent({ version: 1, blocks: [{ type: 'image', assetId: '', alt: '' }] })).toThrow(/stored asset/)
  })
  it('requires useful options and positive marks before saving', () => {
    const draft = emptyQuestion('single_select')
    expect(validateQuestion(draft)).toContain('Add question content before saving')
    draft.statement.blocks = [{ type: 'text', text: 'Which value is correct?' }]
    draft.options = draft.options.map((option, i) => ({ ...option, content: { version: 1, blocks: [{ type: 'text', text: i ? `Choice ${i}` : '' }] } }))
    expect(validateQuestion(draft)).toContain('Every answer option needs text, math, or an image')
  })
})

describe('objective grading and upload type checks', () => {
  it('awards marks only for an exact multiple-select match', () => {
    expect(gradeChoiceAnswer('multiple_select', ['a','b'], ['b','a'], 2, 0.5)).toBe(2)
    expect(gradeChoiceAnswer('multiple_select', ['a','b'], ['a'], 2, 0.5)).toBe(-0.5)
    expect(gradeChoiceAnswer('single_select', ['a'], [], 1, 0.25)).toBe(0)
  })
  it('recognizes image signatures rather than relying on file extensions', () => {
    expect(sniffImageMime(new Uint8Array([0xff,0xd8,0xff,0x00]))).toBe('image/jpeg')
    expect(sniffImageMime(new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))).toBe('image/png')
    expect(sniffImageMime(new TextEncoder().encode('RIFF0000WEBP'))).toBe('image/webp')
    expect(sniffImageMime(new TextEncoder().encode('not an image'))).toBeNull()
  })
})
