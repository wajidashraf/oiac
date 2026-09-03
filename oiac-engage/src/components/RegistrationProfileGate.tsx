import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { AuthSession } from '../auth/powerPagesSession'
import {
  finalizeRegistrationProfile,
  readPendingRegistrationProfile,
} from '../features/registrationProfile/registrationProfile'
import PendingApprovalShell from './PendingApprovalShell'

type AuthenticatedSession = Extract<AuthSession, { status: 'authenticated' }>

type RegistrationProfileGateProps = {
  readonly session: AuthenticatedSession
  readonly children: (session: AuthenticatedSession) => ReactNode
}

type GateState =
  | { readonly status: 'working' }
  | { readonly status: 'ready'; readonly names: { readonly firstName?: string; readonly lastName?: string } }
  | { readonly status: 'error' }

function initialState(session: AuthenticatedSession): GateState {
  const pending = readPendingRegistrationProfile()
  return pending
    ? { status: 'working' }
    : {
        status: 'ready',
        names: {
          firstName: session.user.firstName,
          lastName: session.user.lastName,
        },
      }
}

export default function RegistrationProfileGate({
  session,
  children,
}: RegistrationProfileGateProps) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<GateState>(() => initialState(session))
  const requestRef = useRef<{
    readonly attempt: number
    readonly promise: ReturnType<typeof finalizeRegistrationProfile>
  } | null>(null)

  useEffect(() => {
    if (!readPendingRegistrationProfile()) {
      setState((current) => current.status === 'ready'
        ? current
        : {
            status: 'ready',
            names: {
              firstName: session.user.firstName,
              lastName: session.user.lastName,
            },
          })
      return
    }

    let active = true
    setState({ status: 'working' })
    const existingRequest = requestRef.current
    const request = existingRequest?.attempt === attempt
      ? existingRequest.promise
      : finalizeRegistrationProfile(session)
    requestRef.current = { attempt, promise: request }

    void request
      .then((completedSession) => {
        if (!active) return
        setState({
          status: 'ready',
          names: {
            firstName: completedSession.user.firstName,
            lastName: completedSession.user.lastName,
          },
        })
      })
      .catch(() => {
        if (active) setState({ status: 'error' })
      })

    return () => {
      active = false
    }
  }, [attempt, session])

  if (state.status === 'working') {
    return (
      <PendingApprovalShell>
        <section className="pending-approval-page" aria-labelledby="registration-profile-title">
          <article className="pending-approval-card registration-profile-gate" aria-live="polite">
            <div className="registration-profile-gate__spinner" aria-hidden="true" />
            <p className="pending-approval-card__status">Account setup</p>
            <h1 id="registration-profile-title">Completing your profile</h1>
            <p>We’re securely saving your First Name and Last Name to your account.</p>
          </article>
        </section>
      </PendingApprovalShell>
    )
  }

  if (state.status === 'error') {
    return (
      <PendingApprovalShell>
        <section className="pending-approval-page" aria-labelledby="registration-profile-title">
          <article className="pending-approval-card registration-profile-gate" role="alert">
            <p className="pending-approval-card__status">Account setup needs attention</p>
            <h1 id="registration-profile-title">We couldn’t finish your profile</h1>
            <p>Your account was created, but we couldn’t save your name yet. Try again before continuing.</p>
            <div className="registration-profile-gate__actions">
              <button className="button button--primary" type="button" onClick={() => setAttempt((value) => value + 1)}>
                Retry
              </button>
              <a className="button button--quiet" href="/Account/Login/LogOff?returnUrl=%2F">
                Sign Out
              </a>
            </div>
          </article>
        </section>
      </PendingApprovalShell>
    )
  }

  const effectiveSession: AuthenticatedSession = {
    status: 'authenticated',
    user: {
      ...session.user,
      firstName: state.names.firstName,
      lastName: state.names.lastName,
    },
  }

  return children(effectiveSession)
}
