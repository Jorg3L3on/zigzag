#!/usr/bin/env bash
# Create GitHub labels for Zigzag agent workflow.
# Requires: gh CLI (https://cli.github.com/) and `gh auth login`
set -euo pipefail

REPO="${GITHUB_REPOSITORY:-Jorg3L3on/zigzag}"

create_label() {
  local name="$1"
  local color="$2"
  local description="$3"
  if gh label list --repo "$REPO" --json name --jq ".[].name" 2>/dev/null | grep -qx "$name"; then
    echo "exists: $name"
  else
    gh label create "$name" --repo "$REPO" --color "$color" --description "$description"
    echo "created: $name"
  fi
}

echo "Creating labels on $REPO ..."

# Triage (agent workflow)
create_label "needs-triage" "ededed" "Maintainer needs to evaluate"
create_label "needs-info" "d4c5f9" "Waiting on reporter"
create_label "ready-for-agent" "0e8a16" "Fully specified; ready for AFK agent"
create_label "ready-for-human" "fbca04" "Requires human implementation"
create_label "wontfix" "ffffff" "Will not be actioned"

# Change type
create_label "type:feature" "a2eeef" "New feature or enhancement"
create_label "type:bug" "d73a4a" "Bug fix"
create_label "type:chore" "cfd3d7" "Refactor, tooling, or maintenance"
create_label "type:docs" "0075ca" "Documentation only"

# Status (optional)
create_label "status:in-progress" "1d76db" "Actively being worked"

echo "Done."
