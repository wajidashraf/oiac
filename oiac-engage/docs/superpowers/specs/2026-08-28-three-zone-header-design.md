# Three-Zone Header Design

## Goal

Restructure the authenticated OIAC Engage header into three independent desktop zones while preserving the user's current visual changes.

## Desktop structure

The header uses three columns:

- Brand: intrinsic width containing the OIAC logo and `OIAC Engage` label.
- Navigation: consumes all remaining width. Its navigation group is centered in the section and distributes the primary links with space between.
- Account: intrinsic width containing the user role badge and Sign Out control.

The outer layout is equivalent to `grid-template-columns: max-content minmax(0, 1fr) max-content`. Brand and account controls never expand to consume unused space.

## Responsive behavior

At the existing responsive breakpoint, the brand remains visible and the navigation zone becomes the Menu control. Primary links, the Activity submenu, the role badge, and Sign Out appear inside the existing responsive menu panel. The desktop three-column layout must not introduce horizontal page overflow.

## Component boundaries

`AppShell` owns the three header zones. `PortalNav` owns primary navigation and responsive menu state. Account controls are rendered as a distinct account section while remaining associated with the responsive menu on smaller screens.

## Accessibility and compatibility

- Preserve the Primary navigation label, Activity expansion semantics, current-route styling, and Sign Out destination.
- Keep keyboard focus styles and minimum touch target sizes.
- Scope header styles strongly enough that Power Pages global theme classes cannot replace the grid, link, role badge, or Sign Out presentation.

## Verification

- Component tests verify all three zones, navigation links, responsive menu behavior, role label, and Sign Out link.
- Desktop browser verification checks intrinsic brand/account columns, flexible navigation width, centered navigation content, space-between link distribution, and no overflow.
- Mobile verification checks that navigation and account controls remain available through Menu.
