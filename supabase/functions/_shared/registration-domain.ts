export function canActivateVerifiedSignup(input: {
  emailConfirmedAt: string | null | undefined
  signupActivationPending: boolean
  role: string | null | undefined
}) {
  return Boolean(input.emailConfirmedAt) && input.signupActivationPending && input.role === 'student'
}
