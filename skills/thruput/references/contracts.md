# Contracts

## Programming Model

All transactions considered for a block read the same frozen committed
snapshot. A transaction does not see another transaction's writes from that
block. Contract execution produces typed storage deltas rather than a bag of
arbitrary final writes.

After the root call finishes, the runtime checks whether its complete delta
batch can coexist with transactions already admitted to the proposal.
Compatible deltas can land together. A transaction with incompatible deltas is
excluded from that proposal. Exclusion does not consume its nonce and does not
guarantee a requeue. Do not add retry loops inside contract code to handle it.

Gas meters computation. It has no token
price and is not burned. Choose storage operations for correct conflict
semantics, not gas-price optimisation.

Declared root gas reserves scheduling capacity against the sender's free native
tokens; target storage funding is separate. Use workload-tested budgets. A
sufficient first native token credit can fund a recipient's balance-item
deposit; a small first credit may fail. Do not hard-code a universal deposit or
require an airdrop for every new address.

### Start with Balance, Then Choose by Behaviour

For contract authors, `Balance` is the practical starting point for ordinary
nonnegative amounts such as token balances, allowances, supply, deposits, and
credits. It is backed by Thruput's mergeable integer storage, but presents a
zero-defaulting `i128` API with values in `0..=i128::MAX`, without absolute
replacement. Do not use raw `NNInt` for a balance unless the data model
genuinely needs its lower-level signed-delta or explicit-base operations.

- `Balance` is the ordinary type for balances, allowances, supply, and
  nonnegative counters. It uses nonnegative `i128` amounts, defaults missing
  state to zero, rejects negative amounts, and has no absolute set.
  `increase` and `decrease` load the snapshot and fail during execution.
  `lazy_increase` and `lazy_decrease` defer the bound check to reservation. All
  four produce mergeable deltas. Use the `try_` forms to throw a domain
  exception.
- `NNInt` is the lower-level integer type for state that needs signed deltas or
  an explicit base. `NNInt::get` aborts on missing storage. Prefer `strict_inc`
  when execution must observe an immediate bound failure. Use `inc` only when
  deferring the bound check to reservation is intentional.
- `CapacityConstraint` enforces a limit shared by transactions in a block, such
  as a supply cap or an aggregate withdrawal limit. A check against a snapshot
  read cannot enforce such a limit.
- `Array<S, N>` (SDK 0.57.1) is a fixed-length array of independent storage
  slots. Unlike `Vector`, it has no shared length slot.
- `Map<K, V>` gives each key an independent conflict domain. The value type
  determines same-key behaviour.
- `Value<T>` stores typed configuration or other infrequently replaced values.
  It is usually wrong for hot counters or balances.
- `Vector<S>` serializes changes to its length. Do not assume concurrent pushes
  form a scalable shared log.
- `Bytestring` is raw byte storage for lower-level or infrequently replaced
  data. Prefer typed `Value<T>` when a typed value is available.
- `RCQ<T>` is the SDK's retrocausal queue for concurrent request insertion and
  ordered processing. Use the [AMM guide](https://thruput.network/docs/guides/build-an-amm/)
  for a complete queued application rather than assuming ordinary map semantics.

For a token, use `Map<ContractAddress, Balance>` for per-account balances. For
a nonnegative counter, use `Balance`. Do not implement either as read,
calculate, and replace through `Value` or `Bytestring`.

## Rust Contract Path

Start from the installed scaffold instead of recreating its Cargo and RV32
configuration:

```console
thruput new my-contract
cd my-contract
cargo test
thruput build
thruput test
```

`thruput new <name>` creates a minimal contract. `thruput new <name> --template
counter` creates a `Balance` counter with a declared event.

Use `cargo test` for fast native tests. Use `thruput test` for the generated
RV32 artifact. They exercise different paths and neither substitutes for the
other. The scaffolded SDK downloads its test executor from public storage. Use `thruput test --integration` for
RPC tests against an ephemeral local node. In a multi-contract Cargo workspace,
`thruput test --workspace` runs the RV32 tests of every member that has a
`tests/test_rv32.rs` target and reports them together.

The scaffold shares behavior checks between both test paths:

- `tests/common/mod.rs` holds the checks, as functions that take
  `(&TestEnvironmentHandle, &SHA256Hash)`.
- `tests/test.rs` calls them with the hash from `register_mock_contract(&env)`.
- `tests/test_rv32.rs` calls them with the compiled artifact from
  `load_rv32_contract(...)`. These tests are `#[ignore]`; `thruput test` runs
  them.

Add new checks to `tests/common/mod.rs` and call them from both entry points.
Report native tests, the guest build, and guest execution separately.

Preserve the scaffold's feature names, RV32 binary wrapper, Cargo overlays, and
self dev-dependency. They are toolchain contracts, not incidental style:

- Do not make `dev` a default feature.
- A contract that depends on another contract crate forwards that crate's `dev`
  from its own `dev`.
- Keep `.cargo/`, `rust-toolchain.toml`, and `thruput.toml` at the Cargo
  workspace root. Keep the RV32 rustflags in one place.
- Build RV32 with `thruput build`, not bare Cargo.
- If you rename the package, rename the `[[bin]]` target and the `extern crate`
  in `src/main.rs`.

CLI 0.40.2 scaffolds pin `thruput-sdk` =0.57.1 and the `nightly-2026-07-01`
toolchain. The standard interface crates released with SDK 0.57.1 are 0.1.69.
SDK 0.57.0 pairs with 0.1.68. Check the generated manifest for the installed
build. Pin SDK and interface crates exactly, and update them together.
SDK 0.56 renamed the RV32 linker script: change `-Tgroundhog-rv32.ld` to
`-Tthruput-rv32.ld` in `.cargo/config.toml`. `thruput build` refuses contracts
built against an SDK older than 0.56; rebuild them.

## Complete Balance example

Start from the maintained
[ERC-20 contract](https://github.com/thruputchain/thruput-examples/tree/main/contracts/erc20)
for a complete Balance-based implementation, including authorization, transfers,
allowances, events, and tests. The source checked for this skill is
[revision 7d3327a](https://github.com/thruputchain/thruput-examples/tree/7d3327ae2fe6/contracts/erc20),
using SDK 0.57.0 and standard interfaces 0.1.68. Treat this as a versioned
example; check the project's installed APIs before adapting it to newer
dependencies.

Read `src/implementation.rs` for `Map<ContractAddress, Balance>`,
`tests/common/contract_test.rs` for transfer and bound checks, and
`tests/same_block.rs` for same-block behavior. The checked debit
uses `try_decrease`; the recipient credit uses `try_lazy_increase`. Matching
storage operations can merge only when aggregate bounds and the transaction's
other changes also permit it. Follow the repository's setup instructions and run
both its native and RV32 tests before changing the implementation.

Keep contract logic in `src/implementation.rs`; keep `src/lib.rs` focused on
the `no_std` gate, mock registration, module declaration, and public
re-exports. Prefer `#[contract_exception]` for contract-facing exceptions, and
declare them on the interface with `#[contract(throws = MyError)]` or
`throws(...)`, so the contract spec publishes the error contract. Update native
and RV32 tests with behaviour changes.

Derive events with `#[derive(Event)]`. Topic 0 is the event signature, and at
most two more fields can be `#[topic]`. String and byte topics are hashed and
cannot be recovered from the topic. Emit with `log_event`. Declare the type
with `#[contract(emits(MyEvent))]`, or export its spec with
`#[event_spec(export)]`. Runtime logging alone does not add the event to the
contract spec or generated bindings.

From SDK 0.57.1, contract methods can take and return owned `String`, including
inside `Option`. The guest build needs `alloc`: add `features = ["alloc"]` to
the `cfg(target_arch = "riscv32")` `thruput-sdk` dependency. Without it, native
tests pass but `thruput build` fails. Borrowed `&str` and `heapless::String<N>`
avoid allocation.

Use the resolved `thruput-sdk` source in the Cargo registry, its Rustdoc, and
the scaffold when you look up a macro attribute or test helper.
