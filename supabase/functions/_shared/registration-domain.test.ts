import { describe, expect, it } from 'vitest'
import { canActivateVerifiedSignup } from './registration-domain'

describe('verified student signup activation', () => {
  it('activates a confirmed self-service student registration', () => {
    expect(canActivateVerifiedSignup({ emailConfirmedAt: '2026-10-10T03:00:00Z', signupActivationPending: true, role: 'student' })).toBe(true)
  })

  it('does not activate an unconfirmed email, non-signup account, or non-student role', () => {
    expect(canActivateVerifiedSignup({ emailConfirmedAt: null, signupActivationPending: true, role: 'student' })).toBe(false)
    expect(canActivateVerifiedSignup({ emailConfirmedAt: 'now', signupActivationPending: false, role: 'student' })).toBe(false)
    expect(canActivateVerifiedSignup({ emailConfirmedAt: 'now', signupActivationPending: true, role: 'admin' })).toBe(false)
  })
})
