---
name: groundhog
description: >
  Guides Groundhog contract and application development with the installed
  CLI, Rust SDK, generated TypeScript bindings, TypeScript client, wallets,
  local nodes, and JSON-RPC. Use when a task mentions Groundhog or a project
  contains Groundhog configuration, SDK dependencies, or generated artifacts.
---

# Groundhog

Groundhog is not EVM-compatible. Do not infer its execution, storage, account,
transaction, gas, or ABI behavior from Ethereum, Solana, or another chain.

## Start here

1. Read the project's `AGENTS.md` and manifests when present.
2. Identify the task and read the relevant reference below.
3. If the task uses the CLI, run `groundhog --version` and the relevant
   command's `--help`. Use `groundhog status --json` when local setup matters.
4. Prefer public APIs, generated bindings, and current examples. Inspect
   `node_modules`, Cargo registry source, or Groundhog implementation
   repositories only after those public surfaces are insufficient.

Application reads do not require a Rust toolchain, wallet, or local node.
Use the dependencies and network selected by the project.

## Choose a reference

| Task | Read | Bundled CLI access |
| --- | --- | --- |
| Contract logic, storage, native and RV32 tests | [Contracts](references/contracts.md) | `groundhog skill show contracts` |
| Generated bindings, application reads, wallet execution, events | [TypeScript](references/typescript.md) | `groundhog skill show typescript` |
| React application state and reads | [React](references/react.md) | `groundhog skill show react` |
| CLI setup, keys, wallets, deployment, local nodes | [CLI](references/cli.md) | `groundhog skill show cli` |
| Errors, version disagreements, uncertain submissions | [Troubleshooting](references/troubleshooting.md) | `groundhog skill show troubleshooting` |

Read references as needed. Use `groundhog skill show --all` when you need
the complete bundled guide.

## Shared rules

- A generated TypeScript binding describes a contract. It is not a connected
  contract instance and its methods are not direct RPC functions.
- Application invocations normally execute as children of a wallet root
  invocation. Use the public client or CLI to prepare and submit transactions.
- Submission, commitment, and successful execution are different states.
  After a timeout, follow [transaction inspection](references/troubleshooting.md#inspect-the-original-transaction).
- Gas meters computation. It has no token price and
  is not burned. Declared root gas reserves scheduling capacity against free
  HOG; storage funding is separate.
- Never print, log, or paste private signing material. Keep private keys in the
  wallet or designated key store. Persist signed transaction evidence before
  broadcast, as shown in the TypeScript example. Use public
  addresses, transaction hashes, and redacted configuration in reports.

## Documentation and versions

Start at <https://docs.groundhog.dev/> for product documentation. The installed
CLI's `groundhog docs` serves its selected documentation snapshot locally.

The installed skill follows the latest maintained source. CLI-bundled guidance
is selected separately for that CLI release. Neither overrides the project's
installed API. Each example names its dependency set. Start from that complete
example, then check the project's installed declarations if its versions differ.
