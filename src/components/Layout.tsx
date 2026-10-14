import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Layers3, LayoutDashboard, Network, Library, Columns3, ArrowUpRight, Menu, X, MapPin, ChevronRight, LogOut, RefreshCw, FlaskConical } from 'lucide-react'
import { useResearch } from '../context'
import { isDemo, supabase } from '../lib/api'
const nav = [{ to: '/', label: '研究概览', en: 'Overview', icon: LayoutDashboard }, { to: '/framework', label: '理论框架', en: 'Framework', icon: Network }, { to: '/literature', label: '文献资料库', en: 'Literature', icon: Library }, { to: '/tasks', label: '团队任务', en: 'Team tasks', icon: Columns3 }]
export default function Layout() {
  const [open, setOpen] = useState(false)
  const { data, connected, error, loading, refresh, session, notify } = useResearch()
  const location = useLocation()
  const current = nav.find(item => item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to))
  const completed = data.tasks.filter(x => x.status === 'done').length
  const progress = data.tasks.length ? Math.round(completed / data.tasks.length * 100) : 0
  const name = data.members.find(x => x.user_id === session?.user.id)?.display_name ?? (isDemo ? '研究成员' : '团队成员')
  return <div className="app-layout"><a href="#main-content" className="skip-link" onClick={event => { event.preventDefault(); const content = document.getElementById('main-content'); content?.focus(); content?.scrollIntoView() }}>跳转至主要内容</a>
    {open && <button className="sidebar-scrim" aria-label="关闭导航" onClick={() => setOpen(false)} />}
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      <Link className="brand" to="/" onClick={() => setOpen(false)}><span className="brand-symbol"><Layers3 size={26} strokeWidth={1.7} /></span><div><strong>中合研究</strong><span>ZHONGHE RESEARCH</span></div></Link>
      <button className="mobile-close icon-button" aria-label="关闭导航" onClick={() => setOpen(false)}><X /></button>
      <div className="project-label">公共管理案例研究<span>PROJECT WORKSPACE</span></div>
      <nav aria-label="主导航">{nav.map(item => <NavLink key={item.to} end={item.to === '/'} to={item.to} onClick={() => setOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><item.icon size={19} strokeWidth={1.7} /><span>{item.label}</span>{item.to === '/literature' && <small>{data.literature.length}</small>}</NavLink>)}</nav>
      <div className="sidebar-project"><span className="sidebar-caption">当前研究项目</span><div className="project-dot" /><h3>中合村蛋鸡产业</h3><p><MapPin size={13} />四川 · 广安 · 悦来镇</p><Link to="/framework" className="sidebar-project-link">探索研究框架<ArrowUpRight size={15} /></Link></div>
      <div className="sidebar-bottom"><div className="sidebar-progress"><span>团队任务进度</span><strong>{progress}%</strong></div><div className="progress-track"><div style={{ width: `${progress}%` }} /></div><p>{completed} / {data.tasks.length} 项任务已完成</p><div className="workspace-status"><span className={`status-dot ${connected ? 'online' : ''}`} />{isDemo ? '本机演示工作台' : connected ? '团队同步已连接' : '每 30 秒刷新数据'}</div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb"><button className="mobile-menu icon-button" aria-label="打开导航" onClick={() => setOpen(true)}><Menu size={21} /></button><span className="desktop-crumb">研究工作台</span><ChevronRight size={14} className="desktop-crumb" /><strong>{current?.label ?? '页面'}</strong></div><div className="topbar-right"><span className="research-badge"><span />公共管理案例大赛</span><span className="topbar-divider" /><span className="avatar">{name.slice(0, 1)}</span><span className="user-label">{name}</span>{!isDemo && <button className="icon-button" title="退出登录" aria-label="退出登录" onClick={async () => { const { error } = await supabase!.auth.signOut(); if (error) notify(error.message, true) }}><LogOut size={17} /></button>}</div></header>
      <main id="main-content" tabIndex={-1}>
        {isDemo && <div className="demo-banner"><FlaskConical size={15} /><span>演示空间 · 修改仅保存在当前浏览器。配置 Supabase 后即可开启团队协作。</span><Link to="/guide">连接指南<ArrowUpRight size={13} /></Link></div>}
        {error && <div className="error-banner" role="alert"><span>数据加载失败：{error}</span><button className="button button-sm" onClick={() => void refresh()}><RefreshCw size={15} />重试</button></div>}
        {loading ? <div className="loading-state" role="status"><span className="spinner" />正在打开研究工作台…</div> : <Outlet />}
      </main><footer className="footer"><span>中合村蛋鸡产业案例研究协作平台</span><span>以案例为起点，让研究有据可循。</span></footer>
    </div>
  </div>
}
