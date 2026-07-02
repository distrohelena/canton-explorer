# Activity Home And Nodes Page Design

## Goal

Restructure the frontend so:

- `/` becomes an activity-overview home page
- `/nodes` becomes the connected-nodes page
- `/nodes/:id` remains the detailed node page

The home page should show a per-node activity history graph, backed by cached backend data rather than direct frontend-side PQS querying.

## Product Intent

The current home page is still serving as the connected-nodes overview. The new direction is more explorer-like:

- home page acts as the high-level activity landing screen
- nodes page becomes the place to browse connected nodes
- detail page remains the place to investigate a single node

This aligns the route structure more closely with explorer products, where the landing page emphasizes network activity rather than a card grid of entities.

## Route Structure

### `/`

The root route becomes the activity-overview page.

Responsibilities:

- present a multi-series activity history graph
- give a quick sense of recent node activity
- act as the first page users land on

This page should not show the connected-node cards anymore.

### `/nodes`

This route becomes the connected-nodes overview page.

Responsibilities:

- show the connected nodes
- show simple per-node state
- provide entry to `/nodes/:id`

The existing simplified node-card concept belongs here.

### `/nodes/:id`

This route remains the in-depth node page.

Responsibilities:

- preserve the grouped operational detail view
- continue using the existing fetched node snapshot data

## Backend Architecture

### History Storage

The backend should maintain a small rolling in-memory history store alongside the existing latest-node snapshot cache.

Each sample should be lightweight and normalized, with at least:

- timestamp
- node id
- activity value

The store only needs to support the recent time window required by the home page.

### Sampling Model

The existing polling flow should append one activity sample per node on each successful refresh.

This keeps history generation aligned with the already-established backend polling lifecycle and avoids extra frontend-triggered PQS load.

### History API

Expose a new backend endpoint that returns grouped activity-history series by node id.

The response should be simple for frontend rendering, with a clearly named metric rather than an implied one.

## Activity Metric

For v1, the metric should stay simple and stable.

The design intent is to use a lightweight count-derived value from PQS-backed data that can be sampled cheaply and interpreted consistently.

Examples of acceptable v1 approaches:

- change in active-contract count between samples
- another simple count-based derived activity measure

The exact metric can be finalized during implementation planning, but the key requirement is:

- low overhead
- stable semantics
- easy backend caching
- easy frontend explanation

## Frontend Architecture

### Home Activity View

Create a dedicated home page view for activity history.

Responsibilities:

- fetch the cached history API
- render a compact multi-series graph with one series per node
- preserve the current explorer-like shell and product framing

The graph should prioritize readability over visual novelty.

### Nodes Overview Page

Move the connected-node card grid into a dedicated nodes page.

Responsibilities:

- reuse the current node-overview data source
- preserve simple node cards showing node name and state
- keep the search control and refresh affordances if they still fit the page

### Navigation

The top navigation should include:

- `Home`
- `Nodes`

This makes the route split explicit and discoverable.

## Testing

### Backend

Add focused tests for:

- history accumulation in the backend cache/store
- history endpoint response shape

### Frontend

Add or update tests for:

- new route structure
- home activity view rendering
- nodes page rendering
- existing node detail rendering

### Verification

Verification should include:

- focused backend tests
- focused frontend tests
- frontend build

## Non-Goals

This change does not include:

- direct PQS access from the frontend
- persistent database storage for history
- advanced chart interactions
- backend search behavior for the visual-only search box

## Risks

The main risk is choosing an activity metric that is too expensive or too semantically ambiguous. The implementation should therefore bias toward a cheap, explicit, backend-sampled metric even if it is less ambitious than a full historical query model.
