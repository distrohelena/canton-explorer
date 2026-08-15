# Chart hover tooltips and point markers

## Goal

Make every line chart reveal exact values on hover and visually identify the
selected data point.

## Scope

Apply the interaction to the two Home dashboard charts, node activity history
charts, and the Canton Coin price chart. Existing SVG rendering and chart
data/loading behavior remain unchanged.

## Interaction

- Pointer movement inside a chart selects the nearest plotted timestamp.
- A tooltip is positioned at the pointer and constrained to the chart shell.
  It contains the formatted timestamp and the exact formatted value.
- Leaving the chart clears the tooltip and markers.
- Single-series charts render one circle at the selected point.
- The Canton Coin chart resolves the nearest day across its displayed series,
  renders a circle on every available series value for that day, and lists
  each series' exact price in one tooltip.

## Architecture

A small shared frontend composable owns pointer-to-plot coordinate conversion,
nearest-point selection, and tooltip placement. Each chart supplies its own
ordered series and formatting functions, then keeps rendering-specific SVG
paths, circles, and markup local. This avoids a chart-library dependency and
prevents duplicated selection math without restructuring existing views.

## Accessibility and testing

Charts retain their descriptive SVG labels. Tests use controlled SVG bounds
and pointer events to verify nearest-point selection, tooltip content,
marker circles, multi-series values, and clearing on pointer leave.
