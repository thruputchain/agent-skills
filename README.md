# Groundhog agent skills

Guidance for coding agents that build Groundhog contracts and applications.

## Install

Requires Node.js 22.20 or newer, npm, Git, and access to this repository.
While the repository is private, configure Git credentials, authenticate with
`gh auth login`, or use an SSH key with repository access.

```sh
npx skills add groundhogchain/agent-skills --skill groundhog
```

Installation is project-local by default. Add `--global` for user-wide access,
or `--agent opencode` to select an agent. For unattended installation, select
the agent and add `--yes` explicitly.

```sh
npx skills update groundhog --project
npx skills update groundhog --global
```

The installed skill follows this repository. The Groundhog CLI also bundles
a selected snapshot for offline, release-matched guidance. Those snapshots
can differ from the latest installed skill. Use the project's dependency
versions and installed CLI help when they differ from examples.

## Structure

`skills/groundhog/SKILL.md` is the entry point. Its reference files cover
individual tasks. Keep common rules in the entry point and link to focused
references rather than requiring agents to read every file.

Validate the skill before submitting changes:

```sh
python3 scripts/check.py
```

Verify API claims against the owning Groundhog source and test representative
contract and application tasks. The source files here are maintained directly;
CLI bundles are imported copies, not a second editable source.
