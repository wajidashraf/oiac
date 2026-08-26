# OIAC Engage Anonymous and Authentication Redesign

## Summary

OIAC Engage will gain an authentication-aware presentation boundary. Anonymous visitors will see a branded landing page based on the supplied Figma design and will have only one primary action: sign in. Authenticated visitors will continue into the existing member portal experience.

Power Pages will remain responsible for local-account authentication, password recovery, invitation validation, and account creation. Its native sign-in, registration, and invitation-redemption pages will be visually themed to match the supplied design rather than replaced by React simulations.

Design reference: <https://wolf-flask-48679482.figma.site/>

## Goals

- Show the public hero, anonymous header, and anonymous footer only before sign-in.
- Limit anonymous header actions to a single `Sign In` button.
- Preserve the supplied OIAC layout, palette, typography, logo, and hero photograph.
- Use the real Power Pages local-account and invitation-redemption flows.
- Allow registration only through a valid Power Pages invitation.
- Remove demo-role shortcuts and external identity-provider controls.
- Keep the existing authenticated member pages and navigation available after sign-in.
- Add a protected Resources page that is reachable from the footer but absent from the navbar.
- Provide accessible, responsive layouts from narrow mobile screens through wide desktop screens.

## Non-goals

- Replacing Power Pages authentication with a custom React credential form.
- Adding social, Microsoft Entra ID, or other external identity providers.
- Redesigning the signed-in member dashboard or its page content.
- Changing Dataverse tables, contact records, web-role assignments, or invitation-generation processes.
- Connecting the Resources page to Dataverse, SharePoint, or another live document source.
- Deploying the site without a separate deployment decision after local verification.

## Approved approach

Use native Power Pages authentication with a shared OIAC visual shell. React owns the anonymous landing page and the presentation switch between anonymous and authenticated experiences. Power Pages owns authentication and invitation behavior. Shared Power Pages templates and CSS theme the platform-rendered authentication pages without replacing their form submission or validation logic.

This approach was selected over DOM-heavy JavaScript reconstruction and custom React authentication because it keeps the platform security boundary intact, reduces coupling to generated markup, and still supports the required visual result.

## Authentication policy

The site configuration will enforce the following policy:

- Registration is enabled only so invited users can create accounts.
- Open registration is disabled.
- Invitation redemption is enabled.
- Local account sign-in is enabled.
- External login is disabled.
- Microsoft Entra ID login is disabled.
- The anonymous sign-in buttons navigate to the native `/SignIn` route with an encoded return URL.

The current downloaded metadata has open registration, external login, and Microsoft Entra ID login enabled. Those values must be corrected as part of implementation.

## Presentation architecture

The application shell will have two modes based on the real Power Pages user session.

### Anonymous mode

- Render the anonymous header, public hero, and anonymous footer.
- Do not render member navigation, portal shortcuts, member activity, or role cards.
- An anonymous request for a member-only route redirects to `/SignIn` and preserves the requested route as the return URL.
- Both the header and hero calls to action perform a full-page navigation to the native Power Pages sign-in page.

### Authenticated mode

- Do not render the public hero.
- Render the existing member header, full navigation, dashboard, and member routes.
- Make `/resources` available after authentication without adding it to the member navbar.
- Continue to rely on Dataverse table permissions and Power Pages web roles for authorization.
- Treat client-side route hiding as presentation behavior, not as a security boundary.

### Authentication sequence

1. An anonymous visitor opens `/` and receives the public landing experience.
2. The visitor selects either `Sign In` action.
3. Power Pages renders the native local-account sign-in page in the anonymous OIAC shell.
4. A user with an invitation can open `Register`, read the invitation-only notice, and continue to `Redeem invitation`.
5. Power Pages validates the invitation and completes its native account-creation flow.
6. After successful authentication, Power Pages returns the user to the encoded return URL.
7. The React shell detects the authenticated session and renders the existing member experience.

## Anonymous landing design

### Header

- Use `oiac-engage/public/logo.png` as the real OIAC logo.
- Show `OIAC Engage` beside the logo on layouts with sufficient horizontal space.
- Show one muted-green `Sign In` button on the opposite side.
- Do not show registration, invitation, member-navigation, or mobile-menu controls.
- Use a white background, subtle lower divider, and content width aligned with the hero.

### Hero

- Use `oiac-engage/public/MainHomeImage.jpg` as a CSS background image.
- Preserve the Figma composition with a wide, rounded image surface and generous surrounding white space.
- Place the eyebrow `WELCOME TO`, the `OIAC Engage` title, and the portal description at the upper left.
- Place the white `Sign In to Get Started →` action near the lower left.
- Keep the photograph visible continuously behind the entire hero, including the call-to-action area.
- Do not add a separate bottom panel, horizontal gradient, or solid-color block.
- A subtle left-to-right transparent overlay may sit behind the copy to maintain contrast, but it must not obscure the lower image or read as a separate region.

### Typography and color

- Continue using Source Serif 4 for the display title.
- Continue using Inter for navigation, controls, labels, and body copy.
- Use the existing restrained OIAC palette centered on muted green-gray values such as `#596e6a` and `#3d4e4b`.
- Keep page backgrounds white or near-white and borders quiet.
- Use white hero text with sufficient contrast over the image overlay.

## Native authentication pages

Sign in, registration notice, invitation redemption, and password recovery share the anonymous header and footer.

### Shared auth navigation

- Present three tabs: `Sign in`, `Register`, and `Redeem invitation`.
- Clearly identify the active tab with color, weight, and an underline or bottom border.
- Preserve semantic links and keyboard navigation.

### Sign in

- Show only username, password, `Remember me`, `Sign in`, and `Forgot your password?`.
- Do not show demo-role chips.
- Do not show external identity-provider buttons.
- Retain the native Power Pages field names, submission, password recovery, throttling, and validation behavior.

### Register

- Do not show open account-registration fields.
- Explain that registration is by invitation only.
- Link the phrase `Redeem invitation` to the native invitation-redemption state.

### Redeem invitation

- Show one required invitation-code field with a clear label and useful placeholder.
- Show one primary `Redeem` button.
- Let Power Pages validate the code and continue its native account-creation sequence.

## Footer

The same anonymous footer appears on the public landing page and all native authentication states.

- Use a thin top divider and generous white space.
- Align the footer content with the header and hero content width.
- Show the OIAC logo and `Organization of Iranian American Communities – U.S.` on the left.
- Show `oiac.org`, `Resources`, and `Contact` links on the right.
- Link `oiac.org` to <https://oiac.org/> using safe external-link behavior.
- Link `Contact` to the existing protected `/contact` route and preserve `/contact` as the sign-in return URL for anonymous users.
- Link `Resources` to the protected SPA route `/resources`. Anonymous navigation to that route redirects to `/SignIn?returnUrl=%2Fresources` and returns to `/resources` after successful authentication.
- The footer remains after the page content and never overlaps forms or validation messages.

## Protected Resources page

- Register `/resources` as an authenticated SPA route.
- Do not add Resources to the anonymous header or authenticated member navbar.
- Render the page inside the existing signed-in portal shell.
- Introduce the page with the title `Resources` and a concise description of the available training materials, guides, templates, and member information.
- Represent each local resource record with a title, short description, content or file type, and an accessible link treatment.
- Indicate whether an action opens an external destination or downloads a file.
- Keep the local resource-record boundary replaceable so a future Dataverse, SharePoint, or other document service can supply records without restructuring the page.

## Responsive behavior

### Desktop

- Use a wide hero constrained by a deliberate maximum width.
- Keep header and footer content in single aligned rows.
- Keep auth forms centered in a readable column rather than stretching across the viewport.

### Tablet

- Reduce horizontal padding while preserving the hero's rounded surface.
- Allow auth form labels and fields to use the full form-column width.
- Preserve tab visibility without compressing labels into unreadable widths.

### Mobile

- Show the compact logo and sign-in button in the anonymous header.
- Make the hero taller and crop the same source image intentionally.
- Keep the photograph continuous from top to bottom with no bottom color block.
- Keep hero text readable with the left-side transparent overlay and responsive typography.
- Keep the call-to-action directly over the photograph and provide a minimum 44-pixel touch target.
- Allow auth tabs to scroll horizontally when required.
- Stack labels above full-width form controls.
- Stack footer identity and links with clear spacing and no horizontal overflow.

## Error and edge states

- Preserve native Power Pages validation messages and submission behavior.
- Associate field errors with their controls and surface an accessible error summary when the platform provides one.
- Give invalid, expired, and already-redeemed invitation codes clear next-step guidance.
- Preserve the return URL through sign-in and invitation flows.
- If session detection fails, default to the anonymous presentation and avoid rendering member content.
- Unknown SPA routes continue to use the existing not-found experience after authentication; anonymous member-route requests go to sign-in.
- Anonymous navigation to `/resources` preserves that route as the sign-in return URL.

## Security boundaries

- Credentials and invitation codes are submitted only to native Power Pages endpoints.
- React does not store, validate, or transmit passwords.
- Invitation-only registration is enforced by Power Pages site settings, not by hiding UI alone.
- Dataverse access remains protected by table permissions and web roles.
- No secrets or environment credentials are added to source control.

## Implementation boundaries

Implementation will update only the files needed for:

- Authentication-aware React shell behavior.
- Anonymous landing, header, and footer components.
- A protected, footer-only Resources route and focused resource directory.
- Responsive theme styles and use of the supplied public assets.
- Power Pages authentication site settings.
- Shared Power Pages authentication-page styling and minimal template/content adjustments required by the approved design.
- Automated tests and accessibility checks for the new behavior.

The downloaded `.powerpages-site` metadata will be treated carefully because it represents deployed platform state. Unrelated generated metadata will not be rewritten.

## Verification

- Add tests for anonymous and authenticated shell rendering.
- Add tests for the two anonymous sign-in links and encoded return URLs.
- Add tests that anonymous visitors cannot see member navigation or dashboard content.
- Add tests for authenticated access to existing portal routes.
- Add tests confirming that `/resources` is absent from both navbars, is linked from the footer, redirects anonymous users with the correct return URL, and renders for authenticated users.
- Verify the invitation-only, local-login-only settings in Power Pages metadata.
- Run the full unit test suite and production build.
- Run the existing accessibility audit and resolve critical or serious findings.
- Capture desktop, tablet, and mobile screenshots of the local landing page.
- Confirm the hero uses one continuous photograph with no separate bottom panel or horizontal gradient block at every viewport.
- After deployment is separately approved, smoke-test native sign-in, password recovery, invitation redemption, invalid invitation handling, successful return URLs, and signed-in navigation on the real Power Pages site.

## Acceptance criteria

- Before login, the visitor sees only the anonymous header, hero, and footer.
- The anonymous header contains only the OIAC identity and a sign-in action.
- The hero closely follows the approved Figma layout and uses the supplied logo and photograph.
- The hero photograph remains continuous behind its lower call-to-action area on desktop and mobile.
- Native Power Pages local-account sign-in works without demo or external-provider controls.
- Open registration is unavailable.
- A valid invitation can be redeemed through the native Power Pages flow.
- The Register state explains invitation-only access and directs users to redemption.
- After login, the existing member portal navigation and content are available.
- The footer Resources link redirects anonymous users to sign in and returns authenticated users to `/resources`.
- The Resources page is not shown in either navbar.
- Header, hero, auth forms, and footer are responsive and keyboard accessible.
