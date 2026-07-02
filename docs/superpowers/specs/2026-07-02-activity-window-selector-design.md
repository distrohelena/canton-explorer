# Activity Window Selector Design

## Goal

Add a simple time-window selector beneath the activity graph area on the home page so operators can switch between `1`, `7`, and `30` day views.

## Current State

- The home page shows activity cards for connected nodes.
- Activity history is loaded through a shared `useActivityHistory()` composable.
- The backend activity response already includes a `windowMinutes` value.
- There is no user-facing control to switch the rendered history window.

## Decision

Add a shared three-button window selector beneath the graph section using `1`, `7`, and `30` as day-based presets.

The selector controls the entire home activity view, not individual cards. Changing the selection reloads the shared activity-history request and rerenders every graph from the new window.

## Frontend Design

### Placement

- Place the selector beneath the graph area on the home page.
- Keep it visually compact and secondary to the graph cards.
- The selector should be clearly associated with the full activity section rather than any single node card.

### Interaction

- Render exactly three buttons:
  - `1`
  - `7`
  - `30`
- Only one button can be active at a time.
- The selected button represents the number of days shown in the activity graphs.
- Clicking a different button:
  - updates the selected window
  - reloads activity history for that window
  - rerenders the cards using the returned data

### State Model

- Default to the current short window on first load by mapping it to the nearest supported preset.
- Preserve the active selection in component state, not in the URL, for this slice.
- Reuse the existing loading and error handling from the activity-history flow.

## Data Flow

1. Home activity view keeps a selected day window.
2. That window is passed into the shared activity-history fetch path.
3. The API request includes the selected window.
4. The backend returns activity samples for that period.
5. The view rerenders all cards using the new history payload.

## Backend Design

- Support a window parameter on the activity-history endpoint if it is not already present.
- Interpret the selector values as day windows:
  - `1`
  - `7`
  - `30`
- Convert the chosen day window into the sample window used by the cached activity-history path.
- Keep the response shape stable aside from the returned `windowMinutes` reflecting the selected range.

## Error Behavior

- If a windowed activity-history request fails, keep the existing section-level error message behavior.
- Do not leave multiple buttons active during loading.
- Invalid or unsupported window values should fall back to the default backend-supported window rather than crashing the view.

## Testing

### Frontend

- Verify the selector renders with `1`, `7`, and `30`.
- Verify one button is active at a time.
- Verify clicking a button triggers a new activity-history request with the selected window.
- Verify the cards rerender from the new response.

### Backend

- Verify the activity-history endpoint accepts the selected window.
- Verify supported windows return a valid response with matching `windowMinutes`.
- Verify unsupported values fall back safely.

## Out of Scope

- Per-card window controls
- Persisting the selected window in local storage or the URL
- Free-form date ranges
- Adding extra presets beyond `1`, `7`, and `30`
