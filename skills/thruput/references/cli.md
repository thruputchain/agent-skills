# CLI

CLI 0.39.0 serves RPC wire format 14.1.1 and reads schema-5 local runtime
manifests. Run `thruput --version` and the command's `--help` to check the
installed build; these contracts can change independently of the CLI package
version.

## Local development

```sh
thruput init
thruput new my-counter
cd my-counter
cargo test
thruput build
thruput test
```

`init` initializes global profiles and checks for Cargo and a selected signing
key. Interactive sessions offer key generation and project scaffolding. It does
not configure Cargo registry access. If `status` reports `no_registry`, the
Cargo config has no `[registries.thruput]` section: add it first, then run
`cargo login --registry thruput` for credentials. `status --json` inspects setup without
changing it. Keep the generated Cargo configuration and RV32 wrapper.

`init` records the native token contract under the alias `NATIVE_TOKEN`.
CLIs before 0.39.0 wrote `HOG`. That alias still resolves but is no longer
maintained; rename it in `config.toml`.

Start `thruput node` in a separate terminal. It selects a compatible managed
runtime. Use `thruput toolchain list --json` to inspect available versions and
installation state. `THRUPUT_DEVNODE_BINARY` is for an explicit compatible
runtime build. A compatibility error needs diagnosis, not a protocol override.

An ephemeral node loses state when restarted. Pass `--data-dir DIR` when the
application needs its deployments across restarts. Read the
[local-node guide](https://docs.thruput.network/cli/local-node/).

Local accounts use ordinary stored keys. On a fresh chain, `thruput node`
gives the selected Ed25519 key's nonce-zero native account an initial
allocation of 100 native tokens. `--key alice` selects a different stored key,
and `--initial-account-tokens <AMOUNT>` changes the allocation. An ML-DSA-65 key
gets no allocation; fund it with `thruput airdrop` on the local profile. With no selected
key, the node starts only its random private faucet. Names such as `dev-1` are
ordinary key names, not implicit local bootstrap identities.

Schema-5 local manifests contain public allocations, not user signing seeds.
Harnesses retain their own fixture signers and pass public allocations through
`--bootstrap-accounts FILE`, which conflicts with `--key` and
`--initial-account-tokens`. Never use fixture keys in production. Persistent
chain state and dumps retain the private faucet and its funding journal; older
local state requires its original runtime and CLI. Hosted schema-4 runtime
manifests keep a separate deterministic bootstrap derivation; it does not apply
to local accounts.

For uncertain local funding, retain the original recipient, amount, and request
nonce. Retry the same request rather than creating a second funding operation.
Inspect any reported transaction hash on the original network.

## Keys and wallets

Keep private keys in the CLI key store. `thruput keys import <name>` accepts a
seed through hidden input or stdin, not a command-line argument. A public key is
not a wallet address; inspect the selected account with the wallet commands.

Wallet creation, selection, address inspection, and status ownership checks use
cached public metadata without loading the private signer. Older key files may
derive missing metadata from the stored keypair. Transaction commands still load
the signer and verify wallet ownership.

`thruput wallet create` saves an account identity. Fund it explicitly with
`thruput airdrop` on a test network. Select the intended profile on commands
that access the network. Never use deterministic local test keys outside a local
test environment.

For simulated caller checks, `thruput view --from ADDRESS` supplies the caller.
It also accepts saved wallets, stored keys, and contract aliases. Saved wallets
take precedence and retain their native nonce or legacy address. Omitting
`--from` leaves the simulated caller unset. A selected signing wallet does not
implicitly become the view caller.

## Deploy and initialize

Use `thruput deploy --help` for the artifact argument and network options.
Use `--estimate` to inspect deployment storage funding without signing or
submitting. Deploy with an explicit `--fund <AMOUNT|minimum>` amount in native
tokens; zero skips the transfer.

Add `--init <METHOD>` and repeated `--init-arg <VALUE>` to initialize atomically
with funding and deployment. The contract spec supplies argument types.
`--init-gas-limit` sets the child-call budget. The initializer runs as the wallet;
failure rolls back the operation. A dry run submits nothing.

Keep the original hash and predicted address if confirmation fails. Follow
[transaction inspection](troubleshooting.md#inspect-the-original-transaction)
before creating another deployment.

## Inspect transactions and events

```sh
thruput tx show TX_HASH --profile local --json
thruput events list CONTRACT_ADDRESS --profile local --limit 25 --json
```

Replace the uppercase values with the original hash and contract address. Use
the transaction's original profile/network. `tx show` performs one lookup and
fetches a receipt when committed; it does not wait or resubmit.

An indexed committed record takes precedence over scheduler outcomes. A
`committed` status includes its block height. `retry` means
resubmitting the same transaction may succeed; the mempool does not retry it
automatically. `dropped` requires changing the transaction before resubmission.
Use the reported error source and code to diagnose the cause.

`events list`, `tx list`, and `token transfers` return newest-first pages.
Continue with the returned cursor and the same target/filters; omit the cursor
to refresh from the head. Address transaction history matches root targets,
which can be wallets rather than the application contract. Absence from such a
list does not prove that a call failed.

## Automation

Use `--json` for structured results and `--non-interactive` to disable prompts.
Non-interactive mode does not grant consent: key generation needs
`--generate-key`, and protected actions need an explicitly authorized `--yes`.
Without a terminal, `wallet create`, `airdrop`, `deploy`, `call`, `transfer`,
and `keys export` need it, as do removals and chain restore. CLIs released
before `--yes` accept only `--force`; newer CLIs keep `--force` as an alias. A
`confirmation_required` error's `details.requiredFlag` names the flag the
installed CLI accepts.
`--quiet` only controls output. Never collect private-key exports in logs.

CLI 0.39.0 renamed HOG fields in `--json` output: `amountHog` is now
`amountTokens`, `balanceHog` is `balanceTokens`, and `fundingHog` and
`minimumFundingHog` are `fundingTokens` and `minimumFundingTokens`. The
`invalid_hog_amount` error code is now `invalid_native_token_amount`. Update
scripts that parse the old names.

Use the [diagnostic table](troubleshooting.md) when setup or execution fails.
