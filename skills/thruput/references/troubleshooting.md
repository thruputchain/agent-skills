# Troubleshooting

Record the command, exit code, exact error, selected network, CLI version, and
relevant dependency versions. Include public addresses and hashes, but redact
tokens and private keys. Commands below use the Thruput CLI; the status
table describes RPC wire format 11.1.0.

## Diagnose the symptom

| Symptom | Evidence to collect | Next action |
| --- | --- | --- |
| npm or Cargo registry authentication fails | Registry hostname, HTTP status, package name/version; `npm config get @thruputchain:registry` for npm; the registry URL selected by Cargo | Configure credentials for that registry using [client setup](https://github.com/thruputchain/thruput-sdk-ts#registry-auth-one-time-setup) or [CLI setup](https://thruput.network/docs/get-started/cli/). Confirm package access. Do not print credential files or replace private dependencies with similarly named public packages. |
| Runtime or network descriptor is incompatible | `thruput --version`, `thruput status --json`, `thruput toolchain list --json`, and the exact expected/received values; note any explicit runtime override | For a local node, use the CLI-selected runtime or a source-verified compatible override. For a hosted endpoint, report the mismatch to its operator. Preserve persistent node data while investigating. |
| Generated binding and client disagree | `npm ls @thruputchain/client @thruputchain/protocol @thruputchain/react`; CLI version; compiler error; `.spec.xdr` from the deployed build | Install compatible dependencies and regenerate with `thruput codegen ts CONTRACT.spec.xdr -o src/contract.ts`. Do not edit generated types or suppress peer errors. Use the [read example](typescript.md#read-a-contract) as a baseline. |
| Submission or observation times out | Original hash, network, signed evidence if saved, error cause and submission cause | Run the inspection procedure below. Keep observing the original hash. A timeout stops observation, not execution; do not sign a replacement automatically. |
| Transaction committed but execution failed | Receipt, execution result, revert data if present, root wallet method, intended child calls, gas limit and gas used | Fix the reported authorization, balance, storage-funding, or execution-budget condition. Decode the known root first; root abort bytes are not automatically a child exception. A new user-authorized attempt is a new transaction. |
| Execution succeeded but return decoding failed | Successful receipt, generated binding, deployed spec, and decoder error | Correct the decoder or binding and decode the same receipt again. Do not repeat a successful write to obtain its return value. |

## Inspect the original transaction

1. Recover the hash from the submission result, `TransactionObservationError`,
   or the saved `onSigned` record. Keep its original account and network.
2. Inspect the CLI profile's endpoint and identity. Use the profile that matches
   the saved network, not whichever profile is currently selected:

   ```sh
   thruput config get local --sources
   thruput tx show TX_HASH --profile local --json
   ```

   Replace `local` with the original profile and `TX_HASH` with the original
   32-byte hash. Do not send a seed or signed transaction to this command.
   If the application has no CLI profile, use its public client and
   `inspectPending()` below rather than selecting an unrelated profile.
3. Read the status and, when available, the receipt's execution result:

   | Result | Next action |
   | --- | --- |
   | `pending` | Keep the hash and repeat the read-only lookup later. |
   | `committed` with successful execution | Record the receipt height and refresh application reads. |
   | `committed` with failed execution | Keep the receipt and diagnose its execution result. |
   | `recentFailure` | Treat it as an advisory attempt result; the transaction may still commit. |
   | `retry` | Inspect the error source and code. Resubmitting the same transaction may succeed; the mempool does not retry it automatically. |
   | `dropped` | Inspect the error source and code. Change the transaction before an authorized resubmission. |
   | `unknown`, `other`, an unrecognized status (`UnsupportedRpcValue` in the TypeScript client), missing receipt, or lookup error | The outcome is unresolved. Check endpoint identity and availability, preserve evidence, and inspect again. |

An indexed committed record takes precedence over scheduler outcomes. A
`committed` status includes its block height. The receipt may remain unavailable
until indexing catches up; keep the original hash and inspect it again.

For a browser app, call `inspectPending()` from the
[wallet example](typescript.md#wallet-write-with-recovery). It needs only the
public client on the original network, so it works after reload or wallet
disconnect. `waitForTransactionReceipt` can resume polling but does not itself
require successful execution. Check `receipt.execution.result === "return"`
before showing success.

## Resolve an API disagreement

Start with the project's manifests, generated binding, and installed CLI help.
Then check the matching package's public declarations and usage guide. Inspect
implementation source when those surfaces do not answer the question. Report
the exact version and disagreement; do not combine incompatible APIs.
