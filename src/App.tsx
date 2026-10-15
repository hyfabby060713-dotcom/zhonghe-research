import { BrowserRouter, HashRouter, Routes, Route, Link, useNavigate } from 'react-router-dom'
import { Layers3 } from 'lucide-react'
import { ResearchProvider, useResearch } from './context'
import { configError, isDemo, joinTeam, supabase } from './lib/api'
import { AccessShell, AccountForm, JoinTeamForm } from './components/AccountAccess'
import Layout from './components/Layout'
import Home from './pages/Home'
import Framework from './pages/Framework'
import Literature from './pages/Literature'
import LiteratureDetail from './pages/LiteratureDetail'
import Tasks from './pages/Tasks'
import Guide from './pages/Guide'
import { Empty } from './components/ui'

function AuthGate() {
  const { session, loading, data, error, refresh } = useResearch()
  const navigate = useNavigate()
  if (configError) return <div className="auth-page"><div className="auth-card"><Layers3 size={32} /><h1>检查工作台配置</h1><p role="alert">{configError}</p><p>请参照项目 README.md 完成三项环境变量配置。</p></div></div>
  async function signOut() { const { error: failure } = await supabase!.auth.signOut(); if (failure) throw failure }
  if (!isDemo && loading) return <AccessShell><p role="status">正在连接研究空间…</p></AccessShell>
  if (!isDemo && !session) return <AccessShell><AccountForm initialError={error ? '登录会话未能恢复，请重新登录。' : ''} /></AccessShell>
  if (!isDemo && error) return <AccessShell><h2>暂时无法读取研究空间</h2><p role="alert">{error}</p><button className="button button-primary" onClick={() => void refresh()}>重新连接</button><button className="auth-text-button" onClick={() => void signOut().catch(() => {})}>退出登录</button></AccessShell>
  if (!isDemo && session && !data.members.some(member => member.user_id === session.user.id)) return <AccessShell><JoinTeamForm email={session.user.email ?? ''} initialName={String(session.user.user_metadata?.display_name ?? '').slice(0, 100)} verified={Boolean(session.user.email_confirmed_at)} onJoin={async (code, name) => { await joinTeam(code, name); await refresh(); navigate('/', { replace: true }) }} onSignOut={signOut} /></AccessShell>
  return <Routes><Route element={<Layout />}><Route index element={<Home />} /><Route path="framework" element={<Framework />} /><Route path="literature" element={<Literature />} /><Route path="literature/:id" element={<LiteratureDetail />} /><Route path="tasks" element={<Tasks />} /><Route path="guide" element={<Guide />} /><Route path="*" element={<div className="page"><Empty title="这个页面还没有研究内容" description="回到工作台，继续你的研究。" action={<Link className="button" to="/">返回首页</Link>} /></div>} /></Route></Routes>
}
const Router = import.meta.env.VITE_ROUTER_MODE === 'hash' ? HashRouter : BrowserRouter
export default function App() { return <Router><ResearchProvider><AuthGate /></ResearchProvider></Router> }
