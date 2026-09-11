# Form Control Font Weight Design

## Goal

Ensure entered and selected values use normal font weight in every form across the application. Keep labels, headings, buttons, radio-card labels, lookup results, and other interface text unchanged.

## Current State

The shared theme applies inherited typography to buttons and form controls. Several form-specific rules explicitly set controls to normal weight, while other controls rely on inheritance. This creates inconsistent value weight between forms, including the multistep meeting report form.

## Design

Add a shared theme rule that sets `font-weight: 400` on `input`, `textarea`, and `select` elements. The rule will apply to control values throughout the application, including meeting reports, contact forms, events, appointments, activity logs, press coverage, search fields, and profile forms.

The change will not alter label or action typography. Checkbox and radio controls contain no rendered text value, so the shared declaration is harmless for those input types. Existing form-specific normal-weight declarations may remain because they are consistent with the shared rule.

## Behavior and Data Flow

This is a presentation-only change. Form state, validation, submission, accessibility attributes, and backend payloads remain unchanged.

## Error Handling

No error-handling changes are required because the change introduces no new runtime behavior or data operations.

## Testing

Extend the existing stylesheet regression tests with an assertion that the shared `input`, `textarea`, and `select` rule declares normal font weight. First run the focused test to confirm it fails before the stylesheet change, then add the CSS rule and confirm the test passes. Finally run the complete test suite and production build.

## Acceptance Criteria

- Entered text in all text-like inputs uses `font-weight: 400`.
- Textarea values use `font-weight: 400`.
- Selected values displayed by select controls use `font-weight: 400`.
- Field labels, headings, buttons, radio-card labels, and lookup result text retain their existing weights.
- Existing form behavior and tests remain intact.
