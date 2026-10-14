import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Snapshot } from './types'
import { configError, isDemo, loadSnapshot, subscribe, supabase, DEMO_USER_ID } from './lib/api'

const empty: Snapshot = { literature: [], tasks: [], notes: [], members: [], activities: [] }
type Context = { data: Snapshot; userId: string; session: Session | null; loading: boolean; error: string; connected: boolean; refresh: () => Promise<void>; notify: (text: string, error?: boolean) => void }
const ResearchContext = createContext<Context | null>(null)
export function ResearchProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(isDemo || Boolean(configError))
  const [data, setData] = useState<Snapshot>(empty)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(configError ?? '')
  const [connected, setConnected] = useState(false)
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(null)
  const generation = useRef(0)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const userId = isDemo ? DEMO_USER_ID : session?.user.id ?? ''
  useEffect(() => {
    if (!supabase) return
    let active = true
    supabase.auth.getSession().then(({ data, error }) => { if (active) { setSession(data.session); setAuthReady(true); if (error) setError(error.message) } })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, value) => { if (active) { setSession(value); setAuthReady(true) } })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])
  const refresh = useCallback(async () => {
    if (!userId || configError) { setLoading(false); return }
    const request = ++generation.current
    try { const fresh = await loadSnapshot(); if (request === generation.current) { setData(fresh); setError('') } }
    catch (cause) { if (request === generation.current) setError(cause instanceof Error ? cause.message : '数据加载失败') }
    finally { if (request === generation.current) setLoading(false) }
  }, [userId])
  useEffect(() => {
    if (!authReady) return
    ++generation.current; setData(empty); setLoading(Boolean(userId)); void refresh()
    if (!userId || configError) return
    const update = () => { void refresh() }
    const unsubscribe = subscribe(update, setConnected)
    window.addEventListener('focus', update)
    // Realtime failures still receive eventual updates; no edits are silently discarded.
    const timer = setInterval(update, 30000)
    return () => { ++generation.current; unsubscribe(); clearInterval(timer); window.removeEventListener('focus', update) }
  }, [authReady, userId, refresh])
  const notify = useCallback((text: string, error = false) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ text, error }); toastTimer.current = setTimeout(() => setToast(null), error ? 8000 : 3500)
  }, [])
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])
  return <ResearchContext.Provider value={{ data, userId, session, loading: loading || !authReady, error, connected, refresh, notify }}>
    {children}
    {toast && <div className={`toast ${toast.error ? 'toast-error' : ''}`} role={toast.error ? 'alert' : 'status'}>{toast.text}<button aria-label="关闭提示" onClick={() => setToast(null)}>×</button></div>}
  </ResearchContext.Provider>
}
export function useResearch() { const value = useContext(ResearchContext); if (!value) throw new Error('ResearchProvider missing'); return value }
export async function perform(action: () => Promise<unknown>, refresh: () => Promise<void>, notify: Context['notify'], message: string) {
  try { await action(); await refresh(); notify(message); return true }
  catch (error) { notify(error instanceof Error ? error.message : '操作失败，请重试。', true); await refresh(); return false }
}
