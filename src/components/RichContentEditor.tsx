import { useRef, useState } from 'react'
import { ImagePlus, Plus, Sigma, Trash2, Type } from 'lucide-react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import type { ContentBlock, RichContent } from '../lib/question'

type Props = { label: string; value: RichContent; onChange: (value: RichContent) => void; onImage: (file: File, progress: (percent: number) => void) => Promise<{ assetId: string; url: string }>; imageUrls?: Record<string, string>; compact?: boolean }
export default function RichContentEditor({ label, value, onChange, onImage, imageUrls = {}, compact = false }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [localUrls, setLocalUrls] = useState<Record<string, string>>({})
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null)
  const [failedAssets, setFailedAssets] = useState<string[]>([])
  const update = (index: number, block: ContentBlock) => onChange({ ...value, blocks: value.blocks.map((item, i) => i === index ? block : item) })
  const add = (type: ContentBlock['type']) => onChange({ ...value, blocks: [...value.blocks, type === 'text' ? { type, text: '' } : type === 'math' ? { type, latex: '', display: true } : { type, assetId: '', alt: '' }] })
  const upload = async (file?: File) => {
    if (!file) return
    setError(''); setUploading(true); setProgress(0)
    try {
      const asset = await onImage(file, setProgress)
      if (asset.url) setLocalUrls((current) => ({ ...current, [asset.assetId]: asset.url }))
      const nextBlock: ContentBlock = { type: 'image', assetId: asset.assetId, alt: file.name, caption: '' }
      onChange({ ...value, blocks: replaceIndex === null ? [...value.blocks, nextBlock] : value.blocks.map((block, index) => index === replaceIndex ? nextBlock : block) })
      setReplaceIndex(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Image upload failed. Try again.') }
    finally { setUploading(false); setReplaceIndex(null); if (input.current) input.current.value = '' }
  }
  return <section className={`content-editor ${compact ? 'compact' : ''}`}>
    <div className="content-editor-head"><b>{label}</b><span>Text, math and images can be combined</span></div>
    <div className="content-block-list">{value.blocks.map((block, index) => <div className="content-block" key={`${block.type}-${index}`}>
      <div className="block-kind">{block.type === 'text' ? <Type size={13}/> : block.type === 'math' ? <Sigma size={14}/> : <ImagePlus size={13}/>}<span>{block.type}</span><button aria-label={`Remove ${block.type} block`} onClick={() => onChange({ ...value, blocks: value.blocks.filter((_, i) => i !== index) })}><Trash2 size={13}/></button></div>
      {block.type === 'text' && <textarea rows={compact ? 2 : 3} placeholder="Write text…" value={block.text} onChange={(e) => update(index, { ...block, text: e.target.value })}/>}
      {block.type === 'math' && <div><input className="math-input" aria-label="LaTeX expression" placeholder="e.g. \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}" value={block.latex} onChange={(e) => update(index, { ...block, latex: e.target.value })}/><div className="math-preview" aria-label="Rendered equation" dangerouslySetInnerHTML={{__html: katex.renderToString(block.latex || String.raw`x^2 + y^2 = z^2`, {throwOnError:false,displayMode:true,trust:false})}}/></div>}
      {block.type === 'image' && <div className="image-block">{failedAssets.includes(block.assetId) ? <div className="alert error" role="alert">Image preview failed to load. Replace the image or retry after reconnecting.</div> : localUrls[block.assetId] || imageUrls[block.assetId] ? <img src={localUrls[block.assetId] || imageUrls[block.assetId]} alt={block.alt || 'Question image'} onError={() => setFailedAssets((old) => old.includes(block.assetId) ? old : [...old, block.assetId])}/> : <div className="image-placeholder">Image stored · preview available after secure access</div>}<label>Alt text<input value={block.alt} onChange={(e) => update(index, { ...block, alt: e.target.value })}/></label><button type="button" className="replace-image" disabled={uploading} onClick={() => { setReplaceIndex(index); input.current?.click() }}><ImagePlus size={13}/> Replace image</button></div>}
    </div>)}</div>
    <div className="content-tools"><button onClick={() => add('text')}><Type size={14}/> Text</button><button onClick={() => add('math')}><Sigma size={15}/> Math</button><button onClick={() => input.current?.click()}><ImagePlus size={14}/> Image</button><button aria-label="Add another content block" onClick={() => add('text')}><Plus size={14}/></button></div>
    {uploading && <div className="upload-progress" role="status">Uploading image <span>{progress}%</span><div><i style={{width:`${progress}%`}}/></div></div>}{error && <div className="alert error" role="alert">{error}</div>}
    <input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { if (e.target.files?.[0]) void upload(e.target.files[0]); else setReplaceIndex(null) }}/>
  </section>
}
