# Home Dashboard Overview Y-Axis Labels Design

## Goal

Show readable vertical values on both Overview charts: Transactions over time
and CC price over time.

## Design

Both charts will render five Y-axis labels at 0%, 25%, 50%, 75%, and 100% of
the chart scale. The scale always starts at zero. Its upper bound is the
existing data-driven maximum, with a minimum upper bound of one so empty or
small values still have a usable scale. The plotted polyline and labels will
share one scale helper so they cannot drift apart.

Transaction labels will use rounded whole numbers. CC price labels will use
locale formatting with up to four decimal places. The chart's left SVG padding
will increase to make room for the labels while the existing date labels and
horizontal guides remain in place.

No API, data-loading, range-selection, or metric-card behavior will change.

## Verification

- Component tests will assert zero-based Y-axis labels for both charts.
- Existing chart, loading, and range-selection tests will continue to pass.
- The complete frontend test suite and production build will be run.
