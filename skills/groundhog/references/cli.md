# CLI

This reference covers Groundhog CLI 0.24.0 with schema-4 local manifests and
RPC wire format 10. Run `groundhog --version` and the command's `--help` to
check the installed build; these contracts can change independently of the
CLI package version.

## Local development

```sh
groundhog init
groundhog new my-counter
cd my-counter
cargo test
groundhog build
groundhog test
```

`init` configures the toolchain, profile, and key selection. It can prompt for
registry access. `status --json` inspects setup without changing it. Keep the
generated Cargo configuration and RV32 wrapper.

Start `groundhog node` in a separate terminal. It selects a compatible managed
runtime. Use `groundhog toolchain list --json` to inspect available versions and
installation state. `GROUNDHOG_DEVNODE_BINARY` is for an explicit compatible
runtime build. A compatibility error needs diagnosis, not a protocol override.

An ephemeral node loses state when restarted. Use the CLI's persistent-node
options when the application needs its deployments across restarts. Read the
[local-node guide](https://docs.groundhog.dev/cli/local-node/).

Local accounts use ordinary stored keys. `groundhog node --key alice` gives
that key's nonce-zero native account an initial allocation of 100 HOG. With no
selected key, the node starts only its random private faucet. Names such as
`dev-1` are ordinary key names, not implicit local bootstrap identities.

Schema-4 local manifests contain public allocations, not user signing seeds.
Harnesses retain their own fixture signers and pass public allocations through
`--bootstrap-accounts FILE`. Never use fixture keys in production. Persistent
chain state and dumps retain the private faucet and its funding journal; older
local state requires its original runtime and CLI. Hosted schema-3 bootstrap
derivation is separate from local accounts.

For uncertain local funding, retain the original recipient, amount, and request
nonce. Retry the same request rather than creating a second funding operation.
Inspect any reported transaction hash on the original network.

## Keys and wallets

Keep private keys in the CLI key store. `groundhog keys import <name>` accepts a
seed through hidden input or stdin, not a command-line argument. A public key is
not a wallet address; inspect the selected account with the wallet commands.

Wallet creation, selection, address inspection, and status ownership checks use
cached public metadata without loading the private signer. Older key files may
derive missing metadata from the stored keypair. Transaction commands still load
the signer and verify wallet ownership.

`groundhog wallet create` saves an account identity. Fund it explicitly with
`groundhog airdrop` on a test network. Select the intended profile on commands
that access the network. Never use deterministic local test keys outside a local
test environment.

For simulated caller checks, `groundhog view --from ADDRESS` supplies the caller.
It also accepts saved wallets, stored keys, and contract aliases. Saved wallets
take precedence and retain their native nonce or legacy address. Omitting
`--from` leaves the simulated caller unset. A selected signing wallet does not
implicitly become the view caller.

## Deploy and initialize

Use `groundhog deploy --help` for the artifact argument and network options.
Deployment requires an explicit `--fund <HOG>` storage-funding amount; zero skips
the transfer. The CLI does not estimate this amount.

Add `--init <METHOD>` and repeated `--init-arg <VALUE>` to initialize atomically
with funding and deployment. The contract spec supplies argument types.
`--init-gas-limit` sets the child-call budget. The initializer runs as the wallet;
failure rolls back the operation. A dry run submits nothing.

Keep the original hash and predicted address if confirmation fails. Follow
[transaction inspection](troubleshooting.md#inspect-the-original-transaction)
before creating another deployment.

## Inspect transactions and events

```sh
groundhog tx show TX_HASH --profile local --json
groundhog events list CONTRACT_ADDRESS --profile local --limit 25 --json
```

Replace the uppercase values with the original hash and contract address. Use
the transaction's original profile/network. `tx show` performs one lookup and
fetches a receipt when committed; it does not wait or resubmit.

An indexed committed record takes precedence over scheduler outcomes. A
`committed` status can omit height until indexing catches up. `retry` means
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
`--generate-key`, and protected actions need an explicitly authorized `--force`.
`--quiet` only controls output. Never collect private-key exports in logs.

Use the [diagnostic table](troubleshooting.md) when setup or execution fails.
