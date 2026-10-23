#!/usr/bin/env bash
# Run only against the synthetic, deliberately unsafe fixtures in this repository.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 scripts/demo.py
