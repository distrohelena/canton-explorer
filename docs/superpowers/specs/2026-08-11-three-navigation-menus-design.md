# Three Navigation Menus

## Goal

Replace the single Explore dropdown with three distinct top-level menus so the application's destinations are easier to scan while preserving every existing route and the current hover/click interaction model.

## Information architecture

The header will expose these three sections:

- **Ledger**: Home, Updates, Contracts, Tokens, Canton Coin
- **Network**: Nodes, Parties, Traffic Purchases
- **System**: Debugger, Settings

Ledger groups the application dashboard, ledger activity, contract data, and ledger assets. Network groups participant and party views with traffic purchases. System groups developer and application configuration tools.

Route ownership follows the content represented by the destination, including
detail routes:

- **Ledger** owns `/`, `/updates`, `/contracts`, `/tokens`, and
  `/canton-coin`, plus token/contract/package/namespace detail routes,
  `/tx/*`, `/search`, and node-linked update or contract detail routes.
- **Network** owns `/nodes`, `/parties`, and `/traffic`, including node and
  party detail routes.
- **System** owns `/debugger` and `/settings`.

Detail routes use their parent page title for the trigger: update details show
Updates, contract/package/namespace details show Contracts, token details show
Tokens, node details show Nodes, and party details show Parties. Search shows
Search on the Ledger trigger even though it is reached through the header
search field rather than a menu link. Legacy transaction routes show Updates.

## Interaction behavior

- Each section has its own trigger button and dropdown.
- A trigger displays the active page title when the current route belongs to that section; otherwise it displays the section title.
- Hovering a section opens its dropdown. Moving away closes it, using the existing hover-area behavior.
- Clicking a trigger toggles that section's dropdown; this is the primary touch interaction.
- Opening one section closes any other open section.
- Clicking outside the menus closes the open dropdown.
- Selecting a route closes the dropdown and navigates normally.
- Route changes close any open dropdown.
- Native button behavior supports Enter and Space. When a menu is open, Escape
  closes it and restores focus to its trigger. Tab proceeds from the triggers
  left-to-right and then through the links in the open menu. Focus alone does
  not open a menu, so keyboard navigation is not coupled to pointer hover.
- Each trigger has a unique `aria-controls` value and accurate
  `aria-expanded` state. Each dropdown is a labelled `nav`; links retain
  visible focus outlines and active-route styling.

## Layout and responsive behavior

The three triggers share the existing header visual language and remain
alongside the search field on desktop. At widths above the existing 720px
mobile breakpoint, the triggers flex evenly within the toolbar, with a
110px minimum and 160px maximum per trigger; dropdowns are at least 190px wide
and anchored to their own trigger. The search and theme controls retain their
current priority, so the menu triggers may shrink within those bounds before
the header wraps.

At or below 720px, the toolbar stacks vertically, each trigger spans the
available toolbar width, and its dropdown is left-aligned with a maximum width
of `calc(100vw - 36px)` to prevent viewport overflow. The three menus remain
separate controls rather than merging into one mobile menu.

## Implementation boundaries

- Keep the existing route definitions unchanged.
- Add a canonical navigation definition module containing the three menu
  definitions, their links, and ordered route matchers for section ownership
  and display titles. Matchers must be evaluated from most specific to least
  specific so node-linked contract/update details are classified correctly.
- Replace the single menu state with state that identifies the open section,
  while keeping the existing outside-click and route-change closing behavior.
- Render the three menu controls from the canonical definitions so labels,
  links, IDs, and route ownership cannot diverge.
- Reuse the existing menu link and focus styles, adding only the layout rules needed for three sibling menus.

## Verification

Update shell tests to cover:

1. All three menu triggers render with the correct default labels.
2. Each section contains exactly its assigned direct menu links, while deep and
   utility routes resolve to the documented parent section and title.
3. Home is present in Ledger and all existing direct destinations remain
   available.
4. Active route titles appear on the correct trigger for root, list, detail,
   legacy transaction, package, namespace, and search routes.
5. Hover/click opening, switching between menus, outside closing, route
   closing, Escape dismissal, focus restoration, and Enter/Space activation
   continue to work.
6. ARIA controls/expanded state and navigation labels are unique and correct.
7. Desktop sizing/anchoring and the <=720px stacked layout do not overflow.
8. Existing route navigation and branding/search behavior remain unaffected.
