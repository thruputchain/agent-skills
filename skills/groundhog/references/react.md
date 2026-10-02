# React

Use `@groundhogchain/react` and its supported client dependency. Check the
installed package exports and declarations before selecting provider or hook
names. Do not invent a hook based on another blockchain's React library.

Start with a read-only screen against the project's selected network and
contract. Show loading, error, and empty states, then add refresh behavior.
A read-only application does not need a signing key, wallet connection,
Rust toolchain, or deployed contract of its own.

Keep the client and network configuration stable across renders. Use the
library's read lifecycle and cancellation support. Keep large quantities as
`bigint` until formatting them for display. Avoid converting token quantities
to JavaScript `number`.

For writes, obtain explicit user intent, prepare the typed application call,
and submit through the supported wallet integration. Show submission,
commitment, and execution results separately. Preserve the transaction hash
when observation fails; do not automatically sign a replacement transaction.

Verify the page with real data, an unavailable endpoint, and a refresh while
a request is in flight. Use the project's existing tests and build command.
