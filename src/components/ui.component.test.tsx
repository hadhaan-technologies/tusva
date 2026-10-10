import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button, Input } from './ui'
import SignupOtpForm from './SignupOtpForm'

describe('shared UI components', () => {
  it('fires button actions and respects disabled state', () => {
    const onClick = vi.fn()
    render(<><Button onClick={onClick}>Save quiz</Button><Button disabled onClick={onClick}>Unavailable</Button></>)
    fireEvent.click(screen.getByRole('button', { name: 'Save quiz' }))
    fireEvent.click(screen.getByRole('button', { name: 'Unavailable' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('keeps accessible input attributes and entered values', () => {
    render(<><label htmlFor="email">University email</label><Input id="email" type="email" required /></>)
    const input = screen.getByLabelText('University email') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'student@jainuniversity.ac.in' } })
    expect(input.value).toBe('student@jainuniversity.ac.in')
    expect(input.required).toBe(true)
  })

  it('accepts a six digit signup OTP and invokes the verify action', () => {
    const onVerify = vi.fn()
    render(<SignupOtpForm email="student@jainuniversity.ac.in" busy={false} error="" notice="" onVerify={onVerify} onResend={() => {}} onBack={() => {}} />)
    const code = screen.getByLabelText('Email verification code')
    fireEvent.change(code, { target: { value: '12a45678' } })
    expect((code as HTMLInputElement).value).toBe('124567')
    fireEvent.click(screen.getByRole('button', { name: /verify email/i }))
    expect(onVerify).toHaveBeenCalledWith('124567')
  })
})
