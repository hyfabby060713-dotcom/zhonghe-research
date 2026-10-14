import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { demoAddLiterature, demoDeleteLiterature, demoDeleteTask, demoFile, demoSaveNote, demoSaveTask, loadDemo } from '../src/lib/demo'
import { validateFile, validateLiterature } from '../src/lib/api'
import type { LiteratureInput } from '../src/types'

const input: LiteratureInput = { title: '测试资料', authors: '测试作者', journal: '研究资料', year: 2026, keywords: ['关系网络'], tags: ['乡村治理'], theory_tags: ['嵌入性治理'], source_url: '' }
beforeEach(() => { vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('window', new EventTarget()); vi.stubGlobal('BroadcastChannel', undefined) })
describe('本地文献与附件的持久化', () => {
  it('重复打开数据库保留题录与附件，删除文献级联清理笔记和文件', async () => {
    const file = new File(['%PDF-1.4\ntest'], '研究资料.pdf', { type: 'application/pdf' })
    const id = await demoAddLiterature(input, file)
    const created = (await loadDemo()).literature.find(x => x.id === id)!
    expect(created.file_name).toBe('研究资料.pdf')
    expect(await (await demoFile(created.file_path!)).text()).toContain('%PDF-1.4')
    await demoSaveNote(id, { application: '理论框架', core_ideas: '关系网络', theory_support: '嵌入性治理' })
    expect((await loadDemo()).notes.find(x => x.literature_id === id)?.application).toBe('理论框架')
    await demoDeleteLiterature(created)
    expect((await loadDemo()).literature.some(x => x.id === id)).toBe(false)
    expect((await loadDemo()).notes.some(x => x.literature_id === id)).toBe(false)
    await expect(demoFile(created.file_path!)).rejects.toThrow('附件不存在')
  })
  it('串行化并发新增，不丢失另一窗口的任务', async () => {
    await Promise.all(['测试任务A', '测试任务B'].map(title => demoSaveTask({ title, description: '', status: 'todo', assignee_id: null, due_date: null })))
    const snapshot = await loadDemo()
    expect(snapshot.tasks.some(x => x.title === '测试任务A')).toBe(true)
    expect(snapshot.tasks.some(x => x.title === '测试任务B')).toBe(true)
  })
})
describe('并发编辑与协作记录', () => {
  it('拒绝过期的任务修改和删除，保留第一次修改', async () => {
    const task = (await loadDemo()).tasks[0]
    await demoSaveTask({ ...task, title: '已经更新的任务', status: 'doing' }, task)
    await expect(demoSaveTask({ ...task, status: 'done' }, task)).rejects.toThrow('其他窗口修改')
    await expect(demoDeleteTask(task)).rejects.toThrow('任务已更新')
    const saved = (await loadDemo()).tasks.find(x => x.id === task.id)!
    expect(saved.status).toBe('doing')
    expect(saved.title).toBe('已经更新的任务')
    expect((await loadDemo()).activities[0].action).toBe('更新了任务')
  })
  it('拒绝其他窗口更新后的笔记覆盖，以及给已删除文献保存笔记', async () => {
    const literature = (await loadDemo()).literature[0]
    const note = { application: '分析部分', core_ideas: '', theory_support: '' }
    await demoSaveNote(literature.id, note)
    const first = (await loadDemo()).notes[0]
    await demoSaveNote(literature.id, { ...note, application: '更新后的分析' }, first.updated_at)
    await expect(demoSaveNote(literature.id, note, first.updated_at)).rejects.toThrow('其他窗口更新')
    expect((await loadDemo()).notes[0].application).toBe('更新后的分析')
    await demoDeleteLiterature(literature)
    await expect(demoSaveNote(literature.id, note)).rejects.toThrow('文献已被删除')
  })
})
describe('上传与题录校验', () => {
  it('拒绝非文献文件、空附件和超限附件', () => {
    expect(() => validateFile(new File(['data'], 'test.exe'))).toThrow('仅支持')
    expect(() => validateFile(new File([], 'empty.pdf'))).toThrow('空文件')
    expect(() => validateFile({ name: 'large.pdf', size: 20 * 1024 * 1024 + 1 } as File)).toThrow('20 MB')
  })
  it('拒绝错误年份和非 HTTP 来源链接', () => {
    expect(() => validateLiterature({ ...input, year: 1799 })).toThrow('年份')
    expect(() => validateLiterature({ ...input, source_url: 'javascript:alert(1)' })).toThrow('来源链接')
    expect(() => validateLiterature(input)).not.toThrow()
  })
})
