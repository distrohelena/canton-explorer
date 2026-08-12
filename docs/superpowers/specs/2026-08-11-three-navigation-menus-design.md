# Three Navigation Menus

## Goal

Replace the single Explore dropdown with three distinct top-level menus so the application's destinations are easier to scan while preserving every existing route and the current hover/click interaction model.

## Information architecture

The header will expose these three sections:

- **Ledger**: Home, Updates, Contracts, Tokens, Canton Coin
- **Network**: Nodes, Parties, Traffic Purchases
- **System**: Debugger, Settings

Ledger groups the application dashboard, ledger activity, contract data, and ledger assets. Network groups participant and party views with traffic purchases. System groups developer and application configuration tools.

## Interaction behavior

- Each section has its own trigger button and dropdown.
- A trigger displays the active page title when the current route belongs to that section; otherwise it displays the section title.
- Hovering a section opens its dropdown. Moving away closes it, using the existing hover-area behavior.
- Clicking a trigger toggles that section's dropdown.
- Opening one section closes any other open section.
- Clicking outside the menus closes the open dropdown.
- Selecting a route closes the dropdown and navigates normally.
- Route changes close any open dropdown.
- Existing active-link styling, keyboard focus behavior, and accessible navigation labels remain available.

## Layout and responsive behavior

The three triggers share the existing header visual language and remain alongside the search field on desktop. Each dropdown is anchored to its own trigger. On narrow screens, the controls may wrap using the existing header responsiveness; dropdowns remain usable within the available width and retain their trigger association.

## Implementation boundaries

- Keep the existing route definitions unchanged.
- Replace the single menu state with state that identifies the open section, while keeping the existing outside-click and route-change closing behavior.
- Keep route titles centralized so active trigger labels cannot diverge from the current page names.
- Reuse the existing menu link and focus styles, adding only the layout rules needed for three sibling menus.

## Verification

Update shell tests to cover:

1. All three menu triggers render with the correct default labels.
2. Each section contains exactly its assigned routes.
3. Active route titles appear on the correct trigger.
4. Hover/click opening, switching between menus, outside closing, and route closing continue to work.
5. Existing route navigation and branding/search behavior remain unaffected.
