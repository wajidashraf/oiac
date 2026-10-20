# Activity Channel design

Status: design and proposed Test/UAT configuration changes approved by the user on 17 October 2026. Implementation and verification are in progress.

## Scope and existing application

Implement the supplied Activity Channel requirements and screenshots in the existing React 19/TypeScript Power Pages SPA. Reuse routing, AppShell, theme tokens, authenticated Contact session and CSRF-aware `powerPagesFetch`. Add no external dependencies or external messaging/integrations. Preserve Events/Join Event, Appointments, My Calendar, Press Coverage, Contacts, Meeting Reports, registration/profile processing and existing unrelated work.

The existing Activity Log is an unrouted, local-state outreach prototype. It is not a Dataverse community feed and must not supply records to the new feature. Production feed data comes exclusively from Dataverse. Controlled test fixtures remain separate from application runtime data.

Target for the proposed configuration is the established Test/UAT environment `16838866-275a-e2e7-838f-57313f30a416`, `https://org97063a46.crm.dynamics.com`, site `e7f400bd-1e04-4efa-b8b3-7a7a3b168662`, solution `CRMSolution`. No Production changes or site restart are included.

## Verified schema, 17 October 2026

Read-only metadata confirmed both tables already exist and support optimistic concurrency. No duplicate table or column will be created.

| Purpose | Actual post column | Actual comment column |
|---|---|---|
| Logical table | `mss_activitypost` | `mss_activitycomment` |
| Entity set | `mss_activityposts` | `mss_activitycomments` |
| Primary ID | `mss_activitypostid` | `mss_activitycommentid` |
| Internal primary name | `mss_activityname`, String 850 | `mss_commentname`, String 850 |
| Body | `mss_content`, Memo 8,000 | `mss_commenttext`, Memo currently 100 |
| Author Contact | `mss_author`, navigation `mss_Author` | `mss_author`, navigation `mss_Author` |
| Post anchor | — | `mss_activitypost`, navigation `mss_ActivityPost` |
| Parent comment | — | `mss_parentcomment`, navigation `mss_ParentComment` |
| Pinned fields | `mss_ispinned`, `mss_pinnedon`, `mss_pinnedby` / `mss_PinnedBy` | — |
| Timestamps | standard `createdon`, `modifiedon` | standard `createdon`, `modifiedon` |
| Concurrency | `versionnumber` / SDK RowVersion | supported; comments have no edit operation |

`mss_name`, comment `mss_content` and comment `mss_post` from the requested conceptual model are not the actual columns. Use the verified existing columns above. The additional comment columns `mss_createdon` and `mss_modifiedon` are not used as authoritative timestamps.

The Post→Comment relationship is `mss_activitycomment_ActivityPost_mss_activitypost`, metadata ID `5b11d577-b0c9-f111-a05a-70a8a5b30c17`. Its Delete behavior is currently **RemoveLink**, which detaches comments when a post is deleted. It is unmanaged and customizable. The Comment→Parent Comment relationship also uses RemoveLink.

Read-only site inspection found no existing site components referencing either Activity table. The existing table privilege is `prvReadmss_ActivityPost`.

## Proposed configuration and alternatives

Recommended:

1. Increase the existing `mss_activitycomment.mss_commenttext` maximum from 100 to **8,000** characters, matching post text and allowing normal discussions. Existing content is retained; no new field is added. Client/server character limits agree with read-back metadata.
2. Change only the existing Post→Comment relationship's Delete behavior from **RemoveLink to Cascade**. Preserve its other cascade settings and the self-parent relationship. Every new root comment and every nested reply retains the same post anchor, so native post deletion includes its entire conversation. This also affects future deletions of these posts from Dataverse tools; changing the metadata itself deletes no current records.
3. Register a separate signed Sandbox `Oiac.Engage.ActivityChannel` assembly and `mss_ActivityChannelCommand` Custom API, with the existing site's trusted ServerLogic bridge. Do not modify the Appointments or Press Coverage assemblies/actions.
4. Add authenticated Read-only table permissions for the two Activity tables, one authenticated `activity-channel` ServerLogic endpoint, and disable direct Web API access to both Activity tables. Do not grant ordinary portal users direct table Create/Write/Delete/Append rights. Existing permissions, settings and roles remain intact.

Alternative for deletion: retain RemoveLink and implement custom transactional server cleanup. This avoids changing the relationship's deletion policy but requires more deletion, failure and concurrent-comment handling code. Native cascade is recommended for this explicit post-and-conversation deletion requirement.

Alternative for comment length: retain the existing 100-character limit and expose it in the form. All other features can still be implemented, but longer replies cannot be stored. Enlarging the existing memo is recommended.

No production/schema mutation will occur before the user approves the proposed Test/UAT changes. Publish only the affected Activity entities and include their changed components in the existing solution. Capture metadata before/after and guard repeat execution against unexpected schema differences.

## Navigation and authenticated access

- Main Activity menu contains exactly **Activity Channel**, **Events**, **Appointments**, in that order. Only the first destination changes to `/activity/channel`.
- Preserve `/activity/events`, `/activity/appointments` and the current `/activity` redirect. Redirect legacy `/activity/activity-log` bookmarks to the new channel without adding another menu item.
- Update the existing Activity Home shortcut and volunteer destination that currently reference the obsolete route. Preserve other links and dropdown behavior.
- All authenticated portal Contacts may read, post, comment and reply, including users awaiting a functional-role approval. Preserve the registration/profile gate. Add a narrow Activity Channel exception to the existing role gate and an entry from the pending-approval page; do not unlock unrelated routes. The channel uses the existing app header/footer/theme.
- Anonymous users receive no Activity feed or author data from the page or endpoint.

## Server identity and authorization

The browser calls only `/_api/serverlogics/activity-channel`. The endpoint obtains ActorContactId from trusted `Server.User`, using the hosted lowercase `contactid` compatibility already proven in this site. It rejects anonymous/invalid identity and never accepts browser author, pinned-by, pin timestamp, administrator, owner or arbitrary query/URL fields.

The bridge invokes only the fixed `mss_ActivityChannelCommand` action. Its contract follows the existing proven integration: ActorContactId Guid, Command String, Payload String; Result String containing sanitized JSON. It runs under `context.UserId`, never SYSTEM, and requires the existing Activity Post read privilege. The underlying authenticated Dataverse integration caller is the trusted boundary, as in the existing Appointments action; a portal browser receives no privileged Dataverse credential or selectable actor parameter.

The action independently verifies an active, login-enabled Contact with a portal identity. All such Contacts can participate without a functional-role requirement. Administrator moderation checks the existing exact Administrators web-role ID `6ec72c3e-4f1b-420f-9565-d20047b12c1f` and this site ID from current Dataverse membership. Browser role claims only affect presentation.

| Operation | Required authorization / validation |
|---|---|
| Feed/comment reads | Authenticated eligible Contact; active visible records only |
| Create post | Actor stamped as Author, generated internal name, pinned false, no caller-selected pin fields |
| Create root comment | Existing active post; actor stamped as Author; parent null |
| Create reply | Existing active post and parent; parent/ancestor post anchors match; no invalid or cyclic ancestry |
| Pin / unpin | Actual site Administrator; current post/version; server timestamp and actor only |
| Remove post | Original Author or site Administrator; current post/version; native dependent-record cleanup |

Post reads return only necessary text, author display fields, dates, pin state, version and authorized action flags. Contact display uses only ID, fullname and actual jobtitle if present. Avatars use initials, consistent with the current app; do not fabricate member titles or use sample users. Missing/deleted Contacts display an honest unknown-author fallback.

## Feed and discussion data flow

- Pinned posts sort by pinned-on descending, then created-on and ID for stable ties. Regular posts sort by created-on descending and ID. Use separately filtered pinned and regular streams so stale pin metadata on an unpinned imported row cannot affect its regular ordering.
- Bound each stream page to 20 records. Finish pinned pages before regular pages; a transition page may include the remaining pinned records and one regular page, at most 40 records. Subsequent regular pages use the same page size to avoid skips. Refresh the feed from its beginning after moderation; deduplicate appended records by ID.
- Count visible posts with a Dataverse aggregate, independently of comments and loaded pages. Detect native aggregate limits/errors; display an honest count-loading/error state with retry rather than a fabricated or capped total. Do not download every post body to count them.
- Batch initial comments for the visible post IDs, at most 40 IDs and 100 rows per page, ordered chronologically with ID ties. Additional per-post comment pages load on demand. Merge by ID, preserve drafts, and update only the affected discussion after a successful comment/reply.
- Each reply stores both the original post anchor and its immediate parent, including replies to replies. Validate parent ancestry on the server with bounded traversal, reject cycles and cross-post chains, and generate the new comment ID independently of the parent. Parent/author relationships are immutable through this endpoint because there is no comment-edit command.
- Render the true logical relationship with visual indentation capped for small screens. Handle partial pages, missing legacy parents, cycles and malformed imported data without infinite recursion or silently treating a reply as a new root. Provide a way to load missing earlier context.
- Prevent duplicate submissions with immediate per-operation locks. Use stable request identifiers and server-side actor-scoped create replay checks, or the site's established uncertain-save recovery, so transport failure is not treated as proof that a write did not happen. Preserve drafts on failure; do not silently retry as a new record.
- Use standard Dataverse `createdon`; never client-generated creation dates or the custom similarly named columns. Show Just now/Today/Yesterday/dated labels in **America/New_York**, consistent with existing Home meeting/Appointments display. Provide full date/time in semantic `<time>` metadata.

## UI and interactions

Use the supplied screenshot layout: existing page back link/title/subtitle; narrower centered feed column; collapsed Create Activity card; inline expanded composer with initials, Cancel, textarea, visibility message and Post Activity; Community feed heading with accent rule and actual count; white bordered cards; muted green controls; pinned header strip/icon; author metadata; shaded comment area; indented replies and vertical connector; inline comment controls.

Pin/Unpin belongs in the card's upper-right action area for administrators. A subtle Delete action is shown only for the original author or administrator. Delete opens an accessible confirmation dialog with the supplied permanent-delete warning and Delete/Cancel actions; focus and keyboard behavior follow existing modal patterns. Cancel performs no deletion.

Preserve paragraphs and render user text as text nodes. Linkify only validated HTTP/HTTPS URLs with safe new-tab attributes; never render submitted HTML or script. Comment/reply forms clearly identify their target and have independent drafts/cancel controls. Busy states lock conflicting operations; errors retain input and offer useful retries. Successful actions refresh the relevant feed/thread/count and show an accessible notification.

Scope CSS to the Activity Channel and reuse the existing theme variables, buttons and typography. Adapt controls and cap visual reply indentation on mobile; prevent horizontal overflow. Do not change global theme rules or rebuild the SPA.

## Verification and delivery

Before implementation, preserve snapshots of the existing dirty workspace and verify the final schema mapping. Use test-first implementation for authorization, writes, moderation, parent validation, native delete request/version behavior, bounded reads/counts/sorting, transport/error contracts and meaningful UI interactions.

Test navigation order/routes/active state and pending/anonymous behavior. Test post, comment, multiple replies, replies-to-replies, partial/malformed threads, duplicate clicks, failure preservation, safe links/XSS, pin/unpin ordering and own/admin deletion. Include unauthorized direct endpoint and table routes, forged authors/pinned fields, non-owner deletion and cross-post/cyclic parent rejection.

Run the full existing regression suite and production build. Perform source/security review and scoped browser checks at 1440/820/390, including accessibility and screenshots compared with the supplied references. Preserve all current module behavior and config files apart from the explicit additions.

Use User A, User B and Administrator sessions for hosted acceptance when the user supplies those signed-in sessions; do not impersonate Contacts or manufacture multi-user login evidence. Test only uniquely named records created for verification, verify persisted authors/parents/timestamps, and delete only that run's records through the authorized mechanism. An unavailable real-user session is an explicit testing limitation, never a claimed pass.

Deployment remains Test/UAT only, following the existing approved target and fresh code-site backup/read-back process. Preserve all existing site metadata, restore the original PAC profile and perform no restart. No existing business post is deleted as a test. Deliver the implementation summary, changed files, actual schema manifest, operation/security contracts, cleanup behavior, test evidence and remaining manual acceptance limits.

## Reference checks

- Metadata evidence: ignored `.superpowers/activity-channel/metadata/`; no record writes or schema changes during review.
- [Microsoft Server objects and fixed Custom API invocation](https://learn.microsoft.com/power-pages/configure/server-objects).
- [Microsoft relationship cascade behavior](https://learn.microsoft.com/power-apps/developer/data-platform/configure-entity-relationship-cascading-behavior).
- [Microsoft FetchXML aggregates and native count limit](https://learn.microsoft.com/power-apps/developer/data-platform/fetchxml/aggregate-data).

## Review checklist

- [x] Read the complete user prompt and screenshots.
- [x] Review current routing, prototype, theme, auth/role gate, shared API and prior secure server pattern.
- [x] Verify actual tables, columns, text limits, lookups, concurrency, cascade behavior and existing site references.
- [x] Propose the smallest configuration changes and deletion/length alternatives.
- [x] Self-review for scope, actual mappings, identity boundaries, delete semantics and explicit test limitations.
- [x] User approval of this design and the proposed Test/UAT configuration changes.
- [ ] Write the implementation plan, then implement and verify the approved scope.
