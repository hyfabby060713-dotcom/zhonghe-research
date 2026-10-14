import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Search, FileText, UploadCloud, ArrowUpRight, SlidersHorizontal, X, Rows3, LayoutGrid } from 'lucide-react'
import { useResearch, perform } from '../context'
import { addLiterature, validateFile } from '../lib/api'
import { TAGS, THEORIES, type LiteratureInput } from '../types'
import { Empty, Modal, PageHeading, Tag } from '../components/ui'

export function LiteratureForm({ onClose }: { onClose: () => void }) {
  const { userId, refresh, notify } = useResearch()
  const [file, setFile] = useState<File>()
  const [busy, setBusy] = useState(false)
  const [tags, setTags] = useState<string[]>([]), [theories, setTheories] = useState<string[]>([])
  const [form, setForm] = useState({ title: '', authors: '', journal: '', year: String(new Date().getFullYear()), keywords: '', source_url: '' })
  const field = (key: keyof typeof form) => ({ value: form[key], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value }) })
  const toggle = (value: string, values: string[], setter: (values: string[]) => void) => setter(values.includes(value) ? values.filter(x => x !== value) : [...values, value])
  const selectFile = (value?: File) => { if (!value) return; try { validateFile(value); setFile(value); if (!form.title) setForm(f => ({ ...f, title: value.name.replace(/\.[^.]+$/, '') })) } catch (error) { notify((error as Error).message, true) } }
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true)
    const input: LiteratureInput = { ...form, title: form.title.trim(), authors: form.authors.trim(), journal: form.journal.trim(), source_url: form.source_url.trim(), year: Number(form.year), keywords: form.keywords.split(/[,，;；]/).map(x => x.trim()).filter(Boolean), tags, theory_tags: theories }
    const ok = await perform(() => addLiterature(input, userId, file), refresh, notify, '文献已添加到资料库。')
    setBusy(false); if (ok) onClose()
  }
  return <Modal title="添加研究文献" subtitle="保存题录与附件，让每份资料都能被团队找到。" onClose={() => { if (!busy) onClose() }}><form onSubmit={submit} className="form">
    <div className="upload-zone" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy) selectFile(e.dataTransfer.files[0]) }}><UploadCloud size={28} /><strong>{file ? file.name : '点击选择，或将文献拖放到这里'}</strong><span>PDF、Word · 单个文件不超过 20 MB · 可稍后添加题录</span><label className="button button-sm">{file ? '重新选择文件' : '选择文件'}<input disabled={busy} type="file" accept=".pdf,.doc,.docx" onChange={e => selectFile(e.target.files?.[0])} className="sr-only" /></label>{file && <button type="button" className="text-link" onClick={() => setFile(undefined)}>移除附件</button>}</div>
    <label>文献标题 <em>*</em><input required maxLength={300} placeholder="请输入完整文献标题" {...field('title')} /></label>
    <div className="form-grid"><label>作者 <em>*</em><input required maxLength={200} placeholder="多位作者用分号分隔" {...field('authors')} /></label><label>出版年份 <em>*</em><input required type="number" min="1800" max={new Date().getFullYear() + 1} {...field('year')} /></label></div>
    <label>来源期刊 / 机构 <em>*</em><input required maxLength={300} placeholder="期刊、学位授予单位或发布机构" {...field('journal')} /></label>
    <label>关键词<input maxLength={500} placeholder="使用中文或英文逗号分隔" {...field('keywords')} /></label>
    <fieldset><legend>资料分类</legend><div className="tag-picker">{TAGS.map(tag => <button type="button" key={tag} aria-pressed={tags.includes(tag)} className={tags.includes(tag) ? 'selected' : ''} onClick={() => toggle(tag, tags, setTags)}>{tag}</button>)}</div></fieldset>
    <fieldset><legend>理论标签</legend><div className="tag-picker">{THEORIES.map(tag => <button type="button" key={tag} aria-pressed={theories.includes(tag)} className={theories.includes(tag) ? 'selected' : ''} onClick={() => toggle(tag, theories, setTheories)}>{tag}</button>)}</div></fieldset>
    <label>来源链接<input type="url" maxLength={1000} placeholder="https://doi.org/…（选填）" {...field('source_url')} /></label>
    <div className="form-actions"><button type="button" disabled={busy} className="button" onClick={onClose}>取消</button><button className="button button-primary" disabled={busy}>{busy ? '正在保存…' : '保存文献'}</button></div>
  </form></Modal>
}
export default function LiteraturePage() {
  const { data } = useResearch()
  const [params, setParams] = useSearchParams()
  const [add, setAdd] = useState(params.get('add') === '1')
  const [search, setSearch] = useState(''), [tag, setTag] = useState('全部文献'), [theory, setTheory] = useState('全部理论'), [sort, setSort] = useState('recent'), [view, setView] = useState('rows')
  useEffect(() => { if (params.get('add') === '1') setAdd(true) }, [params])
  const close = () => { setAdd(false); if (params.has('add')) { const next = new URLSearchParams(params); next.delete('add'); setParams(next, { replace: true }) } }
  const filtered = data.literature.filter(x => (tag === '全部文献' || x.tags.includes(tag)) && (theory === '全部理论' || x.theory_tags.includes(theory)) && [x.title, x.authors, x.journal, ...x.keywords].join(' ').toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => sort === 'year' ? b.year - a.year : b.created_at.localeCompare(a.created_at))
  return <div className="page"><PageHeading eyebrow="RESEARCH LIBRARY" title="让每一篇文献，成为研究的支点。" description="集中管理研究资料，记录关键观点，把阅读积累转化为案例分析。" action={<button className="button button-primary" onClick={() => setAdd(true)}><Plus size={17} />添加文献</button>} />
    <div className="library-summary"><div><span className="library-symbol"><LibraryIcon /></span><div><strong>团队共享文献库</strong><p>从理论原点到案例证据，建立共同的知识基础。</p></div></div><div className="library-count"><strong>{data.literature.length}</strong><span>篇文献</span><i /><strong>{data.notes.length}</strong><span>条阅读笔记</span></div></div>
    <section className="panel library-panel"><div className="library-toolbar"><label className="search-box"><Search size={18} /><input aria-label="搜索文献" placeholder="搜索标题、作者或关键词…" value={search} onChange={e => setSearch(e.target.value)} />{search && <button aria-label="清空搜索" onClick={() => setSearch('')}><X size={15} /></button>}</label><div className="filter-controls"><SlidersHorizontal size={17} /><select aria-label="理论筛选" value={theory} onChange={e => setTheory(e.target.value)}><option>全部理论</option>{THEORIES.map(x => <option key={x}>{x}</option>)}</select><select aria-label="文献排序" value={sort} onChange={e => setSort(e.target.value)}><option value="recent">最近添加</option><option value="year">年份从新到旧</option></select></div></div>
    <div className="category-tabs" aria-label="资料分类">{['全部文献', ...TAGS].map(x => <button key={x} aria-pressed={tag === x} className={tag === x ? 'selected' : ''} onClick={() => setTag(x)}>{x}{x === '全部文献' && <span>{data.literature.length}</span>}</button>)}</div>
    <div className="results-head"><span>共找到 <strong>{filtered.length}</strong> 篇文献</span><div><button className={view === 'rows' ? 'selected' : ''} aria-label="列表视图" aria-pressed={view === 'rows'} onClick={() => setView('rows')}><Rows3 size={17} /></button><button className={view === 'grid' ? 'selected' : ''} aria-label="卡片视图" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><LayoutGrid size={17} /></button></div></div>
    {filtered.length ? <div className={`literature-list ${view === 'grid' ? 'literature-grid' : ''}`}>{filtered.map(item => <Link key={item.id} className="literature-card" to={`/literature/${item.id}`}><span className={`file-icon ${item.file_name?.endsWith('.pdf') ? 'pdf' : ''}`}><FileText size={23} /><small>{item.file_name?.split('.').pop()?.toUpperCase() ?? 'REF'}</small></span><div className="literature-card-body"><div className="literature-title"><h3>{item.title}</h3><ArrowUpRight size={17} /></div><p>{item.authors}<span>·</span>{item.year}</p><p className="journal">{item.journal}</p><div className="literature-tags">{[...new Set([...item.tags, ...item.theory_tags])].map(t => <Tag key={t} tone={item.theory_tags.includes(t) ? 'blue' : ''}>{t}</Tag>)}{!item.file_path && <span className="attachment-note">仅题录 · 暂无附件</span>}</div></div><div className="note-count"><BookIcon /><span>{data.notes.filter(x => x.literature_id === item.id).length} 条笔记</span></div></Link>)}</div> : <Empty title={data.literature.length ? '没有找到匹配的文献' : '为研究添加第一篇文献'} description={data.literature.length ? '试试调整关键词、资料分类或理论筛选。' : '上传 PDF、Word，或先保存一条文献题录。'} action={<button className="button" onClick={() => { if (data.literature.length) { setSearch(''); setTag('全部文献'); setTheory('全部理论') } else setAdd(true) }}>{data.literature.length ? '清除筛选' : '添加文献'}</button>} />}
    </section><p className="page-note">经典文献示例只提供题录和来源链接。请上传团队有权使用的全文，并在阅读笔记中标明论点出处。</p>{add && <LiteratureForm onClose={close} />}
  </div>
}
function LibraryIcon() { return <FileText size={23} /> }
function BookIcon() { return <Rows3 size={15} /> }
