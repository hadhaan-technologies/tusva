export type QuestionType = 'single_select' | 'multiple_select' | 'true_false' | 'numerical' | 'short_answer'
export type ContentBlock =
  | { type: 'text'; text: string; format?: 'plain' | 'markdown' }
  | { type: 'math'; latex: string; display?: boolean }
  | { type: 'image'; assetId: string; alt: string; caption?: string }
export interface RichContent { version: 1; blocks: ContentBlock[] }
export interface QuestionOption { id: string; content: RichContent; position: number }
export interface QuestionDraft {
  id?: string; type: QuestionType; statement: RichContent; options: QuestionOption[]; explanation?: RichContent
  marks: number; negativeMarks: number; difficulty: 'easy' | 'medium' | 'hard'; subject?: string; topics: string[]
}
export const emptyContent = (): RichContent => ({ version: 1, blocks: [{ type: 'text', text: '' }] })
