# Choice Links to Template Details

## Goal

Make a Choice shown on an update event link to the corresponding choice definition on its template detail page, and scroll directly to that choice after navigation.

## Context

Update event details already display a linked Template ID when the event includes `packageId` and `templateId`. The event Choice is currently plain text. The dedicated template page already renders all decoded choices, but its choice rows have no stable deep-link target.

## Design

### Choice link

When an update event has a non-empty `packageId`, `templateId`, and `choice`, render the Choice value as a router link to:

```text
/packages/<encoded-package-id>/templates/<encoded-template-id>#choice-<logical-choice>
```

Package and template path values must use `encodeURIComponent`. The hash contains the logical choice name after the `choice-` prefix; the router/browser serializes any characters that require URL escaping. Events missing any required identifier keep the existing plain-text value or `n/a` fallback. No additional API request is introduced.

### Template anchor and scrolling

Each rendered choice row on `TemplateDetailView` receives a deterministic ID:

```text
choice-<encoded-choice>
```

The link uses the logical choice name in the hash. Each rendered choice row receives a DOM ID from `choiceAnchorId(choice)`, which applies `encodeURIComponent()` to the choice name. Vue Router provides `route.hash` with its leading `#` and decoded content, so the view matches only hashes beginning with `#choice-`, removes the `#choice-` prefix, and compares the remaining decoded value directly to the choice name. It then derives the DOM ID with the same helper. This keeps choices containing spaces, slashes, colons, or other encoded characters addressable without double-decoding.

The view reads the route hash and, after template data has rendered, calls `scrollIntoView()` on the matching choice row. It should also respond when the hash changes while staying on the template route. A missing hash target is a no-op. The page remains fully usable when the template is unavailable or has no choices.

The hash is intentionally bookmarkable and shareable. Existing links without a hash continue to open the template page at its normal top position.

### Testing

Add frontend coverage for:

1. update-event Choice links use the encoded template route and choice hash;
2. events without identifiers retain plain text;
3. template choice rows expose stable anchor IDs, including encoded choice names;
4. a matching route hash scrolls the choice row into view after loading, including an encoded choice name;
5. missing hashes/targets and malformed percent-escape hashes do not throw or scroll unrelated content.

Unexpected or malformed hashes are treated as no-ops.

Use the existing router stubs in view tests and mock route hash/`scrollIntoView` behavior without adding browser-only dependencies.

## Scope boundaries

- No backend/API changes.
- No choice execution behavior.
- No separate choice detail route.
- No change to template choice data or schema rendering.
