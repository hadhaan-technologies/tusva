import type { ContentBlock, QuestionDraft, QuestionType, RichContent } from './question'

export function makeContentBlock(type: ContentBlock['type']): ContentBlock {
  if (type === 'text') return { type, text: '' }
  if (type === 'math') return { type, latex: '', display: true }
  return { type, assetId: '', alt: '' }
}

export function normalizeContent(value: unknown): RichContent {
  if (!value || typeof value !== 'object') return { version: 1, blocks: [{ type: 'text', text: '' }] }
  const candidate = value as Partial<RichContent>
  if (candidate.version !== 1 || !Array.isArray(candidate.blocks)) throw new Error('Unsupported rich-content version')
  for (const block of candidate.blocks) {
    if (!block || !['text', 'math', 'image'].includes(block.type)) throw new Error('Invalid content block')
    if (block.type === 'image' && !block.assetId) throw new Error('Every image needs a stored asset reference')
    if (block.type === 'math' && !block.latex.trim()) throw new Error('Math expression cannot be empty')
  }
  return candidate as RichContent
}

export function emptyQuestion(type: QuestionType = 'single_select'): QuestionDraft {
  const id = () => crypto.randomUUID()
  const options = ['single_select', 'multiple_select', 'true_false'].includes(type)
    ? (type === 'true_false' ? ['True', 'False'] : ['', '', '', '']).map((text, position) => ({ id: id(), position, content: { version: 1 as const, blocks: [{ type: 'text' as const, text }] } }))
    : []
  return { type, statement: { version: 1, blocks: [{ type: 'text', text: '' }] }, options, marks: 1, negativeMarks: 0, difficulty: 'medium', topics: [] }
}

export function validateQuestion(draft: QuestionDraft): string[] {
  const issues: string[] = []
  try { normalizeContent(draft.statement) } catch (error) { issues.push(error instanceof Error ? error.message : 'Invalid question content') }
  if (!draft.statement.blocks.some((block) => block.type === 'text' ? block.text.trim() : true)) issues.push('Add question content before saving')
  if (!Number.isFinite(draft.marks) || draft.marks <= 0) issues.push('Marks must be greater than zero')
  if (draft.negativeMarks < 0) issues.push('Negative marks cannot be below zero')
  if (['single_select','multiple_select','true_false'].includes(draft.type) && draft.options.length < 2) issues.push('Add at least two answer options')
  if (draft.options.some((option) => !option.content.blocks.some((block) => block.type === 'text' ? block.text.trim() : block.type === 'math' ? block.latex.trim() : block.assetId))) issues.push('Every answer option needs text, math, or an image')
  return issues
}

export function gradeChoiceAnswer(_type: 'single_select'|'multiple_select', correctIds: string[], answerIds: string[], marks: number, negativeMarks: number): number {
  const correct = new Set(correctIds)
  const answer = new Set(answerIds)
  const exact = correct.size === answer.size && [...correct].every((id) => answer.has(id))
  if (exact) return marks
  return answer.size > 0 ? -negativeMarks : 0
}
