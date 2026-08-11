# Explore Menu Hover Interaction Design

## Goal

Open the shared Explore menu when the pointer hovers over its trigger area, so desktop users can browse navigation without first clicking the menu button.

## Interaction

- Entering the complete `.app-explore` area opens the existing Vue-controlled menu immediately.
- The menu remains open while the pointer moves from the trigger into the submenu.
- Leaving the complete menu area closes the menu.
- Clicking the trigger continues to toggle the menu for touch and keyboard-oriented interaction.
- Existing outside-click closing, route-link closing, `aria-expanded`, focus styles, and selected-page label behavior remain unchanged.

## Implementation and testing

Use pointer-enter and pointer-leave handlers on the existing menu wrapper rather than duplicating the menu in CSS. Add an App regression test that dispatches a pointer-enter event and verifies the submenu opens, then dispatches pointer-leave and verifies it closes. Keep the change limited to the shared Explore menu.
