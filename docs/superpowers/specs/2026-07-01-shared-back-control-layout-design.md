# Shared Back Control Layout Design

## Goal

Replace every `Back to overview` link with a circular arrow-only back control and position it to the left of the main content block instead of inside the centered content flow.

## Current State

- `NodeDetailView.vue` renders a text link labeled `Back to overview` above the page hero.
- `NodeUpdatesView.vue` renders the same text link above the page hero.
- The link currently participates in the normal vertical content flow.

## Decision

Keep the back control as a route link, but restyle and reposition it as a shared circular icon button shown to the left of the main content area.

This preserves the current navigation behavior while making the page chrome feel more like a production explorer interface and less like document text navigation.

## UI Changes

- Replace the text label with an arrow-only control.
- Render the control in a circular icon button treatment.
- Place it to the left of the primary content block on all pages that currently show `Back to overview`.
- Keep the main content block centered and independent from the back control.

## Layout Changes

- Introduce a shared outer layout wrapper for pages that need the back control.
- The wrapper should create:
  - a narrow left column for the circular back button
  - a main content column for the page body
- On narrow screens, collapse the layout back into a single column so the back control returns to the normal top flow.

## Scope

Apply the new pattern everywhere the app currently renders `Back to overview`:

- `/nodes/:id`
- `/nodes/:id/updates`

## Testing

- Update node detail view tests to assert the new arrow-only back control exists.
- Update node updates view tests to assert the same control exists there.
- Do not require pixel-level layout tests; cover layout indirectly through shared class usage and view rendering.
