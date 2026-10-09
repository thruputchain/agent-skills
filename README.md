# Thruput agent skills

Guidance for coding agents that build Thruput contracts and applications.

## Install

Requires Node.js 22.20 or newer, npm, Git, and access to this repository.
While the repository is private, configure Git credentials, authenticate with
`gh auth login`, or use an SSH key with repository access.

```sh
npx skills add groundhogchain/agent-skills --skill thruput
```

Installation is project-local by default. Add `--global` for user-wide access,
or `--agent opencode` to select an agent. For unattended installation, select
the agent and add `--yes` explicitly.

```sh
npx skills update thruput --project
npx skills update thruput --global
```

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
