export type Answer = { optionIds?: string[]; value?: number; text?: string }

export function validateAnswer(type: string, input: unknown, optionIds: string[]): Answer | null {
  const answer = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  if (['single_select', 'multiple_select', 'true_false'].includes(type)) {
    const ids = Array.isArray(answer.optionIds) && answer.optionIds.every((id) => typeof id === 'string')
      ? [...new Set(answer.optionIds as string[])] : []
    if ((type !== 'multiple_select' && ids.length > 1) || ids.some((id) => !optionIds.includes(id))) return null
    return { optionIds: ids }
  }
  if (type === 'numerical') {
    if (answer.value === '' || answer.value === null || answer.value === undefined) return null
    const value = Number(answer.value)
    return Number.isFinite(value) ? { value } : null
  }
  if (type === 'short_answer') {
    if (typeof answer.text !== 'string' || answer.text.length > 10000) return null
    return { text: answer.text }
  }
  return null
}

export function gradeObjective(type: string, marks: number, negativeMarks: number, answer: Answer | null | undefined, key: { correctOptionIds?: string[] | null; numericalAnswer?: number | null; numericalTolerance?: number | null }, negativeMarking: boolean) {
  if (!answer) return { correct: false, score: 0 }
  let correct = false
  if (['single_select', 'multiple_select', 'true_false'].includes(type)) {
    const expected = new Set(key.correctOptionIds ?? [])
    const actual = new Set(answer.optionIds ?? [])
    correct = expected.size > 0 && expected.size === actual.size && [...expected].every((id) => actual.has(id))
  } else if (type === 'numerical' && key.numericalAnswer !== null && key.numericalAnswer !== undefined && typeof answer.value === 'number') {
    correct = Math.abs(answer.value - key.numericalAnswer) <= (key.numericalTolerance ?? 0)
  }
  return { correct, score: correct ? marks : negativeMarking ? -Math.max(0, negativeMarks) : 0 }
}

export function computeDeadline(startedAt: Date, durationSeconds: number, quizEnd: Date): Date {
  const duration = new Date(startedAt.getTime() + durationSeconds * 1000)
  return duration < quizEnd ? duration : quizEnd
}

export function canSeeResult(visibility: string, releasedAt: string | null, status: string, now: Date): boolean {
  if (status === 'in_progress' || visibility === 'hidden') return false
  if (visibility === 'after_submission') return true
  return visibility === 'after_release' && !!releasedAt && new Date(releasedAt) <= now
}

export function isTerminal(status: string): boolean { return status !== 'in_progress' }

export function sniffImageMime(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 8 && bytes[0] === 0x89 && String.fromCharCode(...bytes.slice(1, 4)) === 'PNG' && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png'
  if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp'
  return null
}
