# Home Dashboard Metrics Flow Design

## Goal

Render the Network Metrics content as ordinary page flow instead of enclosing
the title and metric cards in a second parent section/card.

## Design

`HomeDashboardOverview` will keep the “Network metrics / Current snapshot”
heading and the two existing metric rectangles, but the metrics wrapper element
will be removed. The heading and metric grid will become sibling flow elements
inside the overview. The metric grid will continue to use two columns on wide
screens and one column on narrow screens.

The metric rectangles retain their individual border, radius, muted surface,
spacing, and value styling. No outer metrics border, background, padding,
radius, or shadow will remain because there will be no outer metrics wrapper.

## Verification

- The component test will assert that the removed metrics wrapper is absent.
- Existing content and data-loading assertions will continue to pass.
- The frontend test suite and build will be run after the change.
