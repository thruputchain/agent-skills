# Contributing

`skills/thruput/SKILL.md` is the entry point. Keep shared rules there and task
guidance in the linked references. Verify API claims against the owning Thruput
source and the dependency versions used by each example.

## Checks

Validate the skill and its local links:

```sh
python3 scripts/check.py
```

Run the TypeScript and React examples from the references:

```sh
THRUPUT_CLI=/absolute/path/to/thruput node scripts/check-examples.mjs
```

This requires Node.js 22, public npm access, a CLI with its compatible managed
runtime, Chromium, and a free local port 9545. Set `CHROMIUM_PATH` if Chromium
is not at `/usr/bin/chromium`.

The script installs the documented packages in temporary consumers, checks
types, and runs the extracted examples against isolated local nodes. It prints
the directory containing the examples and dependency lockfiles. Wallet checks
use a controlled provider with real transactions; no browser extension is needed.

Check representative contract and application tasks when their guidance changes.
Keep generated files and local test output out of commits.
