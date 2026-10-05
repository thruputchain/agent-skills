# CLI

Command examples use Groundhog CLI 0.22.1. Run `groundhog --version` and the
command's `--help` when checking another installed version.

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

## Keys and wallets

Keep private keys in the CLI key store. `groundhog keys import <name>` accepts a
seed through hidden input or stdin, not a command-line argument. A public key is
not a wallet address; inspect the selected account with the wallet commands.

`groundhog wallet create` saves an account identity. Fund it explicitly with
`groundhog airdrop` on a test network. Select the intended profile on commands
that access the network. Never use deterministic local test keys outside a local
test environment.

For simulated caller checks, `groundhog view --from ADDRESS` supplies the caller.
Omitting `--from` leaves the simulated caller unset. A selected signing wallet
does not implicitly become the view caller.

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
