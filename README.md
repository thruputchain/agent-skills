# Thruput agent skills

Guidance for coding agents that build Thruput contracts and applications.

## Install

Requires Node.js 22.20 or newer, npm, Git, and access to this repository.
While the repository is private, configure Git credentials, authenticate with
`gh auth login`, or use an SSH key with repository access.

Install with the Thruput CLI. `thruput skill show` and `thruput skill list` read
`.agents/skills/thruput`. When you select agents with `--agent`, the CLI also
selects the `universal` agent so that this copy exists:

```sh
thruput skill install
thruput skill install --global --agent claude-code
```

Installation is project-local by default. Add `--global` for user-wide access.
Repeat `--agent` to select more agents. For unattended installation, pass the
agent and `--yes` explicitly. Update in the same scope:

```sh
thruput skill update
thruput skill update --global
```

To install without the CLI, include the `universal` agent so that the
`.agents/skills/thruput` copy exists:

```sh
npx skills@1.7.0 add thruputchain/agent-skills --skill thruput --agent <id> --agent universal
```

For a direct global refresh, rerun that `add` command with `--global --yes`.
`npx skills update --global` can exit successfully after a failed source check.

The installed skill follows this repository. The Thruput CLI reads the installed skill. Skill updates are independent of
CLI releases. Use the project's dependency
versions and installed CLI help when they differ from examples.

## Structure

`skills/thruput/SKILL.md` is the entry point. Its reference files cover
individual tasks. Keep common rules in the entry point and link to focused
references rather than requiring agents to read every file.

Validate the skill before submitting changes:

```sh
python3 scripts/check.py
```

Run the exact TypeScript and React blocks from the references:

```sh
THRUPUT_CLI=/absolute/path/to/thruput node scripts/check-examples.mjs
```

This requires Node.js 22, npm registry access, the Thruput CLI with its compatible
managed runtime, Chromium, and a free local port 9545. Set `CHROMIUM_PATH` if
Chromium is not at `/usr/bin/chromium`. The script creates temporary consumers,
installs the documented package versions without peer overrides, type-checks
the extracted examples, and runs them against isolated local nodes. It prints
the directory containing the extracted files and dependency lockfiles.

Checks cover public reads, React refresh and error states, signed evidence saved
before broadcast, failed observation, reload recovery without resubmission,
CLI inspection of the same hash, signature rejection, and persistence failure. Wallet tests use a controlled
provider with real local transactions; they do not require an installed extension.

Verify API claims against the owning Thruput source and test representative
contract and application tasks. The source files here are maintained directly;
the CLI does not bundle a second copy.
