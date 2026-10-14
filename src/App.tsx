import { useState, type FormEvent } from 'react'
import { BrowserRouter, HashRouter, Routes, Route, Link } from 'react-router-dom'
import { Layers3, ArrowRight, LockKeyhole, Mail } from 'lucide-react'
import { ResearchProvider, useResearch } from './context'
import { configError, isDemo, supabase } from './lib/api'
import Layout from './components/Layout'
import Home from './pages/Home'
import Framework from './pages/Framework'
import Literature from './pages/Literature'
import LiteratureDetail from './pages/LiteratureDetail'
import Tasks from './pages/Tasks'
import Guide from './pages/Guide'
import { Empty } from './components/ui'

function AuthGate() {
  const { session, loading } = useResearch()
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(''); const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password }); if (error) setError('登录失败，请检查邮箱、密码或联系管理员。'); setBusy(false) }
  if (configError) return <div className="auth-page"><div className="auth-card"><Layers3 size={32} /><h1>检查工作台配置</h1><p role="alert">{configError}</p><p>请参照项目 README.md 完成三项环境变量配置。</p></div></div>
  if (!isDemo && !session) return <div className="auth-page"><div className="auth-intro"><span className="auth-brand"><Layers3 />中合研究</span><span className="eyebrow">A SHARED SPACE FOR RESEARCH</span><h1>从田野出发，<br />在协作中理解治理。</h1><p>中合村蛋鸡产业案例研究协作平台</p><div className="auth-lines" /></div><div className="auth-card"><span className="eyebrow">TEAM WORKSPACE</span><h2>进入团队研究空间</h2><p>使用管理员为你创建的成员账号登录。</p><form className="form" onSubmit={submit}><label><span><Mail size={15} />成员邮箱</span><input type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" /></label><label><span><LockKeyhole size={15} />密码</span><input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="输入登录密码" /></label>{error && <p role="alert" className="field-error">{error}</p>}<button disabled={busy || loading} className="button button-primary">{busy || loading ? '正在连接…' : '登录工作台'}<ArrowRight size={17} /></button></form><p className="source-note">资料仅对团队成员开放。忘记密码请联系项目管理员重设。</p></div></div>
  return <Routes><Route element={<Layout />}><Route index element={<Home />} /><Route path="framework" element={<Framework />} /><Route path="literature" element={<Literature />} /><Route path="literature/:id" element={<LiteratureDetail />} /><Route path="tasks" element={<Tasks />} /><Route path="guide" element={<Guide />} /><Route path="*" element={<div className="page"><Empty title="这个页面还没有研究内容" description="回到工作台，继续你的研究。" action={<Link className="button" to="/">返回首页</Link>} /></div>} /></Route></Routes>
}
const Router = import.meta.env.VITE_ROUTER_MODE === 'hash' ? HashRouter : BrowserRouter
export default function App() { return <Router><ResearchProvider><AuthGate /></ResearchProvider></Router> }
