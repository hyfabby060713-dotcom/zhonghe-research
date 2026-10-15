import type { SupabaseClient } from '@supabase/supabase-js'

export function confirmationUrl(location: Pick<Location, 'origin' | 'pathname'>) {
  // 邮件返回部署根路径，保留 GitHub Pages 子目录，不带 HashRouter 路由或邀请码。
  return `${location.origin}${location.pathname}`
}
export async function registerAccount(client: SupabaseClient, input: { name: string; email: string; password: string }, redirect: string) {
  if (!input.name.trim() || input.name.trim().length > 100) throw new Error('请填写 1–100 字的成员姓名。')
  if (input.password.length < 8) throw new Error('密码至少需要 8 位。')
  const result = await client.auth.signUp({
    email: input.email.trim(), password: input.password,
    options: { emailRedirectTo: redirect, data: { display_name: input.name.trim() } },
  })
  if (result.error) throw result.error
  return result.data
}
export function accountError(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  if (code === 'email_not_confirmed') return '邮箱尚未验证，请查收验证邮件，或点击下方重新发送。'
  if (code === 'user_already_exists' || code === 'email_exists') return '该邮箱已注册，请切换到登录。'
  if (code === 'signup_disabled') return '当前未开放注册，请联系组长在 Supabase 开启邮箱注册。'
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return '请求过于频繁，请稍后再试。'
  if (code === 'weak_password') return '密码不符合要求，请使用更长的密码，并结合字母、数字和符号。'
  if (code === 'email_address_not_authorized') return '邮件服务尚未配置好，请联系组长配置 Supabase SMTP。'
  if (code === 'invalid_credentials') return '邮箱或密码不正确，请检查后重试。'
  if (error instanceof Error && !code && /^请填写|^密码至少/.test(error.message)) return error.message
  return '暂时无法完成操作，请检查网络后重试；如持续失败，请联系组长检查认证设置。'
}
