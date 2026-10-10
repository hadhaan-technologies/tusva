export const INSTITUTION_EMAIL_DOMAIN = 'jainuniversity.ac.in'

export function isInstitutionEmail(value: string) {
  const email = value.trim().toLowerCase()
  const at = email.lastIndexOf('@')
  return at > 0 && email.slice(at + 1) === INSTITUTION_EMAIL_DOMAIN
}

export const institutionEmailError = `Use your @${INSTITUTION_EMAIL_DOMAIN} email address.`
