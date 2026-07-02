# Home And Node Visual Redesign Design

## Goal

Redesign the frontend so it feels like a boutique enterprise application: business-first, premium, and credible, with roughly 30% playful character.

The redesign should separate the two existing routes clearly:

- home page for a calm overview of connected nodes and their simple state
- node detail page for in-depth investigation

No new routes or backend behavior changes are included in this phase.

## Product Intent

The current interface reads as structurally correct but visually raw. It relies on simple surfaces, limited hierarchy, and straightforward typography, which makes it feel closer to default HTML than a finished business product.

The redesign should make the app feel:

- trustworthy in front of operators and stakeholders
- intentionally designed rather than scaffolded
- slightly warm and playful without losing seriousness

The home page should optimize for calm recognition, not investigation. The node page should carry the heavier operational context.

## Information Architecture

### Home Page

The home page becomes the refined landing view.

Responsibilities:

- show which nodes are connected
- show each node’s overall state only
- make it easy to enter a node detail page

Each node card should show only:

- node name
- overall status

The home page should feel airy, composed, and fast to scan.

### Node Detail Page

The node detail page becomes the investigation workspace.

Responsibilities:

- preserve the current detailed operational information
- present diagnostics and metadata with clearer hierarchy
- feel denser and more serious than the home page

This page should not gain new data in this redesign. It should reorganize and restyle existing content.

## Visual Direction

### Overall Tone

Use a boutique enterprise aesthetic:

- premium rather than loud
- composed rather than utilitarian
- polished rather than playful-first

The playful element should come from:

- subtle color accents
- rounded but controlled geometry
- tasteful hover and reveal motion
- expressive heading typography

It should not come from novelty illustrations, exaggerated motion, or consumer-style bright palettes.

### Typography

Use a more distinctive display face for major headings and a cleaner supporting sans for labels, navigation, and operational data.

Typography should create the premium feel more than decoration does.

### Color And Surfaces

Favor a sophisticated palette:

- deep ink and charcoal foundations
- soft neutral or misted supporting tones
- one or two restrained accent colors such as muted brass, coral, or teal

Panels should feel layered and deliberate rather than flat. Surfaces should have depth through contrast, translucency, framing, or subtle gradients.

## Page-Level Design

### App Shell

`App.vue` should become the premium frame for the application.

It should provide:

- a more intentional titlebar
- stronger page framing
- shared visual rhythm between home and node detail pages

The shell should support both routes without changing navigation behavior.

### Home Page Layout

The home page should include:

- a polished header area with concise framing copy
- a grid of premium node tiles
- enough spacing for the page to breathe

The cards should feel like curated overview tiles, not generic admin widgets.

Status should remain obvious, but it should be integrated into the card composition rather than presented as the only visual treatment.

### Node Detail Layout

The node detail page should shift into a denser inspection mode.

It should:

- retain the shared visual language from the home page
- use clearer sectioning and grouping
- improve readability of structured operational information

The user should feel that they have moved from overview into workspace, not into an unrelated screen.

## Component Scope

### `frontend/src/App.vue`

Upgrade the global frame, titlebar, and route-level composition.

### `frontend/src/views/OperationsDashboardView.vue`

Reframe the home page as the elegant overview page instead of a raw operational dashboard.

### `frontend/src/components/NodeStatusCard.vue`

Redesign cards for the new home-page purpose:

- node identity
- simple state
- no dense operational metrics

### `frontend/src/views/NodeDetailView.vue`

Reorganize the existing node detail information into clearer sections and stronger hierarchy.

### `frontend/src/styles.css`

The stylesheet should be refactored around a stronger visual system:

- typography tokens
- color and surface tokens
- shell and card layouts
- responsive spacing
- restrained motion

## Motion

Motion should be subtle and purposeful:

- gentle load-in or reveal behavior
- restrained card hover response
- calm navigation transitions if needed

Motion must support quality and responsiveness, not spectacle.

## Non-Goals

This redesign does not include:

- new routes
- new backend capabilities
- new node metrics
- changes to data fetching behavior
- large information architecture changes beyond clarifying home vs. detail roles

## Testing And Verification

Verification should focus on preserving behavior while updating presentation:

- update frontend tests where markup or page structure changes
- preserve existing route behavior
- run focused frontend tests for the affected views
- run the frontend production build

## Risks

The main design risk is over-styling the app and reducing operational clarity. The redesign should bias toward readability and hierarchy first, with playfulness added as controlled accent rather than as the main identity.
