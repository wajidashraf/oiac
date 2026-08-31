# Contact District and Events Fresh Data Design

## Goal

Show each Contact's Dataverse District lookup label in the Contacts table and ensure the Events page reads current Dataverse Event rows for both Volunteer and Administrator audiences.

## Confirmed causes

- The Contacts query selects `_mss_district_value`, but the UI renders `address1_stateorprovince`. The District lookup's formatted label is never requested or mapped.
- The Events endpoints use the correct Dataverse entity set, `mss_eventses`, and their audience filters are correct. The supplied records include five future Published or Registration Open events, while the administrator query has no filter, so a successful empty response is not explained by application filtering.
- Power Pages exposes a `skipCache` argument on `RetrieveMultipleRecords`. The Event reads currently use the cached overload, allowing an earlier empty result to persist until the site cache refreshes.

## Contact behavior

- Request `OData.Community.Display.V1.FormattedValue` annotations with each paged Contacts Web API request.
- Map `_mss_district_value@OData.Community.Display.V1.FormattedValue` to `districtName`.
- Rename the table header from **State / Province** to **District** and display `districtName`.
- Render an em dash when Dataverse does not return a District label.
- Remove State / Province from the visible search hint and server search fields because it is no longer displayed. Every result remains restricted to the signed-in user's District.
- Preserve the current District GUID filter, pagination, loading, empty, and error behavior.

## Events behavior

- Preserve endpoint and permission boundaries:
  - `open-events`: Volunteer users receive only future Published (`866530001`) and Registration Open (`866530002`) events.
  - `admin-events`: Administrators receive every Event, regardless of status or date.
  - `calendar-events`: My Calendar remains limited to the signed-in Contact's Registered rows and eligible future event statuses.
- Pass `true` as `skipCache` on all paginated Event and Event Registration reads used by these endpoints, including continuation requests.
- Preserve normalized response shapes and existing frontend integration.
- Do not broaden roles, table permissions, or Web API access.

## Verification

- Contact service tests prove formatted District annotation mapping and request headers.
- Contact page tests prove the District heading/value and revised search hint.
- Server logic tests prove every paginated Dataverse read opts out of stale cache while preserving filters, role boundaries, and continuation handling.
- Run focused tests, the full Vitest suite, and the production build.
- Deployment and site-cache restart remain separate, explicit operations after local verification.
