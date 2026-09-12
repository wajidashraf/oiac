# Admin Volunteer Contact Directory Design

## Goal

Extend the existing Power Pages Contacts page so users with the exact `Administrators`
web role can view every Contact whose `jobtitle` contains `volunteer` and edit those
Contacts in an accessible modal. Users without that role retain the current
district-scoped, read-only directory.

## Authorization and security

- `App.tsx` determines administrator UI access with the existing case-insensitive
  `hasRole(session, 'Administrators')` helper and passes an `isAdmin` prop to the
  Contacts page.
- Client-side role checks only control visibility. A new Global Contact table
  permission grants `read` and `write` only to the existing `Administrators` web
  role. It grants no create, delete, append, or append-to capabilities.
- Existing non-admin Contact and District permissions remain unchanged.
- The Contact Web API field allowlist adds `address1_postalcode`; the other required
  fields are already allowed.
- The edit request never includes `emailaddress1`, `contactid`, or the derived
  `fullname` value. Email is read-only in the modal.
- Power Pages Web API table permissions do not provide per-column write restrictions.
  The read-only email requirement is therefore enforced by the application payload
  and UI for trusted administrators, not as Dataverse field-level security.

## Data model and service behavior

The admin query reads:

```text
contactid,address1_city,address1_stateorprovince,address1_postalcode,
_mss_district_value,emailaddress1,firstname,jobtitle,lastname,mobilephone
```

It filters with `contains(jobtitle,'volunteer')`, orders deterministically by last
name, first name, and Contact ID, requests formatted lookup annotations, and uses the
existing 15-record cursor pagination pattern. Admin search remains server-side and
is combined with the volunteer boundary; it searches name, email, phone, job title,
city, state/province, and postal code.

Non-admin queries retain their current district filter and data flow. The shared
Contact display type is expanded to carry first name, last name, job title,
state/province, and postal code while allowing District ID to be null for an
unassigned volunteer.

The update service accepts a normalized Contact ID and editable values. It requires
a non-empty last name, trims text values, converts empty optional text inputs to
`null`, and sends a PATCH to `/_api/contacts(<id>)`. District changes use the
validated `mss_District@odata.bind` relationship; clearing District sends the
supported null binding. Successful updates return no record content and trigger a
reload of the current directory page.

District options use the existing searchable `mss_districts` lookup service and
display `mss_number`.

## Page and modal behavior

- Administrators see the heading description “Volunteer contacts across all
  districts.” and an Actions column containing one Edit button per record.
- Non-administrators continue to see “Contacts assigned to your district.” and no
  record actions.
- The admin table keeps the existing responsive horizontal-scroll experience and
  pagination controls.
- Selecting Edit opens a modal above a dimmed backdrop without navigating away.
- Editable fields are First Name, Last Name, Job Title, Mobile Phone, City,
  State/Province, Postal Code, and District.
- Email appears in a read-only input. Contact ID and Full Name are not form fields.
- District is a searchable lookup and may be cleared.
- Last Name is required; all other editable values are optional.
- Save is disabled and relabeled while the PATCH request is active, preventing
  duplicate submissions. Close is also blocked during the active save so form state
  cannot disappear mid-request.
- A successful save closes the modal, restores focus to the Edit trigger, and
  reloads the current page. If the edited job title no longer contains `volunteer`,
  the record naturally disappears from the refreshed admin result.
- A failed save keeps the modal open and displays a non-sensitive inline error.
- The modal closes using its Close control, Escape, or a direct backdrop click when
  no save is active. It traps keyboard focus, locks background scrolling, and
  restores focus on close.

## State and error handling

The Contacts hook accepts an explicit mode derived from `isAdmin`:

- Admin mode skips the signed-in user District lookup and calls the volunteer query.
- District mode preserves the existing District lookup and query.
- Search debounce, cursor history, loading, empty, error, retry, and abort behavior
  work in both modes.
- The edit modal owns draft and save state. The page owns the selected Contact and
  reload callback.
- Directory load errors continue to use the existing Contacts error panel. Save and
  District lookup errors remain inside the modal.

## Power Pages configuration

- Add `address1_postalcode` to `Webapi/contact/fields`.
- Preserve `Webapi/contact/enabled=true` and OData filtering.
- Create `Administrators Contact Global Update` for table `contact`, Global scope,
  Administrators role ID `6ec72c3e-4f1b-420f-9565-d20047b12c1f`, with `read=true`
  and `write=true`; every other capability is false.
- Reuse the existing authenticated District read configuration for the modal lookup.
- Generate configuration YAML with the Power Pages plugin scripts and validate it
  with the schema validator.

## Testing and verification

- Service tests cover the exact volunteer filter, search composition, cursor safety,
  expanded mapping, malformed responses, safe PATCH payloads, last-name validation,
  District binding, District clearing, and email exclusion.
- Hook tests cover admin mode bypassing the user-District lookup, non-admin behavior,
  pagination/search isolation, aborts, errors, retry, and reload after a save.
- Modal tests cover initial values, read-only email, field editing, District lookup,
  validation, save locking, errors, Escape/backdrop behavior, focus trap, scroll
  locking, and focus restoration.
- Page tests verify role-specific copy, query mode, Actions visibility, edit-modal
  interaction, refreshed rows, and continued non-admin read-only behavior.
- Configuration tests verify the Contact field allowlist and administrator-only
  Global write permission.
- Final verification runs all focused tests, the complete test suite, the production
  TypeScript/Vite build, and the Power Pages schema validator.

## Out of scope

- Creating or deleting Contacts.
- Changing email addresses.
- Editing web roles or approving applicants.
- Deploying or publishing the Power Pages site without separate explicit approval.
