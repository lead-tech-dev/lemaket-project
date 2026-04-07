import { http } from '@/core/api/http'
import type { AuthResponse, AuthUser } from './auth.types'

export type LoginPayload = {
  email: string
  password: string
}

export type ForgotPasswordPayload = {
  email: string
}

export type ResetPasswordPayload = {
  token: string
  password: string
}

export const authApi = {
  login: (payload: LoginPayload) => http.post<AuthResponse>('/auth/login', payload),
  register: (payload: Record<string, unknown>) => http.post<AuthResponse>('/auth/register', payload),
  forgotPassword: (payload: ForgotPasswordPayload) => http.post<{ message: string }>('/auth/forgot-password', payload),
  resetPassword: (payload: ResetPasswordPayload) => http.post<void>('/auth/reset-password', payload),
  me: () => http.get<AuthUser>('/users/me'),
  logout: () => http.post<{ success: boolean }>('/auth/logout')
}
