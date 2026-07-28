# Simulated debugger create sessions

## Goal

Allow the debugger's New Simulation flow to evaluate a DAML template create entirely in memory. The user supplies constructor arguments, clicks a button, and sees the resulting synthetic update in the existing debugger without submitting anything to Canton.

## Design

The backend will expose a simulation session endpoint accepting the selected gRPC node, package ID, template ID, and normalized constructor argument. It will load the selected DAR and source map from the node/package cache, construct a synthetic transaction snapshot with a `create` replay entrypoint, and pass that snapshot through the existing compilation, source indexing, DAML LF evaluation, and replay session pipeline. The synthetic offset/update identity will be generated locally and will not be queried from or written to the ledger.

The frontend will render a Create debug session button in step 04. It will remain disabled while the constructor schema is loading, the form is invalid, or a required selection is missing. On success it will open the returned session using the existing debugger workspace and session routing. Synthetic sessions will have no real ledger events, while their replay event list will show the evaluated create effects.

The existing update-based debugger endpoint and real ledger replay behavior remain unchanged. Exercise simulations are outside this slice; their existing selection UI remains available for a later choice/contract-input implementation.

## Error handling and testing

The endpoint will validate the node, package, template, and constructor argument before attempting replay. Existing debugger error mapping will be reused where possible. Backend tests will cover synthetic snapshot construction and session bootstrap inputs; frontend tests will cover button state, request payload, loading/error behavior, and opening the returned session.
