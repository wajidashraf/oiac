export function buildSignInUrl(returnUrl = '/'): string {
  const safeReturnUrl = returnUrl.startsWith('/') && !returnUrl.startsWith('//')
    ? returnUrl
    : '/'

  return `/SignIn?${new URLSearchParams({ returnUrl: safeReturnUrl }).toString()}`
}
