---
name: release
description: >-
  Cut a semver release: update CHANGELOG and package.json, tag vX.Y.Z, create GitHub
  Release. Use for release 1.2.0 or ship version to production users.
user-invocable: true
---

# Release

Prepare a **semver** release on **`main`**: CHANGELOG, version bump, git tag, GitHub Release.

Read [docs/agents/workflow.md](../../docs/agents/workflow.md) and [CHANGELOG.md](../../CHANGELOG.md).

## Preconditions

1. `main` reflects what you want to ship (feature PRs merged).
2. `gh` authenticated.
3. User provides target version **`X.Y.Z`** (e.g. `1.2.0`).

## Version rules (SemVer)

| Change | Bump |
| ------ | ---- |
| Bug fixes only | PATCH (`1.0.1`) |
| New features, backward compatible | MINOR (`1.1.0`) |
| Breaking changes | MAJOR (`2.0.0`) |

## Process

### 1. Confirm version

User supplies `X.Y.Z`. If missing, infer from CHANGELOG `[Unreleased]` or ask once.

### 2. Update CHANGELOG

Move **`## [Unreleased]`** entries into:

```markdown
## [X.Y.Z] - YYYY-MM-DD
```

Leave a fresh empty `## [Unreleased]` section at the top.

### 3. Bump `package.json`

Set `"version": "X.Y.Z"` to match the tag.

### 4. Verify on `main`

```bash
git checkout main && git pull
npm run lint
npm test -- --runInBand
npm run build
```

### 5. Commit (only when user asked to release / commit)

```bash
git add CHANGELOG.md package.json
git commit -m "$(cat <<'EOF'
chore(release): vX.Y.Z

EOF
)"
```

### 6. Tag and push

```bash
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin main
git push origin vX.Y.Z
```

### 7. GitHub Release

```bash
gh release create vX.Y.Z --title "vX.Y.Z" --notes "$(cat <<'EOF'
<paste the ## [X.Y.Z] section from CHANGELOG.md>
EOF
)"
```

### 8. Hand off

Tell the user:

- Tag and Release URLs
- Production deploy follows `main` on Vercel
- Run `npm run migrate:deploy` manually if the release includes schema migrations

## Policies

| Action | Allowed? |
| ------ | -------- |
| Edit CHANGELOG + package.json | Yes |
| Commit / tag / push | **Only** when user explicitly requests |
| `gh release create` | Yes when cutting the release |
| Merge feature branches | No — release assumes `main` is ready |

## Example

```text
/release 1.2.0
```
