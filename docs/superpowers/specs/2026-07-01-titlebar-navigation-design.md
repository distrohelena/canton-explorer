# Titlebar Navigation Design

## Goal

Add a small persistent titlebar to the frontend that lets users move between the two existing routes in small steps:

- dashboard at `/`
- current node detail at `/nodes/:id`

No new routes are added in this change.

## Scope

This change only adds shared navigation chrome and route-aware button behavior.

Included:

- persistent titlebar in the app shell
- `Dashboard` button that routes to `/`
- `Current Node` button that routes to the active node detail route when a node id is present
- disabled current-node button state on the dashboard
- small frontend tests for the titlebar behavior

Excluded:

- new pages
- route restructuring
- breadcrumbs
- dynamic page-title system beyond the existing static title

## Design

The titlebar will live in `frontend/src/App.vue` above `RouterView` so it is shared by both existing pages.

The titlebar will contain:

- app title text
- `Dashboard` navigation button
- `Current Node` navigation button

Route awareness will come from Vue Router state:

- when the current route is `/`, the `Dashboard` button is the active location
- when the current route is `/nodes/:id`, the `Current Node` button points at that exact node id
- when there is no current node id, the `Current Node` button is disabled instead of guessing a destination

## Behavior

### Dashboard route

- `Dashboard` navigates to `/`
- `Current Node` is disabled

### Node detail route

- `Dashboard` navigates back to `/`
- `Current Node` stays enabled and routes to the current `/nodes/:id`

## Testing

Add focused frontend tests that verify:

- the titlebar renders shared navigation controls
- the dashboard state disables the current-node button
- the node-detail state enables the current-node button for the active route

## Risks

The only meaningful risk is coupling the shared app shell to route shape. That is acceptable here because the app currently has only two routes and the titlebar is explicitly route-driven.
