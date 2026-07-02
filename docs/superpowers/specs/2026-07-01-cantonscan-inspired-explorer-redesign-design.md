# Cantonscan-Inspired Explorer Redesign Design

## Goal

Redesign the frontend so it looks like a production blockchain explorer application, closer in spirit to CantonScan and similar explorer products, rather than like a decorative or AI-generated marketing interface.

The redesign should keep the current route structure and product scope:

- home page shows connected nodes and their simple state
- node detail page shows in-depth operational information

No backend changes or new routes are included.

## Product Intent

The current redesign direction overshot into a boutique visual language. It introduced stylistic choices that weaken production credibility for this product category:

- expressive serif typography
- dramatic atmospheric framing
- decorative shell treatment

The target is now more specific:

- production-grade explorer UI
- practical and credible
- clean, data-product oriented
- only lightly branded or playful

This should feel closer to CantonScan than to a portfolio-style dashboard.

## Reference Direction

The key qualities to borrow from explorer-style products such as CantonScan:

- clean sans-serif typography
- lighter neutral surfaces
- sharp hierarchy and compact spacing
- obvious product chrome
- modular section cards
- stronger scanability than ornament

The goal is not to copy exact layout or branding, but to align with the same product language.

## Information Architecture

### Home Page

The home page remains intentionally simple.

Responsibilities:

- show which nodes are connected
- show their overall status only
- provide straightforward entry into node detail pages

Each node card should show only:

- node name
- overall state

The page should feel like an explorer landing screen, not an executive dashboard and not a marketing hero.

### Node Detail Page

The node detail page remains the deeper operational view.

Responsibilities:

- preserve current operational facts
- group them into practical explorer-style sections
- improve scanability and credibility

This page should feel denser and more utilitarian than the home page, while still clean and polished.

## Visual Direction

### Overall Tone

Use an explorer-inspired application language:

- light or light-neutral surfaces
- compact and practical layout
- restrained accent color
- minimal decorative flourish

Playfulness should drop significantly from the earlier direction. It should be present only as mild warmth in spacing, corner radii, or accent choices.

### Typography

Use a clean product sans stack only.

Requirements:

- no serif display typography
- strong readability for headings and metadata
- credible monitoring-product feel

Typography should support trust and clarity, not stylistic expressiveness.

### Color And Surfaces

Use:

- pale neutral or lightly tinted page background
- white or near-white content cards
- subtle borders and restrained shadows
- one modest accent color for status or interaction emphasis

Avoid:

- dramatic gradients
- dark cinematic framing
- oversized translucent panels
- ornamental visual effects

## Page-Level Design

### App Shell

`App.vue` should become a compact explorer header and content frame.

It should provide:

- practical top navigation
- clear product title or brand label
- centered content container
- obvious, production-like page framing

The shell should feel like application chrome, not hero presentation.

### Home Page Layout

The home page should include:

- compact page heading such as `Connected Nodes`
- short functional subtext if needed
- uniform grid of dependable node cards

The cards should be:

- consistent in size
- visually clean
- clearly clickable
- status-forward without showing dense metrics

### Node Detail Layout

The node detail page should use structured explorer-style blocks:

- practical title row
- clear status placement
- grouped sections such as service health and ledger snapshot
- labeled values that are easy to scan quickly

The page should read like a product detail screen, not a stylized showcase panel.

## Component Scope

### `frontend/src/App.vue`

Replace the current premium shell with a compact explorer-style header and container.

### `frontend/src/styles.css`

Refactor the visual system toward:

- clean sans typography
- neutral backgrounds
- card and section borders
- tighter spacing
- lighter shadows
- practical interaction states

### `frontend/src/views/OperationsDashboardView.vue`

Simplify the home page into a concise explorer overview.

### `frontend/src/components/NodeStatusCard.vue`

Keep the simplified purpose:

- node name
- state only

But restyle it into a cleaner, production explorer tile.

### `frontend/src/views/NodeDetailView.vue`

Keep the grouped detail structure but restyle it away from the boutique shell and toward a practical explorer section layout.

## Non-Goals

This redesign does not include:

- new routes
- search
- new metrics
- backend changes
- copying CantonScan directly

## Testing And Verification

Verification should continue to focus on behavior-preserving frontend checks:

- update focused frontend tests if structure changes
- preserve route behavior
- run the affected frontend tests
- run the frontend build

## Risks

The main risk is landing in a halfway state that still looks stylized but not convincingly product-grade. The redesign should therefore favor conventional explorer UI patterns over originality when the two conflict.
