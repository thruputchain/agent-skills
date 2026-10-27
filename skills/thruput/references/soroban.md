# Port a Soroban Contract

Port one workflow first. Preserve the source behavior unless a change is
deliberate and documented. Read the source contract, its tests, and its
dependency pins. Read the [Stellar & Soroban](https://thruput.network/docs/ecosystem/stellar/)
docs page and use it as a checklist. Verify APIs against the project's resolved
SDK and installed CLI.

For token ports, check the SDK's `thruput-sep41` adapter and the existing ERC20
interfaces before you write a new token. Do not claim Soroban ABI, SEP-41, or
bridge compatibility. A port reproduces
behavior. It does not make Soroban clients or Wasm run on Thruput.

## Map the Basics

| Soroban | Thruput |
| --- | --- |
| `stellar contract build` (Wasm) | `thruput build` (RV32 artifact and contract spec) |
| `__constructor` | An initializer with a contract-defined guard, run with `deploy --init` and an explicit `--fund` amount |
| `#[contracterror]`, `Result<T, E>` returns | `#[contract_exception]`; exported methods throw |
| `#[contractevent]`, `env.events().publish` | Declared typed events and `log_event`; topic 0 is the event signature |
| `env.ledger().timestamp()` (seconds) / `sequence()` | `get_block_timepoint()` (Unix nanoseconds, fixed per block) / `get_block_height()` |
| `Address`, `#[contracttype]` | `ContractAddress`, `#[contract_type]` |
| `env.current_contract_address()` | `get_current_address()` |
| `contractimport!` client | Generated Rust client; `try_*` returns `CallError` |
| `update_current_contract_wasm` | No upgrade in place; deploy a new contract |
| Instance and Persistent storage | Contract storage fields and typed handles (`Value`, `Map`, `Balance`) |
| Temporary storage, `extend_ttl` | No TTL; data stays until deleted |

Use the generated compiler settings and dependency pins. The generated release
profile sets `overflow-checks = false`. Soroban examples set `true`. Where the
source relies on an overflow panic, use checked arithmetic and throw a typed
exception. Native tests still panic on overflow, so test the overflow path in
the RV32 guest as well.

## Port Authorization

Find whose authority each operation needs and how that authority reaches the
contract. `get_caller()` is the immediate caller. It is not the same as
`require_auth()`.

| Source pattern | Port decision |
| --- | --- |
| No authorization | Add no guard. Test that several different callers succeed. |
| `user.require_auth()`; the user changes only its own state; nothing forwards | `get_caller() == user` keeps who may change the state. Document that relayed or sponsored submission and forwarded calls are lost. Test that a forwarded call is refused. |
| `from.require_auth()` reached through a router or other intermediary | The callee sees the intermediary. Use an existing allowance or typed grant interface. Bind the payer to authenticated authority. Never spend the intermediary's own balance, and never trust a caller-supplied owner. |
| Invocation-specific authorization (recipient, amount, child calls) | An allowance is a persistent budget, usually without a recipient. Document this change. If the source needs one-operation authority, use a narrower grant. |
| Several parties each authorize one invocation (for example, two `require_auth_for_args` calls in an atomic swap) | A transaction has one source address and each call has one immediate caller. Store a grant for each party, or have each party's wallet mint a `Signed<T>`. |
| Grants that replace a party's authorization | Bind each grant to the authorized arguments. Consume it once. Give it an expiry and a revocation path. If a call can consume it without completing the operation, others can cancel that party's side. |
| Custom account, `__check_auth` | Separate transaction admission from application authority. Do not add a signature framework only to replace `require_auth`. |

A `Signed<T>` is a runtime handle, not an off-chain signature. Detached
signatures cannot yet become `Signed<T>` values. Check the consumed minter and
payload against the owner, recipient, amount, and other policy.

## Storage, Payment, and Deadlines

- A contract pays the storage deposits for data under its address. The
  submitter does not. Find every entry a caller can create (balances,
  allowances, per-user records). Decide who may create entries. Fund the
  contract at deployment with `--fund`. A write the contract cannot fund is
  excluded, not aborted. Sponsored transactions are planned but not available.
- Store deadlines explicitly and check them on read. If the source extended a
  Temporary entry to a deadline, Soroban refused deadlines past the network's
  maximum TTL. Keep an explicit bound if the source relied on that limit.
- Preserve the source's numeric limits. Do not widen a `u32` to `i128` or a
  `Balance` without a reason.

## Same-Block Behavior

Soroban applies the transactions in a ledger in order. Thruput transactions in
one block all read the prior committed snapshot.

- Two absolute `Value::set` writes of the same value can merge. A
  read/increment/set port can then lose an update. Use `Balance` deltas when
  their bounds and return values fit. Use an exclusive write for an absolute
  update that needs one included writer.
- Authorization reads are snapshot reads. After an admin change or revocation,
  test the previous holder acting in the same block.
- Exclusion is not an automatic retry. Do not add retry loops in contract code.

## Test the Port

- Port every behavior in the source tests. Add unauthorized, forwarded-call,
  and same-block cases.
- In the SDK test environment, call `env.advance_block()` after a write before
  a dependent transaction reads it.
- Match the intended error, not any error. Match `CallError` variants such as
  `Reentrance` and `Invalid` exactly.
- Check balances, grants, and other state after each success and refusal.
- Run native tests and RV32 guest tests. Build every contract that a guest test
  loads before you run it.
- Compilation is not execution. Report each check you ran, and mark checks you
  could not run as unverified.

Report the preserved behavior, each deliberate difference, each authority
change, the versions used, and the checks run.
