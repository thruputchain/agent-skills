# Thruput agent skills

Open-source agent skills for building Project Thruput contracts and applications.

## Install

Requires the [Thruput CLI](https://www.thruput.network/docs/cli/install/),
Node.js 22.20 or newer, npm, and Git.

```sh
thruput skill install
```

Installation is project-local by default. Add `--global` for user-wide access.

## Update

```sh
thruput skill update
```

Use `--global` to update a global installation. Skill updates are independent of
CLI releases. Run `thruput skill install --help` for agent selection and automation options.

## Contribute

Start with [the skill](skills/thruput/SKILL.md). See [Contributing](CONTRIBUTING.md)
for editing and validation instructions.
