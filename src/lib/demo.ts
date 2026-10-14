import { seed, DEMO_TEAM, DEMO_USER } from './seed'
import type { Snapshot, LiteratureInput, TaskInput, NoteInput, Literature, Task } from '../types'

const DB_NAME = 'zhonghe-research-v1'
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => { request.result.createObjectStore('state'); request.result.createObjectStore('files') }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('无法打开本地数据库，请检查浏览器是否允许本地存储。'))
  })
}
async function request<T>(store: string, mode: IDBTransactionMode, action: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode)
    const req = action(tx.objectStore(store))
    tx.oncomplete = () => { db.close(); resolve(req.result as T) }
    tx.onerror = () => { db.close(); reject(new Error('本地保存失败，可能存储空间不足。')) }
    tx.onabort = () => { db.close(); reject(new Error('保存被中断，请重试。')) }
  })
}
export async function loadDemo(): Promise<Snapshot> {
  const found = await request<Snapshot | undefined>('state', 'readonly', s => s.get('workspace'))
  if (found) return found
  // Initialization uses the same read/write transaction as edits, avoiding first-tab races.
  return mutateDemo(() => {})
}
export async function mutateDemo(change: (state: Snapshot) => void): Promise<Snapshot> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readwrite')
    const store = tx.objectStore('state')
    const req = store.get('workspace')
    let state: Snapshot
    req.onsuccess = () => {
      state = req.result ?? seed()
      try { change(state); store.put(state, 'workspace') } catch (error) { reject(error); tx.abort() }
    }
    tx.oncomplete = () => {
      db.close(); resolve(state)
      window.dispatchEvent(new Event('research-update'))
      if (typeof BroadcastChannel === 'function') {
        try { const channel = new BroadcastChannel(DB_NAME); channel.postMessage('update'); channel.close() }
        catch { /* A restricted browser may disallow cross-tab messaging; the saved data remains valid. */ }
      }
    }
    tx.onerror = () => { db.close(); reject(new Error('保存失败，请检查浏览器存储空间。')) }
    tx.onabort = () => { db.close(); reject(new Error('保存被中断。')) }
  })
}
function log(state: Snapshot, action: string, title: string) {
  state.activities.unshift({ id: crypto.randomUUID(), team_id: DEMO_TEAM, user_id: DEMO_USER, action, entity_title: title, created_at: new Date().toISOString() })
  state.activities = state.activities.slice(0, 100)
}
// Browser clocks have millisecond resolution. Always advance the version even
// when two serialized edits happen within the same millisecond.
function nextVersion(previous?: string) {
  return new Date(Math.max(Date.now(), previous ? Date.parse(previous) + 1 : 0)).toISOString()
}
export async function demoAddLiterature(input: LiteratureInput, file?: File) {
  const id = crypto.randomUUID(), now = new Date().toISOString()
  if (file) await request('files', 'readwrite', s => s.put(file, id))
  try {
    await mutateDemo(state => {
      state.literature.unshift({ ...input, id, team_id: DEMO_TEAM, created_by: DEMO_USER, created_at: now, updated_at: now, file_path: file ? id : null, file_name: file?.name ?? null, file_size: file?.size ?? null })
      log(state, '添加了文献', input.title)
    })
  } catch (error) { if (file) await request('files', 'readwrite', s => s.delete(id)); throw error }
  return id
}
export async function demoFile(path: string) { const file = await request<Blob | undefined>('files', 'readonly', s => s.get(path)); if (!file) throw new Error('附件不存在，请重新上传。'); return file }
export async function demoDeleteLiterature(item: Literature) {
  await mutateDemo(state => { state.literature = state.literature.filter(x => x.id !== item.id); state.notes = state.notes.filter(x => x.literature_id !== item.id); log(state, '删除了文献', item.title) })
  if (item.file_path) await request('files', 'readwrite', s => s.delete(item.file_path!))
}
export async function demoSaveNote(literatureId: string, input: NoteInput, expected?: string) {
  await mutateDemo(state => {
    const item = state.literature.find(x => x.id === literatureId)
    if (!item) throw new Error('文献已被删除，无法保存笔记。')
    const old = state.notes.find(x => x.literature_id === literatureId && x.user_id === DEMO_USER)
    if ((old?.updated_at ?? undefined) !== expected) throw new Error('笔记已在其他窗口更新，请刷新后再编辑。')
    const note = { ...input, id: old?.id ?? crypto.randomUUID(), team_id: DEMO_TEAM, literature_id: literatureId, user_id: DEMO_USER, updated_at: nextVersion(old?.updated_at) }
    state.notes = [...state.notes.filter(x => x.id !== old?.id), note]
    log(state, '更新了阅读笔记', item.title)
  })
}
export async function demoSaveTask(input: TaskInput, old?: Task) {
  await mutateDemo(state => {
    if (old && !state.tasks.some(x => x.id === old.id && x.updated_at === old.updated_at)) throw new Error('任务已被其他窗口修改，请刷新后重试。')
    const now = new Date().toISOString()
    const item: Task = { ...input, id: old?.id ?? crypto.randomUUID(), team_id: DEMO_TEAM, created_by: old?.created_by ?? DEMO_USER, created_at: old?.created_at ?? now, updated_at: nextVersion(old?.updated_at) }
    state.tasks = old ? state.tasks.map(x => x.id === old.id ? item : x) : [...state.tasks, item]
    log(state, old ? '更新了任务' : '创建了任务', input.title)
  })
}
export async function demoDeleteTask(item: Task) { await mutateDemo(state => { if (!state.tasks.some(x => x.id === item.id && x.updated_at === item.updated_at)) throw new Error('任务已更新，请刷新后再删除。'); state.tasks = state.tasks.filter(x => x.id !== item.id); log(state, '删除了任务', item.title) }) }
export function subscribeDemo(fn: () => void) {
  window.addEventListener('research-update', fn)
  let channel: BroadcastChannel | null = null
  if (typeof BroadcastChannel === 'function') { try { channel = new BroadcastChannel(DB_NAME) } catch { /* Polling and focus refresh remain available. */ } }
  if (channel) channel.onmessage = fn
  return () => { window.removeEventListener('research-update', fn); channel?.close() }
}
