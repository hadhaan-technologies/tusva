import { describe, expect, it } from 'vitest'
import { isInstitutionEmail } from './institution-email'

describe('Jain University email restriction', () => {
  it('accepts the configured university domain without case sensitivity', () => {
    expect(isInstitutionEmail('person@jainuniversity.ac.in')).toBe(true)
    expect(isInstitutionEmail('Person@JainUniversity.ac.in')).toBe(true)
  })

  it('rejects other domains and deceptive suffixes', () => {
    expect(isInstitutionEmail('person@example.com')).toBe(false)
    expect(isInstitutionEmail('person@jainuniversity.ac.in.example.com')).toBe(false)
    expect(isInstitutionEmail('person@notjainuniversity.ac.in')).toBe(false)
    expect(isInstitutionEmail('jainuniversity.ac.in')).toBe(false)
  })
})
