import { useState, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, Layers3, LockKeyhole, Mail, Ticket, UserRound } from 'lucide-react'
import { supabase } from '../lib/api'
import { accountError, confirmationUrl, registerAccount } from '../lib/auth'

export function AccessShell({ children }: { children: ReactNode }) {
  return <div className="auth-page"><div className="auth-intro"><span className="auth-brand"><Layers3 />中合研究</span><span className="eyebrow">A SHARED SPACE FOR RESEARCH</span><h1>从田野出发，<br />在协作中理解治理。</h1><p>中合村蛋鸡产业案例研究协作平台</p><div className="auth-lines" /></div><main className="auth-card">{children}</main></div>
}

export function AccountForm({ initialError = '' }: { initialError?: string }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState(''), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState(initialError), [notice, setNotice] = useState('')
  const [sentTo, setSentTo] = useState(''), [resendAt, setResendAt] = useState(0)
  const [resendAvailable, setResendAvailable] = useState(false)
  function changeMode(next: 'login' | 'register') { setMode(next); setPassword(''); setConfirmation(''); setError(''); setNotice('') }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setNotice('')
    if (!supabase) { setError('当前是演示空间，请先连接 Supabase 后注册。'); return }
    if (mode === 'register' && password !== confirmation) { setError('两次输入的密码不一致。'); return }
    setBusy(true)
    try {
      if (mode === 'register') {
        const data = await registerAccount(supabase, { name, email, password }, confirmationUrl(window.location))
        setPassword(''); setConfirmation('')
        if (!data.session) {
          setSentTo(email.trim()); setResendAt(Date.now() + 60000); setResendAvailable(true)
          setNotice('注册请求已提交。请查收邮箱中的验证邮件，完成验证后回到本站登录。若该邮箱已注册，请直接登录。')
          setMode('login')
        }
      } else {
        const { error: failure } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (failure) { if (failure.code === 'email_not_confirmed') { setResendAvailable(true); setSentTo(email.trim()) }; throw failure }
        setPassword('')
      }
    } catch (failure) { setError(accountError(failure)) }
    finally { setBusy(false) }
  }
  async function resend() {
    setError(''); setNotice('')
    if (Date.now() < resendAt) { setError('请稍等一分钟再重新发送验证邮件。'); return }
    const recipient = email.trim() || sentTo
    if (!supabase || !recipient) { setError('请先填写注册时使用的邮箱。'); return }
    setBusy(true)
    try {
      const { error: failure } = await supabase.auth.resend({ type: 'signup', email: recipient, options: { emailRedirectTo: confirmationUrl(window.location) } })
      if (failure) throw failure
      setResendAt(Date.now() + 60000)
      setNotice('验证邮件已请求重新发送，请同时检查垃圾邮件文件夹。')
    } catch (failure) { setError(accountError(failure)) }
    finally { setBusy(false) }
  }
  return <><span className="eyebrow">TEAM WORKSPACE</span><h2>{mode === 'register' ? '创建你的研究账号' : '进入团队研究空间'}</h2><p>{mode === 'register' ? '自己设置密码，验证邮箱后使用邀请码加入小组。' : '使用自己的邮箱和密码登录。新成员可先注册账号。'}</p>
    <div className="auth-tabs" role="group" aria-label="账号操作"><button type="button" aria-pressed={mode === 'login'} disabled={busy} onClick={() => changeMode('login')}>登录</button><button type="button" aria-pressed={mode === 'register'} disabled={busy} onClick={() => changeMode('register')}>注册账号</button></div>
    <form className="form" onSubmit={submit} aria-busy={busy}>
      {mode === 'register' && <label><span><UserRound size={15} />成员姓名</span><input required maxLength={100} autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="用于团队协作记录" /></label>}
      <label><span><Mail size={15} />邮箱</span><input type="email" required maxLength={254} autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" /></label>
      <label><span><LockKeyhole size={15} />密码</span><input type="password" required minLength={mode === 'register' ? 8 : undefined} maxLength={128} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'register' ? '至少 8 位，建议组合字母、数字和符号' : '输入登录密码'} /></label>
      {mode === 'register' && <label><span>确认密码</span><input type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} placeholder="再次输入密码" /></label>}
      {error && <p role="alert" className="field-error">{error}</p>}{notice && <p role="status" className="auth-notice">{notice}</p>}
      <button disabled={busy} className="button button-primary">{busy ? '正在处理…' : mode === 'register' ? '注册并验证邮箱' : '登录工作台'}<ArrowRight size={17} /></button>
    </form>
    {resendAvailable && <button type="button" className="auth-text-button" disabled={busy} onClick={() => void resend()}>重新发送验证邮件</button>}
    <p className="source-note">注册账号后仍需邀请码才能访问团队资料。密码由你自行保管，无需交给组长。忘记密码请联系管理员。</p></>
}

export function JoinTeamForm({ email, initialName, verified, onJoin, onSignOut }: { email: string; initialName: string; verified: boolean; onJoin: (code: string, name: string) => Promise<void>; onSignOut: () => Promise<void> }) {
  const [name, setName] = useState(initialName), [code, setCode] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true)
    try { await onJoin(code, name); setCode('') }
    catch (failure) { setError(failure instanceof Error ? failure.message : '未能加入团队，请稍后重试。') }
    finally { setBusy(false) }
  }
  async function resend() {
    setBusy(true); setError('')
    try {
      const { error: failure } = await supabase!.auth.resend({ type: 'signup', email, options: { emailRedirectTo: confirmationUrl(window.location) } })
      if (failure) throw failure
      setNotice('请查收邮箱验证邮件，完成验证后重新登录。')
    } catch (failure) { setError(accountError(failure)) }
    finally { setBusy(false) }
  }
  return <><span className="eyebrow">JOIN YOUR RESEARCH TEAM</span><h2>{verified ? '加入研究小组' : '请先验证邮箱'}</h2><p className="auth-email">当前账号：{email}</p>{verified ? <><p>向组长获取邀请码，加入后即可共享文献、笔记和任务。</p><form className="form" onSubmit={submit} aria-busy={busy}>
    <label><span><UserRound size={15} />成员姓名</span><input required maxLength={100} autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="你的姓名" /></label>
    <label><span><Ticket size={15} />团队邀请码</span><input required maxLength={128} autoComplete="off" autoCapitalize="none" spellCheck={false} value={code} onChange={e => setCode(e.target.value)} placeholder="粘贴组长提供的邀请码" /></label>
    <button disabled={busy} className="button button-primary">{busy ? '正在加入…' : '加入研究小组'}<ArrowRight size={17} /></button>
  </form></> : <><p>请通过注册邮件完成邮箱验证。验证完成后重新登录，即可输入邀请码。</p><button className="button button-primary" disabled={busy} onClick={() => void resend()}>重新发送验证邮件</button></>}
    {error && <p role="alert" className="field-error auth-feedback">{error}</p>}{notice && <p role="status" className="auth-notice auth-feedback">{notice}</p>}
    <button type="button" className="auth-text-button" disabled={busy} onClick={async () => { setError(''); try { await onSignOut() } catch { setError('退出失败，请检查网络后重试。') } }}>退出并切换账号</button>
    <p className="source-note">邀请码失效或名额已满时，请联系组长获取新码。</p></>
}
