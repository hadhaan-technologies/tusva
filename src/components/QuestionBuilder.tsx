import { useMemo, useState } from 'react'
import { Check, Eye, Plus, Save, Trash2 } from 'lucide-react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import RichContentEditor from './RichContentEditor'
import { emptyQuestion, validateQuestion } from '../lib/content'
import type { QuestionDraft, QuestionType, RichContent } from '../lib/question'

type Props = {
  onImage: (file: File, progress: (percent: number) => void) => Promise<{ assetId: string; url: string }>
  onSave: (question: QuestionDraft, answerKey: { correctOptionIds: string[]; numericalAnswer: number | null; numericalTolerance: number }) => Promise<void>
  initialQuestion?: QuestionDraft
  initialAnswerKey?: { correctOptionIds: string[]; numericalAnswer?: number | null; numericalTolerance?: number | null }
  initialImageUrls?: Record<string,string>
  onSaved?: () => void
}
const types: { value: QuestionType; label: string }[] = [
  { value: 'single_select', label: 'Single select' }, { value: 'multiple_select', label: 'Multiple select' },
  { value: 'true_false', label: 'True / false' }, { value: 'numerical', label: 'Numerical answer' }, { value: 'short_answer', label: 'Short answer' },
]
export default function QuestionBuilder({ onImage, onSave, initialQuestion, initialAnswerKey, initialImageUrls={}, onSaved }: Props) {
  const [draft, setDraft] = useState<QuestionDraft>(() => initialQuestion ?? emptyQuestion())
  const [correct, setCorrect] = useState<string[]>(() => initialAnswerKey?.correctOptionIds ?? [])
  const [numericalAnswer, setNumericalAnswer] = useState(initialAnswerKey?.numericalAnswer == null ? '' : String(initialAnswerKey.numericalAnswer))
  const [numericalTolerance, setNumericalTolerance] = useState(initialAnswerKey?.numericalTolerance == null ? '0' : String(initialAnswerKey.numericalTolerance))
  const [imageUrls, setImageUrls] = useState<Record<string,string>>(initialImageUrls)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [failure, setFailure] = useState('')
  const [preview, setPreview] = useState(true)
  const issues = useMemo(() => validateQuestion(draft), [draft])
  const changeType = (type: QuestionType) => { setDraft({ ...emptyQuestion(type), id: draft.id }); setCorrect([]) }
  const changeOption = (id: string, content: RichContent) => setDraft((old) => ({ ...old, options: old.options.map((o) => o.id === id ? { ...o, content } : o) }))
  const toggleCorrect = (id: string) => setCorrect((old) => draft.type === 'multiple_select' ? old.includes(id) ? old.filter((item) => item !== id) : [...old, id] : old.includes(id) ? [] : [id])
  const uploadImage = async (file: File, progress: (percent: number) => void) => {
    const result = await onImage(file, progress)
    setImageUrls((old) => ({ ...old, [result.assetId]: result.url }))
    return result
  }
  const save = async () => {
    setFailure(''); setMessage('')
    if (issues.length) { setFailure(issues[0]); return }
    if (['single_select','multiple_select','true_false'].includes(draft.type) && correct.length === 0) { setFailure('Mark at least one correct answer.'); return }
    if (draft.type === 'numerical' && (numericalAnswer.trim() === '' || !Number.isFinite(Number(numericalAnswer)) || Number(numericalTolerance) < 0)) { setFailure('Enter a valid numerical answer and non-negative tolerance.'); return }
    setSaving(true)
    try { await onSave(draft, { correctOptionIds: correct, numericalAnswer: draft.type === 'numerical' ? Number(numericalAnswer) : null, numericalTolerance: Number(numericalTolerance) }); setMessage('Question saved to your bank.'); if(onSaved) onSaved(); else {setDraft(emptyQuestion()); setCorrect([]); setNumericalAnswer(''); setNumericalTolerance('0'); setImageUrls({})} }
    catch (e) { setFailure(e instanceof Error ? e.message : 'Could not save the question. Try again.') }
    finally { setSaving(false) }
  }
  return <div className="builder-layout">
    <div className="builder-main">
      <div className="builder-heading"><div><div className="eyebrow">QUESTION BANK</div><h2>Create a question</h2><p>Build questions from text, equations and images in any combination.</p></div><button className="preview-toggle" onClick={() => setPreview((v) => !v)}><Eye size={15}/>{preview ? 'Hide preview' : 'Show preview'}</button></div>
      <div className="builder-card">
        <div className="builder-row"><label>Question type<select value={draft.type} onChange={(e) => changeType(e.target.value as QuestionType)}>{types.map((t) => <option value={t.value} key={t.value}>{t.label}</option>)}</select></label><label>Difficulty<select value={draft.difficulty} onChange={(e) => setDraft({ ...draft, difficulty: e.target.value as QuestionDraft['difficulty'] })}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label></div>
        <RichContentEditor label="Question statement" value={draft.statement} onChange={(statement) => setDraft({ ...draft, statement })} onImage={uploadImage} imageUrls={imageUrls}/>
        {draft.options.length > 0 && <section className="option-builder"><div className="section-heading"><div><b>Answer options</b><span>Mark the correct answer{draft.type === 'multiple_select' ? 's' : ''} using the checkbox.</span></div></div>
          {draft.options.map((option, index) => <div className="option-editor-row" key={option.id}><button className={`correct-toggle ${correct.includes(option.id) ? 'selected' : ''}`} aria-label={`Mark option ${index + 1} correct`} onClick={() => toggleCorrect(option.id)}>{correct.includes(option.id) ? <Check size={15}/> : String.fromCharCode(65 + index)}</button><div className="option-content"><RichContentEditor label={`Option ${String.fromCharCode(65 + index)}`} compact value={option.content} onChange={(content) => changeOption(option.id, content)} onImage={uploadImage} imageUrls={imageUrls}/></div><button className="icon-button danger" aria-label={`Remove option ${index + 1}`} onClick={() => { setDraft({ ...draft, options: draft.options.filter((o) => o.id !== option.id) }); setCorrect(correct.filter((id) => id !== option.id)) }}><Trash2 size={15}/></button></div>)}
          <button className="text-button" onClick={() => setDraft({ ...draft, options: [...draft.options, { id: crypto.randomUUID(), position: draft.options.length, content: { version: 1, blocks: [{ type: 'text', text: '' }] } }] })}><Plus size={14}/> Add option</button>
        </section>}
        {draft.type === 'numerical' && <div className="builder-row"><label>Correct numerical answer<input type="number" value={numericalAnswer} onChange={(e) => setNumericalAnswer(e.target.value)} placeholder="Enter the expected value"/></label><label>Accepted tolerance<input type="number" min="0" step="any" value={numericalTolerance} onChange={(e) => setNumericalTolerance(e.target.value)}/></label></div>}
        {draft.type === 'short_answer' && <p className="info-note">Short answers are manually evaluated by faculty after submission.</p>}
        <div className="builder-row marks-row"><label>Marks<input type="number" min="0.25" step="0.25" value={draft.marks} onChange={(e) => setDraft({ ...draft, marks: Number(e.target.value) })}/></label><label>Negative marks<input type="number" min="0" step="0.25" value={draft.negativeMarks} onChange={(e) => setDraft({ ...draft, negativeMarks: Number(e.target.value) })}/></label><label>Subject<input value={draft.subject ?? ''} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} placeholder="e.g. Electrical circuits"/></label></div>
        <label className="topics-label">Topic tags<input value={draft.topics.join(', ')} onChange={(e) => setDraft({ ...draft, topics: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} placeholder="e.g. KCL, Network analysis"/></label>
        <RichContentEditor label="Explanation (optional)" value={draft.explanation ?? { version: 1, blocks: [] }} onChange={(explanation) => setDraft({ ...draft, explanation })} onImage={uploadImage} imageUrls={imageUrls}/>
        {failure && <div className="alert error" role="alert">{failure}</div>}{message && <div className="alert success" role="status">{message}</div>}
        <div className="save-row"><span>{issues.length ? issues[0] : 'Ready to save'}</span><button className="primary-button" onClick={() => void save()} disabled={saving}><Save size={15}/>{saving ? 'Saving…' : 'Save question'}</button></div>
      </div>
    </div>
    {preview && <aside className="question-preview"><div className="preview-title"><Eye size={14}/> STUDENT PREVIEW</div><div className="preview-card"><span className="preview-number">QUESTION 01 <i>{draft.marks} mark{draft.marks === 1 ? '' : 's'}</i></span><RichPreview value={draft.statement} urls={imageUrls}/>{draft.options.map((o,i) => <div className="preview-option" key={o.id}><span>{String.fromCharCode(65+i)}</span><RichPreview value={o.content} urls={imageUrls}/></div>)}</div><div className="preview-foot">Correct answer indicators are hidden from students during an exam.</div></aside>}
  </div>
}

function RichPreview({ value, urls }: { value: RichContent; urls: Record<string,string> }) {
  return <div className="rich-preview">{value.blocks.map((block, index) => block.type === 'text' ? <p key={index}>{block.text || <span className="muted-placeholder">Text content</span>}</p> : block.type === 'math' ? <div className="math-render" key={index} dangerouslySetInnerHTML={{__html:katex.renderToString(block.latex || String.raw`x^2 + y^2 = z^2`,{throwOnError:false,displayMode:block.display??true,trust:false})}}/> : <figure key={index}>{urls[block.assetId] ? <img src={urls[block.assetId]} alt={block.alt}/> : <div className="preview-image-placeholder">Image preview</div>}{block.caption && <figcaption>{block.caption}</figcaption>}</figure>)}</div>
}
