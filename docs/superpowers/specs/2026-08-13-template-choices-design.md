# Template Choices on the Template Detail Page

## Goal

Show every choice defined by a DAML template on its dedicated template page, including its consuming mode and the DAML types for its argument and result.

## Context

The package registry already decodes raw template choices from DARs. Each choice contains a name, consuming flag, argument binder type, and result type. The package inspection response currently exposes only template identity and create-data schema through `PackageTemplateSummary`. The frontend already has `PackageTypeTree`, which renders the existing `PackageTypeNode` shape and already supports argument/result schemas for interface choices.

## Design

### Response model

Extend `PackageTemplateSummary` with a `choices` array. Reuse the existing `PackageInterfaceChoice` shape because it contains the exact fields needed by the UI:

- `name`
- `consuming`
- `argumentType`
- `resultType`

The package registry will map every raw template choice into this shape using the same type-node builder used for create data and interface choices. Choices will be sorted by name for stable API output. The existing package detail, module detail, and template detail endpoints will receive the additional field without requiring another request.

When package decoding fails, the existing status and empty-definition behavior remains unchanged; choice arrays are empty. A missing argument or result schema is represented as `null`.

### Template page

Add a `Choices` section below `Create Data` on the template detail page. Render one choice row per template choice. Each row shows:

- the choice name;
- `Consuming` or `Non-Consuming`;
- an `Argument` subsection with `PackageTypeTree` when an argument type exists;
- a `Result` subsection with `PackageTypeTree` when a result type exists.

If a choice has no decoded argument or result type, show a concise unavailable message for that subsection rather than hiding the choice. If the template has no choices, show an empty-state message.

The section uses existing package tree and detail-page styles; no new interaction or endpoint is introduced.

### Data flow

```text
DAR -> PackageRegistryService.inspectPackage()
    -> PackageTemplateSummary.choices[]
    -> GET /packages/:packageId/templates/:templateId
    -> TemplateDetailView
    -> PackageTypeTree for argument/result schemas
```

### Testing

Add coverage for:

1. package inspection mapping a template's raw choices into sorted choice summaries with consuming flags and decoded argument/result nodes;
2. template-detail service output preserving the choice list;
3. the template detail view rendering choice names, consuming mode, argument type, and result type;
4. empty and unavailable argument/result states.

Existing package/module consumers must continue to compile and render with the new array field.

## Scope boundaries

- No separate choices endpoint or additional network request.
- No choice execution or debugger integration.
- No changes to the existing create-data schema renderer.
- No changes to unrelated package pages beyond accepting the additive `choices` field.
