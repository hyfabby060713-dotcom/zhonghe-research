import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { registerAccount, confirmationUrl, accountError } from '../src/lib/auth'

describe('成员自主注册', () => {
  it('验证邮件回到 GitHub Pages 部署子目录；只提交姓名，不提交团队资格或邀请码', async () => {
    const signUp = vi.fn().mockResolvedValue({ data: { session: null, user: { id: 'new-user' } }, error: null })
    const client = { auth: { signUp } } as unknown as SupabaseClient
    const redirect = confirmationUrl({ origin: 'https://example.github.io', pathname: '/zhonghe-research/' })
    await registerAccount(client, { name: ' 小组成员 ', email: ' user@example.org ', password: 'example-password' }, redirect)
    expect(signUp).toHaveBeenCalledWith({ email: 'user@example.org', password: 'example-password', options: { emailRedirectTo: 'https://example.github.io/zhonghe-research/', data: { display_name: '小组成员' } } })
  })
  it('拒绝空姓名和短密码；认证服务失败会返回可识别错误', async () => {
    const signUp = vi.fn().mockResolvedValue({ data: null, error: { code: 'signup_disabled' } })
    const client = { auth: { signUp } } as unknown as SupabaseClient
    await expect(registerAccount(client, { name: '', email: 'user@example.org', password: 'long-password' }, 'https://example.org/')).rejects.toThrow(/姓名/)
    await expect(registerAccount(client, { name: '成员', email: 'user@example.org', password: '123' }, 'https://example.org/')).rejects.toThrow(/8 位/)
    expect(signUp).not.toHaveBeenCalled()
    await expect(registerAccount(client, { name: '成员', email: 'user@example.org', password: 'long-password' }, 'https://example.org/')).rejects.toEqual({ code: 'signup_disabled' })
    expect(accountError({ code: 'signup_disabled' })).toMatch(/开启邮箱注册/)
    expect(accountError({ code: 'email_not_confirmed' })).toMatch(/邮箱尚未验证/)
  })
})
