# TypeScript

For read-only application work, start with the TypeScript application section.
Contract builds and code generation apply when you own the contract interface.

## Build Artifacts and TypeScript Codegen

The Rust contract's `.spec.xdr` is the canonical interface. Build deployable RV32
code and generate bindings together, or generate from an existing spec:

```console
groundhog build --bindings ts
groundhog codegen ts path/to/contract.spec.xdr -o path/to/contract.ts
```

Use installed `--help` for paths/options. Regenerate after API changes; never
maintain a second TypeScript ABI. Plain build warns on codegen-incompatible names;
`--bindings ts` makes them errors. Rename the reported declarations.

Build is offline. It reports code/memory sizes and warns above the default 256 KiB
code limit; deployment enforces max_rv32_code_bytes and max_rv32_memory_bytes.
Guest memory defaults to 64 KiB. Set `initial_memory_bytes` in
`[package.metadata.groundhog]` (integer or `"128K"`) within the chain's limit.
Build/test use it for linker layout and artifact metadata. `--stack-size` sets a
reserve within that memory, not a larger total allowance.

Methods and types use interface/version paths: `ERC20.v0_1.transfer` and
`ERC20.v0_1.TransferArgs`. Descriptors provide:

- `invocation` and `call` to prepare calls;
- `view` and `viewOutcome` for simulation;
- `decodeArgs`, `decodeReturn`, and `decodeException` for known method data;
- `decodeReceipt` and `decodeReceiptOutcome` for a known root method's receipt.

`decodeArgs` consumes the complete input and returns undefined for no arguments.
It verifies byte shape, not contract behavior. This runtime addition needs no new
metadata; the separate spec/namespace migration requires regenerated bindings.

Generated event descriptors such as `my_token.v1.events.Transfer` provide
`decode`, `filter`, `allFromReceipt`, and `singleFromReceipt`. Types, enums, and
events follow the spec id: crate, major, module, declaration. Value objects and
type namespaces share paths, preserving erasable TypeScript and Node type
stripping. Reserved path names, globalThis, and crate/interface names spec or
decodeEvent take a leading `$`. Use generated codecs rather than manual XDR.

Addresses, fixed 32-byte values, `u32`, `u64`, `u128`, `i32`, `i64`, `i128`,
`U256`, `I256`, and `bool` are directly filterable topics. Integers use 32-byte
big-endian values with zero/sign extension, not CXS scalar encoding. Strings
and byte slices expose only a hash, not their preimage.

## TypeScript Application Path

Use public package exports and generated bindings, not package internals.
For reads, connect a cluster-aware client to the selected network and contract.
For signed execution, create or load an account, then bind a wallet.
One public client supports multiple independent wallet bindings. Pubkey accounts
use DefaultWallet, including schema-3 bootstrap accounts. Historical saved
legacy source-address wallets use `devWalletAdapter`; preserve their addresses.
Do not submit an application invocation directly as the transaction root.

Select an interface version for values; explicit types use the full namespace:

```ts
import { Counter as CounterVersions } from "./counter";
const Counter = CounterVersions.v0_1;
type Result = CounterVersions.v0_1.GetResult;

const result = await Counter.get.view({ client, contract, caller, signal });
const invocation = Counter.increment.invocation(contract, callGas, { amount: 1n });
const execution = await wallet.executeAndWait({ invocation, gasLimit: walletGas });
```

`method.call` retains decoders for `executeCallsAndWait` on wallets that expose
child returns. For manual decoding, decode the known wallet root receipt first,
then each known child's return buffer. DevWallet discards child returns. Never
decode root abort bytes as a child's exception merely because there was one call.

Submission, commitment, and execution success differ. `executeAndWait` requires
success. `TransactionObservationError` retains the original hash; observe it on
the original network after uncertainty, without automatically re-signing.
Provider-backed helpers require `onSigned` to persist signed evidence before
broadcast. Explicit prepare/sign/persist/submit remains available.

### Amounts, reads, and diagnostics

- Common primitives and constructors are client root exports. Protocol-only
  symbols such as `HOG_ADDRESS` remain in the protocol package.
- `parseUnits("12.05", 2)` returns `1205n`; `formatUnits(1205n, 2)` returns
  `"12.05"`. Neither rounds. `ParseUnitsError` reports malformed input or excess
  precision. Applications check positivity and ABI bounds.
- ERC20 `adjustAllowance` takes a signed `difference` and an `exclusive` flag.
  Exclusive locking does not make an earlier off-chain read current; a read
  followed by a delta cannot guarantee an exact target allowance.
- `getContract({ binding: Counter, address: contract, client })` binds defaults.
  Pass `{ signal }` to actions and `signal` inside generated or bound view options.
- `classifyReadError(error, { signal })` returns transient, permanent, cancelled,
  or unknown without replacing errors. A bare `TypeError` is not proof of a network
  failure. Classification does not authorize transaction resubmission.
- `getVersion` returns nullable `releaseVersion` and `bundleManifestDigest`.
  Use `wireFormat` for compatibility; release identity is diagnostic.
- RPC wire 9 and CLI JSON use canonical decimal strings for all 64-bit-or-wider
  integers; preserve these quantities as `bigint` in TypeScript. Smaller bounded
  integers remain JSON numbers.

### HTTP batching

`new HttpTransport(url, { batch: true })` groups concurrent requests; defaults are
`{ maxSize: 100, waitMs: 0 }`. It is off by default. Both supported servers cap
arrays at 1,000 entries. Match responses by ID; RPC errors remain per-call.
Shared HTTP or malformed-response failures affect the group. No automatic
retry occurs. `timeoutMs` includes body reading after dispatch. One cancellation
does not cancel neighboring calls. HTTP grouping provides no shared snapshot,
execution order, or atomicity. Await dependent operations separately.

### Event pages and restart

`getContractEvents({ event, contractAddresses, topics, limit })` fetches one typed
page. `iterateEventPages(query, { signal })` yields raw pages on demand, without
prefetch, retries, polling, or persistence. Errors propagate. Break stops future
requests; abort cancels an in-flight read.

- Keep the network, target, and filters fixed. A cursor continues the original
  historical scan, not future blocks. Raw requests still require order and anchor.
- Wire `"0x"` is an empty `Uint8Array` in the client. Stop on an empty returned
  cursor, not an empty page.
- For ascending ingestion, start a new ascending scan with an empty cursor at
  the last stored row's height. Deduplicate by transaction hash and event sequence
  number (hash alone for refs). Save rows and progress together.
- Refresh descending history with an empty cursor and client `anchor: "end"`
  (raw RPC `atEnd`). Its last row is the oldest seen, not a forward checkpoint.
- `latestBlock` is the indexer head, not an application checkpoint. Check
  `oldestBlock` for lost history. Current indexers do not reliably reject corrupt
  cursors; do not silently restart.

See the [restart walkthrough](https://docs.groundhog.dev/tutorials/add-events-to-a-contract/#resume-without-missing-events).
