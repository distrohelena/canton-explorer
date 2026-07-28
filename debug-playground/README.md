# Canton Explorer Debug Playground

This is a tiny DAML package for testing Canton Explorer’s debugger. It is
deliberately dependency-light and uses small constructor and choice arguments
that are easy to enter by hand.

## Prerequisites

Install DAML SDK 3.5.2, matching `daml.yaml`.

## Build the DAR

From the repository root:

```bash
cd debug-playground
daml build
```

The normal DAR is written to:

```text
debug-playground/.daml/dist/canton-explorer-debug-playground-0.1.0.dar
```

## Install it on a participant

Upload the DAR to every participant where you want to create and inspect the
playground contracts. The exact host, port, authentication, and TLS options
depend on the participant deployment. For a local participant exposing the
standard package-admin HTTP endpoint, the shape is:

```bash
curl --fail --request POST \
  --header 'Content-Type: application/octet-stream' \
  --data-binary @.daml/dist/canton-explorer-debug-playground-0.1.0.dar \
  http://localhost:PORT/v1/packages
```

Replace `PORT` and add the participant’s authentication/TLS options as needed.

## Create a debug DAR

The normal DAR is enough to install the package. To get source locations in
Canton Explorer’s debugger, create a companion debug DAR with the repository’s
existing helper:

```bash
cd ..
npm run dar:prepare --workspace backend -- \
  --input ../debug-playground/.daml/dist/canton-explorer-debug-playground-0.1.0.dar \
  --output ../debug-playground/.daml/dist/canton-explorer-debug-playground-0.1.0-debug.dar
```

Copy the generated `*-debug.dar` into the explorer backend’s configured
`debugger.localDarDirectory`. The debug DAR must accompany the same normal DAR;
do not rebuild the package separately, because both archives must contain the
same compiled `.dalf` payloads and therefore the same package ID.

## Templates and debugger scenarios

All templates use a single `owner`/`sender` party as the signatory unless noted
otherwise.

- `Message` — create with `sender`, `recipient`, and `Text`; exercise `Echo`
  to return the text, or `ReplaceText` with a new `Text` value.
- `Counter` — create with an `Int` value; exercise `Read` or `Increment` with a
  positive or negative `Int` delta.
- `Profile` — create with `displayName` and an `Optional Text` nickname; exercise
  `SetNickname` with either `None` or `Some Text`.
- `TagList` — create with a list of `Text` tags; exercise `AddTag` to consume the
  contract and create a new list.
- `ContractReference` — create with a `ContractId Message` and a `Bool`; exercise
  `PingTarget` to exercise `Message.Echo` through the reference.
- `FailureSwitch` — create with `fail = true`, then exercise `Check` to inspect
  an intentional assertion failure. Create it with `fail = false` to inspect the
  successful path.

For `ContractReference`, use the same party as the `Message.sender`, because
that party controls `Message.Echo`.
