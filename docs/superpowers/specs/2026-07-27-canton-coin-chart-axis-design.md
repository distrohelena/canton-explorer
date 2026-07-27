# Canton Coin Chart Y-Axis Design

## Goal

Make the Canton Coin price lines quantitatively readable by adding a visible
vertical price scale. The scale must always start at zero so the visual height
of the lines is comparable to the full price range.

## Design

- Calculate the chart display domain from zero to the highest finite,
  non-negative close in the currently selected range. If the maximum is zero,
  keep the entire domain at zero and render all points on the baseline.
- If the selected range has no finite, non-negative closes, treat it as having
  no chart data and show the existing empty-range state.
- Generate five evenly spaced tick values at 0%, 25%, 50%, 75%, and 100% of the
  display maximum. For the current providers, all visible series use USDT; the
  labels include that shared quote when one quote is present, and use a neutral
  numeric label if mixed quotes are ever returned.
- For a zero maximum, collapse the duplicate zero ticks and guides into one
  baseline tick at the bottom of the plot.
- Render the tick labels and matching horizontal guides inside the existing SVG,
  including the zero baseline and the maximum guide.
- Reserve a 72px left-side label gutter, an 8px right gutter, and 12px vertical
  gutters. Map the series plot into that rectangle so labels do not overlap the
  lines.
- Reuse the existing price formatter for tick labels and use deterministic
  tick-to-Y mapping for both labels and guides.
- The current public providers are both USDT, so the chart intentionally uses a
  shared raw numeric axis. Mixed quote currencies are accepted as an explicitly
  unsupported data condition for this view; labels omit a quote when the visible
  data is mixed rather than implying a conversion.
- Keep the existing range controls, venue series, median series, and accessible
  chart label unchanged.

## Testing

- Unit-test tick generation for zero-based domains, a zero maximum with one
  baseline tick, and deterministic tick-to-Y mapping.
- Unit-test plot geometry offsets while preserving existing one-point and
  constant-series behavior.
- Verify the view renders the expected zero-based Y-axis labels and guides while
  retaining the chart and range-control behavior. Assert numeric tick values or
  data attributes rather than locale-sensitive formatted strings.
