# TypeScript

Use the public client and generated contract bindings. A descriptor prepares or
decodes a call; it is not a connected contract instance.

RPC wire format 14 and CLI JSON encode all 64-bit-or-wider integers as
canonical decimal strings, including small values. Preserve them as `bigint`
in TypeScript; smaller bounded integers remain JSON numbers. Addresses, public
keys, and hashes are unprefixed, case-sensitive base58. Signed transactions,
calldata, return data, and raw event topics stay `0x`-prefixed hex. Select a
client that supports the target's `wireFormat`.

Exchange and store addresses as base58. With client 0.24.0, `parseAddress` also
accepts a `C` StrKey and `addressToStrkey` produces one, but CLI 0.40.1 and later
accept only base58 or a Thruput `Z` StrKey. Do not display or store `C`
StrKeys.

Pubkey accounts, including hosted schema-4 bootstrap accounts, use DefaultWallet.
Local schema-5 manifests contain public allocations; applications and harnesses
own their signing keys. Preserve historical source-address wallet identities
when using `devWalletAdapter` rather than deriving replacement addresses.

## Read a contract

Verified on 2026-10-24 with Node.js 22, `@thruputchain/client` 0.24.0,
`@thruputchain/protocol` 0.19.0, TypeScript 6.0.3, and tsx 4.22.4.
The exact read and wallet examples passed type checks and local-node execution
with CLI 0.39.0, including observation failure and reload recovery. CLI 0.40.2
serves the same wire format with the same local runtime.

These renames keep no alias. Use the names your installed versions export:

| Version | Old name | New name |
| --- | --- | --- |
| protocol 0.19.0 | `HOG_ADDRESS` | `NATIVE_TOKEN_ADDRESS` |
| client 0.23.0 | `PrivateKeySigner` | `Ed25519Signer` (use `Ed25519Signer.fromSeed(seed)`) |
| client 0.24.0 | `groundhog_erc20_if` | `thruput_erc20_if` |

The CLI 0.40.2 counter-app template still pins client 0.22.0 and protocol
0.18.0. Use the older names there, or upgrade the project deliberately. Client
0.22.x event descriptors do not match native-token events on the current local
runtime.
Configure [GitHub Packages access](https://github.com/thruputchain/thruput-sdk-ts#registry-auth-one-time-setup),
then create a directory and install:

```sh
npm init -y
npm pkg set type=module
npm install --save-exact @thruputchain/client@0.24.0 @thruputchain/protocol@0.19.0
npm install --save-dev --save-exact typescript@6.0.3 tsx@4.22.4 @types/node@25.9.1
```

Start `thruput node` in another terminal. This example reads the native token
contract on the local network; no wallet, private key, or contract deployment is
needed. For Futurenet, replace `localnet()` with `devnet()` (client 0.24.0;
endpoint `https://rpc.thruput.network`). Pin a deployment with
`devnet({ networkHash })`. Docs that use `futurenet()` target the next client
release.

```ts title="read.ts"
import { createThruputClient, localnet, formatUnits } from "@thruputchain/client";
import { ERC20 } from "@thruputchain/client/contracts";
import { NATIVE_TOKEN_ADDRESS } from "@thruputchain/protocol";

async function main() {
  const client = await createThruputClient({ cluster: localnet() });
  const supply = await ERC20.v0_1.totalSupply.view({
    client,
    address: NATIVE_TOKEN_ADDRESS,
  });
  console.log("Native token supply:", formatUnits(supply.value, 7));
  console.log("Read at block:", supply.stateBlockHeight.toString());
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Read failed");
  process.exitCode = 1;
});
```

Run `npx tsx read.ts`. Expect a supply and a read height, not a fixed block number.
Keep amounts as `bigint`; `formatUnits` is for display. `parseUnits("0.0001", 7)`
produces `1000n` without rounding. `NATIVE_TOKEN_ADDRESS` is the native token contract.

## Wallet write with recovery

Use the same client/protocol versions in a browser app on HTTPS or localhost.
The wallet and RPC must use the same local network. Fund the sending account and
use a recipient that already holds the native token for this small-transfer
example. A new recipient also needs its balance-storage deposit.

For a Vite app, forward same-origin RPC requests to the local node. This avoids
depending on cross-origin access from the node's HTTP server:

```ts title="vite.config.ts"
import { defineConfig } from "vite";

export default defineConfig({
  server: { proxy: { "/rpc": { target: "http://127.0.0.1:9545", rewrite: () => "/" } } },
});
```

This single-tab module handles one unresolved transfer at a time. Call
`sendNativeToken(provider, receiver)` from the user's send action, with a base58
recipient address. Obtain `provider` through `discoverWalletProviders` from
`@thruputchain/client/provider` and let the user choose it. The example uses the
first account authorized by that wallet. See the
[wallet picker](https://thruput.network/docs/tools/wallet-integration/#discover-and-connect)
for account selection and discovery cleanup.

```ts title="wallet.ts"
import {
  createThruputClient, gasAmount, hashFromBase58, localnet, parseAddress,
  parseUnits, toBase58, TransactionExecutionError, TransactionObservationError,
  UnsupportedRpcValue,
} from "@thruputchain/client";
import { ERC20 } from "@thruputchain/client/contracts";
import {
  parseSignTransactionResult, parseWalletAccount, parseWalletNetworkHash,
  parseWalletSession, type WalletProvider,
} from "@thruputchain/client/provider";
import {
  createProviderWalletClient, type PendingWalletTransaction,
} from "@thruputchain/client/wallet";
import { NATIVE_TOKEN_ADDRESS } from "@thruputchain/protocol";

const client = await createThruputClient({
  cluster: localnet({ rpcUrl: new URL("/rpc", window.location.origin).href }),
});
const networkHash = toBase58(client.network.networkHash);
const storageKey = `native-transfer:v1:${networkHash}`;
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

export async function sendNativeToken(provider: WalletProvider, receiver: string) {
  if (sending || loadPending()) throw new Error("Inspect the existing transfer first");
  const recipient = parseAddress(receiver);
  sending = true;
  try {
    const session = parseWalletSession(await provider.request({ method: "connect" }));
    if (session.networkHash !== networkHash) throw new Error("Select the app network");
    const account = session.accounts[0];
    if (!account) throw new Error("No authorized account");
    const wallet = createProviderWalletClient({ client, provider, account, networkHash });
    try {
      const invocation = ERC20.v0_1.transfer.invocation(
        NATIVE_TOKEN_ADDRESS, gasAmount(500_000n),
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
        // Nothing was broadcast, for example because onSigned could not save.
        if (error.phase === "beforeSubmission") throw error.cause;
        return { state: "unobserved" as const, hash: toBase58(error.transactionHash) };
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
  const transactionHash = hashFromBase58(pending.hash);
  const status = await client.getTransactionStatus({ transactionHash });
  // A status this client does not recognize is not a commitment; keep the record.
  const committed = !(status instanceof UnsupportedRpcValue) && status.status === "committed";
  const receipt = committed ? await client.getTransactionReceipt({ transactionHash }) : null;
  return { hash: pending.hash, account: pending.account.address, status, receipt };
}

// Call only after displaying the committed outcome and the user acknowledges it.
export async function acknowledgeResult() {
  const result = await inspectPending();
  if (!result?.receipt) throw new Error("The transfer outcome is still unresolved");
  localStorage.removeItem(storageKey);
}
```

The SDK awaits `onSigned` before broadcast. Storage failure stops submission:
the SDK raises `TransactionObservationError` with `phase: "beforeSubmission"`,
meaning nothing was broadcast, so the example rethrows its cause rather than
reporting an unobserved transfer. The `submission` and `observation` phases
can follow a broadcast; keep their record and inspect it.
The saved record contains signed bytes, hash, original account, and network,
not a private key. A rejected signature creates no new record. A session change
invalidates the adapter; it never selects another signer automatically.

On `unobserved`, keep the record and call `inspectPending()` later, including
after reload. If inspection fails, retain the record and show the error. Do not
call `sendNativeToken` again to recover it. Before showing success, check
`!(receipt.execution instanceof UnsupportedRpcValue) &&
receipt.execution.result === "return"`. A committed receipt can describe an
`abort`, a `fault`, or an outcome this client does not recognize. An unresolved or corrupt saved record blocks new transfers
rather than silently discarding evidence.

The gas values are budgets for this example, not universal defaults. Gas has no
token fee; free native tokens supply scheduling capacity and storage requires
deposits.

## Generate bindings for your own contract

```sh
thruput build --bindings ts
thruput codegen ts target/thruput/my_contract.spec.xdr -o src/my-contract.ts
```

`thruput build --bindings ts` also writes `target/thruput/<name>.ts` and reports
it as `bindingsTs` in JSON output. `codegen` writes the bindings into your
source tree.

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
- The native token in hog-devnode 0.1.31-rc.16 emits `thruput-erc20-if` event
  topics. Filters built from the older `groundhog_erc20_if` descriptors no
  longer match; use `thruput_erc20_if` from client 0.24.0.
- Continue an opaque `nextCursor` with the same network, target, and filters.
  Stop when `nextCursor` is `null`, not on an empty page.
- Save event rows and progress together. For ascending ingestion, restart at the
  last saved row height and deduplicate by transaction hash and event sequence.
  A descending history page's oldest row is not a forward-ingestion checkpoint.
- `latestIndexedBlockHeight` is the indexer head. Check `oldestIndexedBlockHeight`
  for retained-history gaps.
- HTTP batching groups independent requests; it does not provide a shared
  snapshot, ordering, or atomicity. Await dependent operations separately.

See [event recovery](https://thruput.network/docs/typescript/events/#resume-without-missing-events)
and [transaction diagnostics](troubleshooting.md#inspect-the-original-transaction).
