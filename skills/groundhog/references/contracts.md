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

Gas meters computation and bounds cross-contract call depth. It has no token
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
zero-defaulting `u128` API that prevents negative values and absolute
replacement. Do not use raw `NNInt` for a balance unless the data model
genuinely needs its lower-level signed-delta or explicit-base operations.

- `Balance` is the ordinary type for balances, allowances, and supply. It uses
  `u128`, defaults missing state to zero, exposes increases and decreases, and
  does not expose absolute replacement or negative values.
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
- `RCQ<T>` is the SDK's retro-causal queue. Within a block, submission order
  determines whether a consume sees another transaction's insert, and
  concurrent consumes conflict. Use it only when those semantics match the
  application.

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

That self dev-dependency puts the project name in the extern prelude of every
test target, so `groundhog new` refuses names that would shadow something the
generated project needs: Rust's built-in crates (`test`, `core`, `std`,
`alloc`, `proc-macro`), Rust keywords, the scaffold's own dependencies (`sdk`,
`tokio`, `groundhog-json-rpc-client`), Cargo's build directory names (`build`,
`deps`, `examples`, `incremental`), and reserved Windows device names. The
error names the collision; pick another name rather than patching the
generated manifest.

These examples use the Groundhog CLI 0.22.1 dependency set: SDK 0.42.2,
standard interfaces 0.1.44, protocol-rs 0.43.0, and XDR 0.10.2. Check the
project's actual dependencies before applying them. Update the SDK and
interface dependencies together when migrating an existing Rust project.

The normal starter contract is a counter, one of the narrower cases where
`NNInt` is appropriate. Do not copy this storage choice for token balances or
other ordinary nonnegative amounts; use `Balance` for those.

The contract shape is:

```rust
use sdk::storage::NNInt;
use sdk::*;

#[derive(Debug)]
#[sdk::storage]
pub struct Counter {
    value: NNInt,
}

#[contract]
impl Counter {
    pub fn increment(&mut self, amount: u64) {
        self.value.strict_inc(amount as i128);
    }

    pub fn get(&self) -> u64 {
        self.value.try_get().none_if_missing().unwrap_or(0) as u64
    }
}
```

Keep contract logic in `src/implementation.rs`; keep `src/lib.rs` focused on
the `no_std` gate, mock registration, module declaration, and public
re-exports. Prefer `#[contract_exception]` for contract-facing exceptions.
Update native and RV32 tests with behaviour changes.

Before inventing a macro attribute or test helper, inspect the scaffold and the
public Rustdoc for the SDK version the project actually uses.
