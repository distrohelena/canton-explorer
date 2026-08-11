# Configurable Application Branding

## Goal

Allow each runtime JSON node configuration to customize the browser application
title and the title shown in the application header independently.

## Configuration contract

Add an optional top-level `branding` object to `backend/config/nodes.*.json`:

```json
{
  "branding": {
    "applicationTitle": "My Explorer",
    "headerTitle": "My Explorer"
  }
}
```

Both fields are optional, must be non-empty strings when provided, and default
independently to `Canton Explorer`. Existing configuration files without a
`branding` object remain valid.

Values are trimmed before validation and storage, so whitespace-only values are
invalid. The endpoint returns exactly:

```json
{
  "applicationTitle": "My Explorer",
  "headerTitle": "My Explorer"
}
```

## Architecture and data flow

`NodeConfigService` owns the parsed branding values alongside the existing
configuration. A small public `GET /api/branding` endpoint returns only the
sanitized branding object; it does not expose node connection details,
credentials, or the full JSON configuration.

The frontend API client loads branding during application startup. `App.vue`
stores the result with the defaults already applied, sets `document.title` from
`applicationTitle`, and renders `headerTitle` in the existing header brand
link. The header and browser title therefore remain independently configurable
and update from the same runtime source.

If the request fails, the frontend keeps both default values so the application
still renders normally. The endpoint is served by the existing API/controller
layer and follows the current JSON response conventions.

## Testing

- Extend node configuration schema tests for absent, partial, valid, and
  invalid branding values.
- Test the branding service accessor with a parsed config and the API response,
  including that only branding fields are returned.
- Add frontend API and `App.vue` tests for independent application/header
  values, defaults, failed requests, and the browser `document.title`.
- Run the focused tests, the full test suites, type-check/build, and diff
  checks before implementation is considered complete.

## Scope

This change does not add a settings screen, live config reload, per-route title
changes, or any exposure of the full node configuration. Runtime changes still
require restarting the backend, matching the existing configuration loading
model.
