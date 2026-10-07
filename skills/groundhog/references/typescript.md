# TypeScript

Use the public client and generated contract bindings. A descriptor prepares or
decodes a call; it is not a connected contract instance.

Current RPC wire format 10 and CLI JSON encode all 64-bit-or-wider integers as
canonical decimal strings, including small values. Preserve them as `bigint`
in TypeScript; smaller bounded integers remain JSON numbers. Select a client
that supports the target's `wireFormat`. The examples below retain their tested
older dependency set and do not establish compatibility with wire format 10.

Pubkey accounts, including hosted schema-3 bootstrap accounts, use DefaultWallet.
Local schema-4 manifests contain public allocations; applications and harnesses
own their signing keys. Preserve historical source-address wallet identities
when using `devWalletAdapter` rather than deriving replacement addresses.

## Read a contract

Verified on 2026-10-05 with Node.js 22, `@groundhogchain/client` 0.14.0,
`@groundhogchain/protocol` 0.12.0, TypeScript 6.0.3, and tsx 4.22.4.
The exact read and wallet examples passed type checks and local-node execution
with CLI 0.22.1, including observation failure and reload recovery.
Configure [GitHub Packages access](https://github.com/groundhogchain/client-ts#registry-auth-one-time-setup),
then create a directory and install:

```sh
npm init -y
npm pkg set type=module
npm install --save-exact @groundhogchain/client@0.14.0 @groundhogchain/protocol@0.12.0
npm install --save-dev --save-exact typescript@6.0.3 tsx@4.22.4 @types/node@25.9.1
```

Start `groundhog node` in another terminal. This example reads the native HOG
contract on the local network; no wallet, private key, or contract deployment is
needed. For a hosted network, replace `localnet()` with its configured cluster.

```ts title="read.ts"
import { createGroundhogClient, localnet, formatUnits } from "@groundhogchain/client";
import { ERC20 } from "@groundhogchain/client/contracts";
import { HOG_ADDRESS } from "@groundhogchain/protocol";

async function main() {
  const client = await createGroundhogClient({ cluster: localnet() });
  const supply = await ERC20.v0_1.totalSupply.view({
    client,
    contract: HOG_ADDRESS,
  });
  console.log("HOG supply:", formatUnits(supply.value, 7));
  console.log("Read at block:", supply.height.toString());
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Read failed");
  process.exitCode = 1;
});
```

Run `npx tsx read.ts`. Expect a supply and a read height, not a fixed block number.
Keep amounts as `bigint`; `formatUnits` is for display. `parseUnits("0.0001", 7)`
produces `1000n` without rounding.

## Wallet write with recovery

Use the same client/protocol versions in a browser app on HTTPS or localhost.
The wallet and RPC must use the same local network. Fund the sending account and
use a recipient that already has HOG for this small-transfer example. A new
recipient also needs its balance-storage deposit.

For a Vite app, forward same-origin RPC requests to the local node. This avoids
depending on cross-origin access from the node's HTTP server:

```ts title="vite.config.ts"
import { defineConfig } from "vite";

export default defineConfig({
  server: { proxy: { "/rpc": { target: "http://127.0.0.1:9545", rewrite: () => "/" } } },
});
```

This single-tab module handles one unresolved transfer at a time. Call
`sendHog(provider, receiver)` from the user's send action. Obtain `provider`
through `discoverWalletProviders` from `@groundhogchain/client/provider` and
let the user choose it. The example uses the first account authorized by that
wallet. See the [wallet picker](https://docs.groundhog.dev/tools/wallet-integration/#discover-and-connect)
for account selection and discovery cleanup.

```ts title="wallet.ts"
import {
  addressFromHex, createGroundhogClient, gasAmount, hashFromHex, localnet,
  parseUnits, toHex0x, TransactionExecutionError, TransactionObservationError,
} from "@groundhogchain/client";
import { ERC20 } from "@groundhogchain/client/contracts";
import {
  parseSignTransactionResult, parseWalletAccount, parseWalletNetworkHash,
  parseWalletSession, type WalletProvider,
} from "@groundhogchain/client/provider";
import {
  createProviderWalletClient, type PendingWalletTransaction,
} from "@groundhogchain/client/wallet";
import { HOG_ADDRESS } from "@groundhogchain/protocol";

const client = await createGroundhogClient({
  cluster: localnet({ rpcUrl: new URL("/rpc", window.location.origin).href }),
});
const networkHash = toHex0x(client.network.networkHash).slice(2);
const storageKey = `hog-transfer:v1:${networkHash}`;
let sending = false;

function loadPending(): PendingWalletTransaction | null {
  const raw = localStorage.getItem(storageKey);
  if (raw === null) return null;
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object") throw new Error("Invalid saved transfer");
  const record = value as Record<string, unknown>;
  if (record.version !== 1) throw new Error("Unsupported saved transfer version");
  const savedNetwork = parseWalletNetworkHash(record.networkHash);
  if (savedNetwork !== networkHash) throw new Error("Saved transfer is on another network");
  return {
    ...parseSignTransactionResult({ signedTransaction: record.signedTransaction, hash: record.hash }),
    account: parseWalletAccount(record.account),
    networkHash: savedNetwork,
  };
}

export async function sendHog(provider: WalletProvider, receiver: string) {
  if (sending || loadPending()) throw new Error("Inspect the existing transfer first");
  const recipient = addressFromHex(receiver);
  sending = true;
  try {
    const session = parseWalletSession(await provider.request({ method: "connect" }));
    if (session.networkHash !== networkHash) throw new Error("Select the app network");
    const account = session.accounts[0];
    if (!account) throw new Error("No authorized account");
    const wallet = createProviderWalletClient({ client, provider, account, networkHash });
    try {
      const invocation = ERC20.v0_1.transfer.invocation(
        HOG_ADDRESS, gasAmount(500_000n),
        { receiver: recipient, amount: parseUnits("0.0001", 7) },
      );
      const { receipt } = await wallet.executeAndWait(
        { invocation, gasLimit: gasAmount(1_000_000n) },
        {
          onSigned: (pending) => {
            if (loadPending()) throw new Error("An unresolved transfer is already saved");
            localStorage.setItem(storageKey, JSON.stringify({ version: 1, ...pending }));
          },
          wait: { timeoutMs: 30_000 },
        },
      );
      return { state: "committed" as const, receipt };
    } catch (error) {
      if (error instanceof TransactionExecutionError) {
        return { state: "committed" as const, receipt: error.receipt };
      }
      if (error instanceof TransactionObservationError) {
        return { state: "unobserved" as const, hash: toHex0x(error.txHash) };
      }
      throw error;
    } finally {
      wallet.dispose();
    }
  } finally {
    sending = false;
  }
}

// Call on reload or from a Check transaction button. No wallet connection needed.
export async function inspectPending() {
  const pending = loadPending();
  if (!pending) return null;
  const hash = hashFromHex(pending.hash);
  const status = await client.getTransactionStatus(hash);
  const receipt = status.status === "committed"
    ? await client.getTransactionReceipt(hash) : null;
  return { hash: pending.hash, account: pending.account.address, status, receipt };
}

// Call only after displaying the committed outcome and the user acknowledges it.
export async function acknowledgeResult() {
  const result = await inspectPending();
  if (!result?.receipt) throw new Error("The transfer outcome is still unresolved");
  localStorage.removeItem(storageKey);
}
```

The SDK awaits `onSigned` before broadcast. Storage failure stops submission.
The saved record contains signed bytes, hash, original account, and network,
not a private key. A rejected signature creates no new record. A session change
invalidates the adapter; it never selects another signer automatically.

On `unobserved`, keep the record and call `inspectPending()` later, including
after reload. If inspection fails, retain the record and show the error. Do not
call `sendHog` again to recover it. Check `receipt.execResult ===
ExecResult.ExecResultOK` (import `ExecResult` from the client) before showing
success: a committed receipt can describe failed execution. An unresolved or
corrupt saved record blocks new transfers rather than silently discarding evidence.

The gas values are budgets for this example, not universal defaults. Gas has no
token fee; free HOG supplies scheduling capacity and storage requires deposits.

## Generate bindings for your own contract

```sh
groundhog build --bindings ts
groundhog codegen ts target/groundhog/my_contract.spec.xdr -o src/my-contract.ts
```

Use the `.spec.xdr` from the deployed build. Regenerate after interface changes;
do not edit the generated file or maintain a second ABI. Select an interface
version such as `Counter.v0_1`. Use its `view` for reads and `invocation` for
wallet execution. `getContract` can bind a descriptor, address, and client once.

Use `executeCallsAndWait` when typed child return values are needed. Root receipt
bytes belong to the wallet, not directly to its child contract. A decoding failure
after successful execution is not a reason to repeat the write.

## Events and transport

- Generated event descriptors provide `filter`, `decode`, `allFromReceipt`, and
  `singleFromReceipt`. Use their codecs rather than manually encoding topics.
- Continue an opaque cursor with the same network, target, and filters. Stop on
  an empty returned cursor, not an empty page.
- Save event rows and progress together. For ascending ingestion, restart at the
  last saved row height and deduplicate by transaction hash and event sequence.
  A descending history page's oldest row is not a forward-ingestion checkpoint.
- `latestBlock` is the indexer head. Check `oldestBlock` for retained-history gaps.
- HTTP batching groups independent requests; it does not provide a shared
  snapshot, ordering, or atomicity. Await dependent operations separately.

See [event recovery](https://docs.groundhog.dev/typescript/events/#resume-without-missing-events)
and [transaction diagnostics](troubleshooting.md#inspect-the-original-transaction).
