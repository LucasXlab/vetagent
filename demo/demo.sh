#!/usr/bin/env bash
# agentvet demo: install, run against a deliberately sloppy agent config, show the report.
# Run from the repository root:  bash demo/demo.sh
set -euo pipefail

cd "$(dirname "$0")/.."

# Make the locally built CLI available as `agentvet` (what users get from npm).
npm link --silent

echo "\$ agentvet --path demo/fixtures"
echo
agentvet --path demo/fixtures
echo
echo "\$ agentvet --path demo/fixtures --json | head -30"
agentvet --path demo/fixtures --json | head -30
