# Contracts

## Programming Model

All transactions considered for a block read the same frozen committed
snapshot. A transaction does not see another transaction's writes from that
block. Contract execution produces typed storage deltas rather than a bag of
arbitrary final writes.

After the root call finishes, the runtime checks whether its complete delta
batch can coexist with transactions already admitted to the proposal.
Compatible deltas can land together. A transaction with incompatible deltas is
excluded and returned to the mempool. Do not add retry loops inside contract
code to handle this exclusion.

Gas meters computation. It has no token
price and is not burned. Choose storage operations for correct conflict
semantics, not gas-price optimisation.

Declared root gas reserves scheduling capacity against the sender's free HOG;
target storage funding is separate. Use workload-tested budgets. A sufficient
first HOG credit can fund a recipient's balance-item deposit; a small first
credit may fail. Do not hard-code a universal deposit or require an airdrop for
every new address.

### Start with Balance, Then Choose by Behaviour

For contract authors, `Balance` is the practical starting point for ordinary
nonnegative amounts such as token balances, allowances, supply, deposits, and
credits. It is backed by Groundhog's mergeable integer storage, but presents a
zero-defaulting `i128` API with values in `0..=i128::MAX`, without absolute
replacement. Do not use raw `NNInt` for a balance unless the data model
genuinely needs its lower-level signed-delta or explicit-base operations.

- `Balance` is the ordinary type for balances, allowances, and supply. It uses
  nonnegative `i128` amounts, defaults missing state to zero, and exposes
  increases and decreases. It rejects negative amounts and has no absolute set.
- `NNInt` is the lower-level integer type for counters and state that needs
  signed deltas or an explicit base. Prefer `strict_inc` when execution must
  observe an immediate bound failure. Use `inc` only when deferring the bound
  check to reservation is intentional.
- `Map<K, V>` gives each key an independent conflict domain. The value type
  determines same-key behaviour.
- `Value<T>` stores typed configuration or other infrequently replaced values.
  It is usually wrong for hot counters or balances.
- `Vector<S>` serializes changes to its length. Do not assume concurrent pushes
  form a scalable shared log.
- `Bytestring` is raw byte storage for lower-level or infrequently replaced
  data. Prefer typed `Value<T>` when a typed value is available.
- `RCQ<T>` is the SDK's retrocausal queue for concurrent request insertion and
  ordered processing. Use the [AMM guide](https://docs.groundhog.dev/tutorials/build-an-amm/)
  for a complete queued application rather than assuming ordinary map semantics.

For a token, use `Map<ContractAddress, Balance>` for per-account balances. For
a counter, use `NNInt`. Do not implement either as read, calculate, and replace
through `Value` or `Bytestring`.

## Rust Contract Path

Start from the installed scaffold instead of recreating its Cargo and RV32
configuration:

```console
groundhog new my-contract
cd my-contract
cargo test
groundhog build
groundhog test
```

Use `cargo test` for fast native tests. Use `groundhog test` for the generated
RV32 artifact. They exercise different paths and neither substitutes for the
other. The scaffolded SDK downloads its test executor from public storage.
Building a scaffold needs Cargo credentials for the Groundhog registry; the
Getting Started guide covers that setup. Use `groundhog test --integration` for
RPC tests against an ephemeral local node. In a multi-contract Cargo workspace,
`groundhog test --workspace` runs the RV32 tests of every member that has a
`tests/test_rv32.rs` target and reports them together.

Preserve the scaffold's feature names, RV32 binary wrapper, Cargo overlays, and
self dev-dependency. They are toolchain contracts, not incidental style.

The current CLI 0.23.0 scaffold uses SDK 0.44.2, standard interfaces 0.1.47,
protocol-rs 0.46.0, and XDR 0.10.3. Check the generated manifest for the installed
build. Update SDK and interface dependencies together when migrating a project.

## Complete Balance example

Start from the maintained
[ERC-20 contract](https://github.com/groundhogchain/groundhog-examples/tree/main/contracts/erc20)
for a complete Balance-based implementation, including authorization, transfers,
allowances, events, and tests. The source checked for this skill is
[revision efb4250](https://github.com/groundhogchain/groundhog-examples/tree/efb425068d16b10fbb25c9bb980115737206a7e6/contracts/erc20),
using the older CLI 0.22.1 dependency set: SDK 0.42.2, standard interfaces
0.1.44, protocol-rs 0.43.0, and XDR 0.10.2. Treat this as a versioned example;
check the project's installed APIs before adapting it to newer dependencies.

Read `src/implementation.rs` for `Map<ContractAddress, Balance>` and
`tests/common/contract_test.rs` for transfer and bound checks. The checked debit
uses `try_decrease`; the recipient credit uses `try_lazy_increase`. Matching
storage operations can merge only when aggregate bounds and the transaction's
other changes also permit it. Follow the repository's setup instructions and run
both its native and RV32 tests before changing the implementation.

The normal starter contract is a counter, one of the narrower cases where
`NNInt` is appropriate. Do not copy this storage choice for token balances or
other ordinary nonnegative amounts; use `Balance` for those.

Keep contract logic in `src/implementation.rs`; keep `src/lib.rs` focused on
the `no_std` gate, mock registration, module declaration, and public
re-exports. Prefer `#[contract_exception]` for contract-facing exceptions.
Update native and RV32 tests with behaviour changes.

Use the scaffold and the public Rustdoc for the project's SDK version when
looking up a macro attribute or test helper.
