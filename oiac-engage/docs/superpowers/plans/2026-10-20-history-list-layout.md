# Activity Log list presentation plan

User-approved layout: Summary, Module, Action, User, Date & Time (Eastern), Details. Remove Record from the list; keep record title and precise UTC timestamp in the existing expanded Details section. Reuse global Press Coverage table styling (0.9rem body, uppercase 0.73rem headings, bordered scroll container and existing text-action style) with only history-local column widths. Do not modify shared styles or Press Coverage.

Hide the complete existing filter form with hidden plus a scoped display:none override. Preserve its implementation, current own-history default, server role checks, queries, pagination/retry and details race guards. Do not delete filtering code, change administrator default scope, log capture or backend logic.

- [x] Update existing page tests to match six columns and hidden controls, retaining programmatic coverage of dormant filter validation and details behavior.
- [x] Change only SiteActivityLog.tsx and its page-local stylesheet; details spans six columns. Keep record title/timestamp visible in expanded Details.
- [x] Run History/route/footer checks and production build in isolated source; integrate only the three reviewed paths.
- [x] Preserve fresh UAT metadata; deploy exact existing authorized UAT site only, with no backend/schema/config changes.
- [x] Verify build/metadata readback, hidden filters, exact columns, matched typography and working Details in the owned signed-in test window.

No commit requested for this new UI update. Preserve existing Git changes and generated artifacts. The user's precise screenshot/instructions authorize this presentation; no new design approval needed.
