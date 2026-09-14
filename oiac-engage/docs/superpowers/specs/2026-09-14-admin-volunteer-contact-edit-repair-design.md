# Admin Volunteer Contact Edit Repair Design

## Goal

Limit the administrator Contact directory to Contacts whose Job Title is exactly `Volunteer`, while preserving the existing columns and making the Contact edit modal compact, clear, and reliable in the Power Pages host. Restore District updates by correcting the Contact Web API field allowlist.

## Directory Query

Keep the existing administrator-only Contact directory and current columns: Full Name, Mobile Phone, Email, District, City, and Actions. Do not add a Job Title column.

Change the server-side OData filter from a broad `contains(jobtitle,'volunteer')` expression to `jobtitle eq 'Volunteer'`. Search remains server-side and is combined with this filter, so pagination cannot introduce non-Volunteer Contacts and only exact Volunteer records are returned.

## Web API Repair

The update payload correctly writes the District lookup through `mss_District@odata.bind`. Power Pages matches Web API allowlisted attributes literally, but the Contact fields site setting currently contains lowercase `mss_district`. Replace that entry with the exact write attribute name `mss_District` and retain `_mss_district_value` for lookup reads.

Do not broaden the allowlist to `*`, change the PATCH payload, or expand Contact permissions. The existing Administrators Contact Global Update permission remains read/write for the Administrator web role only, while Email remains read-only in the edit modal.

## Compact Edit Modal

Keep the existing accessible dialog behavior, focus trap, Escape/backdrop dismissal, validation, and save lifecycle. Improve usability without restructuring the data flow:

- Use a compact dialog width and reduced header, form, grid, and action spacing.
- Keep a two-column grid on wider screens and one column on small screens.
- Apply explicit, modal-scoped input appearance, box sizing, border, background, and focus styling with enough selector specificity to survive Power Pages and Bootstrap host styles.
- Give the Close control its own explicit layout, border, background, color, hover, focus, disabled, and SVG stroke styling so the icon is always visible.
- Keep comfortable touch targets and preserve the existing theme colors and typography.

## Testing

- Query tests prove the base and searched administrator requests use exact `jobtitle eq 'Volunteer'` filtering and no broad `contains(jobtitle,'volunteer')` predicate.
- Power Pages configuration tests prove the Contact field allowlist contains `mss_District` and `_mss_district_value`, and excludes lowercase `mss_district`.
- Modal tests and CSS regression assertions prove the compact modal classes exist, standard inputs have explicit borders, and the Close control has an explicit visible treatment.
- Run focused tests first, then the complete Vitest suite and production build.

## Deployment Boundary

This implementation updates deployable React, CSS, and Power Pages configuration source. It does not deploy or publish the site unless separately requested.
