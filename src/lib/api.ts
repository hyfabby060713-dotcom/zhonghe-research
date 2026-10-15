import { createClient } from '@supabase/supabase-js'
import type { Literature, LiteratureInput, NoteInput, Snapshot, Task, TaskInput } from '../types'
import * as demo from './demo'
import { DEMO_USER } from './seed'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
export const teamId = import.meta.env.VITE_TEAM_ID?.trim()
const anyConfig = Boolean(url || key || teamId)
function isServerKey(value?: string) {
  if (!value) return false
  if (value.startsWith('sb_secret_')) return true
  try { return JSON.parse(atob(value.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'service_role' }
  catch { return false }
}
export const configError = isServerKey(key) ? '此处只能使用 Supabase publishable / anon 公开密钥。请移除服务端密钥并在 Supabase 中轮换已经暴露的密钥。' : anyConfig && (!url || !key || !teamId || !/^https:\/\//.test(url) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId)) ? 'Supabase 配置不完整：请检查 URL、公开密钥和团队 UUID。修改后重启开发服务器或重新部署。' : null
export const isDemo = !anyConfig
export const supabase = !isDemo && !configError ? createClient(url!, key!) : null
export const DEMO_USER_ID = DEMO_USER
function checked<T>(result: { data: T; error: { message: string } | null }): T { if (result.error) throw new Error(result.error.message); return result.data }
export function validateFile(file: File) {
  if (!/\.(pdf|doc|docx)$/i.test(file.name)) throw new Error('仅支持 PDF、DOC、DOCX 文件。')
  if (file.size > 20 * 1024 * 1024) throw new Error('文件不能超过 20 MB。')
  if (!file.size) throw new Error('不能上传空文件。')
}
export function validateLiterature(input: LiteratureInput) {
  if (!input.title.trim() || !input.authors.trim() || !input.journal.trim()) throw new Error('请填写标题、作者和来源。')
  if (!Number.isInteger(input.year) || input.year < 1800 || input.year > new Date().getFullYear() + 1) throw new Error('请输入有效的出版年份。')
  if (input.source_url && !/^https?:\/\//i.test(input.source_url)) throw new Error('来源链接必须以 http:// 或 https:// 开头。')
}
export async function loadSnapshot(): Promise<Snapshot> {
  if (isDemo) return demo.loadDemo()
  if (!supabase) throw new Error(configError ?? 'Supabase 尚未连接。')
  const [literature, tasks, notes, members, activities] = await Promise.all([
    supabase.from('literature').select('*').eq('team_id', teamId).order('created_at', { ascending: false }),
    supabase.from('tasks').select('*').eq('team_id', teamId).order('created_at'),
    supabase.from('reading_notes').select('*').eq('team_id', teamId).order('updated_at', { ascending: false }),
    supabase.from('team_members').select('*').eq('team_id', teamId),
    supabase.from('activity_logs').select('*').eq('team_id', teamId).order('created_at', { ascending: false }).limit(30),
  ])
  const data = { literature: checked(literature), tasks: checked(tasks), notes: checked(notes), members: checked(members), activities: checked(activities) } as Snapshot
  return data
}
export async function joinTeam(inviteCode: string, memberName: string) {
  if (!supabase) throw new Error('请先连接 Supabase。')
  const { data, error } = await supabase.rpc('join_team_with_invite', { target_team: teamId, invite_code: inviteCode.trim(), member_name: memberName.trim() })
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') throw new Error('入组功能尚未启用，请联系组长完成配置。')
    throw new Error('暂时无法加入团队，请稍后重试或联系组长。')
  }
  if (!data?.joined) throw new Error(data?.message ?? '未能加入团队，请检查邀请码。')
}
export async function addLiterature(input: LiteratureInput, userId: string, file?: File) {
  validateLiterature(input); if (file) validateFile(file)
  if (isDemo) return demo.demoAddLiterature(input, file)
  const id = crypto.randomUUID()
  const path = file ? `${teamId}/${id}/${crypto.randomUUID()}.${file.name.split('.').pop()!.toLowerCase()}` : null
  if (file && path) {
    const contentType = /\.pdf$/i.test(file.name) ? 'application/pdf' : /\.docx$/i.test(file.name) ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/msword'
    checked(await supabase!.storage.from('literature-files').upload(path, file, { contentType, upsert: false }))
  }
  const result = await supabase!.from('literature').insert({ ...input, id, team_id: teamId, created_by: userId, file_path: path, file_name: file?.name ?? null, file_size: file?.size ?? null }).select('id').single()
  if (result.error) {
    if (path) {
      const cleanup = await supabase!.storage.from('literature-files').remove([path])
      if (cleanup.error) throw new Error(`${result.error.message}；附件清理失败，请管理员检查存储中的 ${path}`)
    }
    throw new Error(result.error.message)
  }
  return id
}
export async function deleteLiterature(item: Literature) {
  if (isDemo) return demo.demoDeleteLiterature(item)
  // Delete the row first: DB failure never leaves a surviving row with a missing file.
  checked(await supabase!.from('literature').delete().eq('id', item.id).eq('team_id', teamId).select('id').single())
  if (item.file_path) { const { error } = await supabase!.storage.from('literature-files').remove([item.file_path]); if (error) throw new Error('文献已删除，但附件清理失败，请管理员清理存储中的遗留文件。') }
}
export async function downloadFile(item: Literature) {
  if (!item.file_path) throw new Error('该题录尚未上传附件。')
  if (isDemo) {
    const blob = await demo.demoFile(item.file_path), href = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = href; a.download = item.file_name ?? '文献'; a.click()
    setTimeout(() => URL.revokeObjectURL(href), 30000)
  } else {
    const data = checked(await supabase!.storage.from('literature-files').createSignedUrl(item.file_path, 60, { download: item.file_name ?? true }))
    if (!data) throw new Error('未能生成附件下载链接。')
    const a = document.createElement('a'); a.href = data.signedUrl; a.rel = 'noopener'; a.click()
  }
}
export async function saveNote(literatureId: string, userId: string, input: NoteInput, expected?: string) {
  if (isDemo) return demo.demoSaveNote(literatureId, input, expected)
  const row = { ...input, team_id: teamId, literature_id: literatureId, user_id: userId }
  if (expected) {
    const data = checked(await supabase!.from('reading_notes').update(input).eq('team_id', teamId).eq('literature_id', literatureId).eq('user_id', userId).eq('updated_at', expected).select('id'))
    if (!data?.length) throw new Error('笔记已在其他窗口更新，请刷新后再编辑。')
  } else { checked(await supabase!.from('reading_notes').insert(row)) }
}
export async function saveTask(input: TaskInput, userId: string, old?: Task) {
  if (!input.title.trim()) throw new Error('请输入任务名称。')
  if (isDemo) return demo.demoSaveTask(input, old)
  if (old) {
    const data = checked(await supabase!.from('tasks').update(input).eq('id', old.id).eq('team_id', teamId).eq('updated_at', old.updated_at).select('id'))
    if (!data?.length) throw new Error('任务已被其他成员修改，请刷新后重试。')
  } else { checked(await supabase!.from('tasks').insert({ ...input, team_id: teamId, created_by: userId })) }
}
export async function deleteTask(item: Task) {
  if (isDemo) return demo.demoDeleteTask(item)
  const data = checked(await supabase!.from('tasks').delete().eq('id', item.id).eq('team_id', teamId).eq('updated_at', item.updated_at).select('id'))
  if (!data?.length) throw new Error('任务已更新，请刷新后再删除。')
}
export function subscribe(fn: () => void, status: (connected: boolean) => void) {
  if (isDemo) { status(true); return demo.subscribeDemo(fn) }
  let channel = supabase!.channel(`team-${teamId}`)
  // activity_logs are append-only and cover all mutations, including DELETE events.
  channel = channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs', filter: `team_id=eq.${teamId}` }, fn)
  channel.subscribe(value => status(value === 'SUBSCRIBED'))
  return () => { void supabase!.removeChannel(channel) }
}
