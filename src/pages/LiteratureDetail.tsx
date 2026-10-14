import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, ExternalLink, Trash2, BookOpen, Save, FileText } from 'lucide-react'
import { useResearch, perform } from '../context'
import { deleteLiterature, downloadFile, saveNote } from '../lib/api'
import { Empty, Modal, Tag, formatSize, formatTime } from '../components/ui'
import type { NoteInput } from '../types'
const blank = { application: '', core_ideas: '', theory_support: '' }
export default function LiteratureDetail() {
  const { id } = useParams(), navigate = useNavigate()
  const { data, userId, refresh, notify } = useResearch()
  const item = data.literature.find(x => x.id === id)
  const saved = data.notes.find(x => x.literature_id === id && x.user_id === userId)
  const [note, setNote] = useState<NoteInput>(blank), [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [confirm, setConfirm] = useState(false), [downloading, setDownloading] = useState(false)
  const expected = useRef<string | undefined>(undefined)
  useEffect(() => { setDirty(false); setNote(blank); expected.current = undefined }, [id])
  useEffect(() => { if (!dirty) { setNote(saved ? { application: saved.application, core_ideas: saved.core_ideas, theory_support: saved.theory_support } : blank); expected.current = saved?.updated_at } }, [saved, dirty])
  useEffect(() => { const prevent = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault() }; window.addEventListener('beforeunload', prevent); return () => window.removeEventListener('beforeunload', prevent) }, [dirty])
  if (!item) return <div className="page"><Empty title="这篇文献不存在或已被移除" description="返回资料库查看团队目前的文献。" action={<Link to="/literature" className="button">返回文献库</Link>} /></div>
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true)
    const ok = await perform(() => saveNote(id!, userId, note, expected.current), refresh, notify, '阅读笔记已保存，团队成员可以查看。')
    if (ok) setDirty(false); setBusy(false)
  }
  return <div className="page detail-page"><Link className="back-link" to="/literature"><ArrowLeft size={16} />返回文献资料库</Link><section className="panel detail-header"><span className="eyebrow">LITERATURE DETAIL</span><h1>{item.title}</h1><p>{item.authors} <span>·</span> {item.year}</p><div className="literature-tags">{[...new Set([...item.tags, ...item.theory_tags])].map(tag => <Tag key={tag} tone="blue">{tag}</Tag>)}</div><div className="detail-actions"><button className="button button-primary" disabled={!item.file_path || downloading} onClick={async () => { setDownloading(true); try { await downloadFile(item) } catch (error) { notify((error as Error).message, true) } finally { setDownloading(false) } }}><Download size={17} />{downloading ? '正在下载…' : item.file_path ? '下载文献附件' : '暂无附件'}</button>{item.source_url && <a className="button" href={item.source_url} target="_blank" rel="noreferrer">查看原文来源<ExternalLink size={16} /></a>}<button className="icon-button danger" aria-label="删除文献" onClick={() => setConfirm(true)}><Trash2 size={18} /></button></div></section>
    <div className="detail-grid"><section className="panel"><h2>文献信息</h2><dl className="metadata"><dt>作者</dt><dd>{item.authors}</dd><dt>来源期刊 / 机构</dt><dd>{item.journal}</dd><dt>出版年份</dt><dd>{item.year}</dd><dt>关键词</dt><dd>{item.keywords.length ? item.keywords.join(' · ') : '尚未填写'}</dd><dt>理论标签</dt><dd>{item.theory_tags.join('、') || '尚未标注'}</dd><dt>添加成员</dt><dd>{data.members.find(x => x.user_id === item.created_by)?.display_name ?? '团队成员'}</dd></dl><div className="attachment-box"><FileText size={22} /><div><strong>{item.file_name ?? '此文献仅保存了题录'}</strong><span>{item.file_size ? formatSize(item.file_size) : '通过来源链接查找全文'}</span></div></div></section>
    <section className="panel notes-panel"><div className="section-title"><div><h2>我的阅读笔记</h2><p>将文献中的观点，转化为案例分析的证据。</p></div><BookOpen size={21} /></div><form className="form" onSubmit={submit}>{([['application', '这篇文献可以用于案例分析哪一部分？', '例如：解释基层组织为何参与市场连接……'], ['core_ideas', '核心观点是什么？', '归纳关键论点，并记录页码、段落或原文出处……'], ['theory_support', '可以支持哪个理论？', '说明与嵌入性、社会角色或协同治理的关系……']] as const).map(([key, label, placeholder]) => <label key={key}>{label}<textarea maxLength={12000} rows={4} placeholder={placeholder} value={note[key]} onChange={e => { setDirty(true); setNote({ ...note, [key]: e.target.value }) }} /></label>)}<div className="note-save"><span>{dirty ? '有尚未保存的修改' : saved ? `上次保存于 ${formatTime(saved.updated_at)}` : '笔记保存后会与团队共享'}</span><button disabled={busy || !dirty} className="button button-primary"><Save size={16} />{busy ? '保存中…' : '保存笔记'}</button></div></form></section></div>
    <section className="panel team-notes"><h2>团队阅读笔记 <span className="count-badge">{data.notes.filter(x => x.literature_id === id && x.user_id !== userId).length}</span></h2>{data.notes.filter(x => x.literature_id === id && x.user_id !== userId).map(other => <article className="shared-note" key={other.id}><div><strong>{data.members.find(x => x.user_id === other.user_id)?.display_name ?? '团队成员'}</strong><time>{formatTime(other.updated_at)}</time></div>{[['案例应用', other.application], ['核心观点', other.core_ideas], ['理论支持', other.theory_support]].map(([label, text]) => <p key={label}><span>{label}</span>{text || '尚未填写'}</p>)}</article>)}{!data.notes.some(x => x.literature_id === id && x.user_id !== userId) && <p className="muted">暂无其他成员的笔记。每位成员可以独立记录观点，团队共同查看。</p>}</section>
    {confirm && <Modal title="删除这篇文献？" subtitle="文献附件及团队阅读笔记也会一并删除。此操作无法撤销。" onClose={() => { if (!busy) setConfirm(false) }}><p className="confirm-title">{item.title}</p><div className="form-actions"><button disabled={busy} className="button" onClick={() => setConfirm(false)}>取消</button><button disabled={busy} className="button button-danger" onClick={async () => { setBusy(true); const ok = await perform(() => deleteLiterature(item), refresh, notify, '文献已删除。'); setBusy(false); if (ok) navigate('/literature'); else setConfirm(false) }}>{busy ? '删除中…' : '确认删除'}</button></div></Modal>}
  </div>
}
