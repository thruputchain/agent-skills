# React

## Read a contract

Verified on 2026-10-05 with the published compatible pair `@groundhogchain/react` 0.3.1
and `@groundhogchain/client` 0.11.0, with protocol 0.12.0, React/React DOM 19.1.1,
and TanStack Query 5.103.1. The exact example passed type checks and local-node
browser checks for reads, refresh, and errors using CLI 0.22.1.
The React package requires React 19 and TanStack Query
5.90.1 or newer within v5. Keep its client peer requirement when installing.

In a Vite React TypeScript app, configure
[GitHub Packages access](https://github.com/groundhogchain/client-ts#registry-auth-one-time-setup)
and install:

```sh
npm install --save-exact @groundhogchain/react@0.3.1 @groundhogchain/client@0.11.0 @groundhogchain/protocol@0.12.0 @tanstack/react-query@5.103.1 react@19.1.1 react-dom@19.1.1
```

Start `groundhog node` in another terminal. Keep the app's `<div id="root"></div>`
and configure a same-origin development proxy in `vite.config.ts`:

```ts title="vite.config.ts"
import { defineConfig } from "vite";

export default defineConfig({
  server: { proxy: { "/rpc": { target: "http://127.0.0.1:9545", rewrite: () => "/" } } },
});
```

Replace `src/main.tsx` with the following. No wallet connection or private key
is needed for this read. For a hosted network, use that network's configured
cluster instead of `localnet()`.

```tsx title="main.tsx"
import { createRoot } from "react-dom/client";
import { createGroundhogClient, formatUnits, localnet } from "@groundhogchain/client";
import { ERC20 } from "@groundhogchain/client/contracts";
import { HOG_ADDRESS } from "@groundhogchain/protocol";
import { WalletProvider, useContractView } from "@groundhogchain/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function HogSupply() {
  const supply = useContractView({
    method: ERC20.v0_1.totalSupply,
    contract: HOG_ADDRESS,
  });
  return (
    <section>
      <h1>HOG supply</h1>
      {supply.isLoading ? <p role="status">Loading supply…</p> : null}
      {supply.error ? <p role="alert">{supply.error.message}</p> : null}
      {supply.data ? (
        <>
          <p>{formatUnits(supply.data.value, 7)} HOG</p>
          <p>Read at block {supply.data.height.toString()}</p>
        </>
      ) : !supply.isLoading && !supply.error ? <p>No result yet.</p> : null}
      <button disabled={supply.isFetching} onClick={() => void supply.refetch()}>
        {supply.isFetching ? "Reading…" : "Refresh"}
      </button>
    </section>
  );
}

const element = document.getElementById("root");
if (!element) throw new Error("Missing root element");
const root = createRoot(element);

async function main() {
  const client = await createGroundhogClient({
    cluster: localnet({ rpcUrl: new URL("/rpc", window.location.origin).href }),
  });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  root.render(
    <QueryClientProvider client={queries}>
      <WalletProvider client={client}>
        <HogSupply />
      </WalletProvider>
    </QueryClientProvider>,
  );
}

main().catch((error: unknown) => {
  root.render(<p role="alert">{error instanceof Error ? error.message : "Connection failed"}</p>);
});
```

Run the app's `npm run dev`. Expect a supply and block height. Refresh performs
another view. The screen shows connection and query errors; during a failed
refresh, any retained data still has its original read height.

`WalletProvider` supplies the public client even while disconnected.
`QueryClientProvider` supplies the cache required by read and execution hooks.
Both clients are created once before rendering. The hook forwards cancellation
and keeps quantities as `bigint` until formatting.

## Add writes

Connect through `useWallet()` and enable writes only while its status is
`connected`. Use `useExecute` or `useWalletClient()` from an explicit user action.
Persist signed evidence in `onSigned` before broadcast. Keep its original network,
account, and hash after errors or disconnect; use `useWaitForTransactionReceipt`
to resume observation without requesting a new signature.

A committed execution failure is receipt data, not a failed query. Inspect
`execResult`. See the [wallet persistence example](typescript.md#wallet-write-with-recovery)
for the storage and recovery boundary, using the client version selected by this
React package.

- [Package setup and wallet usage](https://github.com/groundhogchain/react#configure-the-application)
- [Contract reads and execution guide](https://github.com/groundhogchain/react/blob/main/docs/contract-transactions.md)
- [React documentation](https://docs.groundhog.dev/react/)
