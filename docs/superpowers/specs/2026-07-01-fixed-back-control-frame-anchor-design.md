# Fixed Back Control Frame Anchor Design

## Goal

Keep the circular back control visually to the left of the page content without allowing it to reduce or influence the centered middle content width.

## Current State

- The circular arrow back control exists on node detail pages.
- The current layout uses a two-column wrapper that reserves horizontal space for the back control.
- That reserved column changes the effective width of the middle content block.

## Decision

Anchor the back control to the left edge of the app content frame using positioning, while allowing the main page content to remain centered independently.

This keeps the visual placement you want without coupling the content width to the back-control rail.

## Layout Changes

- Remove the width-reserving two-column page wrapper.
- Restore the main page content to the normal centered flow.
- Position the back control against the left side of the app content frame.
- Keep the back control outside the main content flow on wider screens.
- On narrow screens, return the control to the normal document flow.

## Scope

Apply this correction everywhere the shared circular back control currently appears:

- `/nodes/:id`
- `/nodes/:id/updates`

## Testing

- Keep the existing view tests for the arrow-only accessible back control.
- No new pixel-level layout assertions are needed.
- Verify the affected view tests still pass after the positioning change.
