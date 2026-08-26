import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { buildSignInUrl } from '../auth/signInUrl'

export type ExternalNavigate = (href: string) => void

export default function SignInRedirect({ navigate }: { navigate: ExternalNavigate }) {
  const location = useLocation()
  const returnUrl = `${location.pathname}${location.search}${location.hash}`
  const signInUrl = buildSignInUrl(returnUrl)

  useEffect(() => {
    navigate(signInUrl)
  }, [navigate, signInUrl])

  return (
    <section className="signin-redirect" aria-labelledby="signin-redirect-title">
      <h1 id="signin-redirect-title">Sign in required</h1>
      <p>You need to sign in to view this page.</p>
      <a className="button button--primary" href={signInUrl}>Continue to sign in</a>
    </section>
  )
}
