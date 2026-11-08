# codeMAX

codeMAX is a fork of [T3 Code](https://github.com/pingdotgg/t3code) that follows upstream's
**stable** releases and adds my own changes on top. It installs and runs next to the official
T3 Code app without sharing anything with it.

## Branches

| Branch       | What it is                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------- |
| `main`       | Exact mirror of upstream `main`. Never commit here.                                           |
| `fork/infra` | Fork-only changes: app identity, these workflows, this file. Never sent upstream.             |
| `feat/*`, `fix/*` | One change each, branched from upstream `main`, so each can become an upstream PR.       |
| `codemax`    | **Generated.** Latest upstream stable tag + every branch in `.codemax/branches.txt`. Default branch; releases build from it. Never commit here. |

`scripts/codemax/sync.sh` rebuilds `codemax`: it starts from the newest `vX.Y.Z` upstream tag and
cherry-picks each listed branch's own commits on top. The **codeMAX Sync** workflow runs it every
3 hours and starts **codeMAX Release** when an upstream version has no codeMAX release yet.

## Everyday work

```sh
# New change (also a future upstream PR)
git fetch upstream
git switch -c feat/my-thing upstream/main
# ...commit...
git push -u origin feat/my-thing
echo "feat/my-thing" >> .codemax/branches.txt   # on fork/infra, then commit + push fork/infra

# Rebuild codemax locally to try it (doesn't touch your checkout)
scripts/codemax/sync.sh
```

Your changes reach the installed app with the next upstream stable release (every few days),
because codeMAX uses upstream's exact version numbers. To try something immediately, build locally
(`vp run dist:desktop:dmg:arm64` on the `codemax` branch) and open the DMG from `release/`.

**When upstream ships its own version of a feature, or merges your PR:** delete that line from
`.codemax/branches.txt`. Nothing else to clean up.

**When a sync fails (conflict):** you get an email about the failed run. The log names the branch and
the exact `git rebase --onto` command. Rebase that branch onto the new tag, resolve, push, and re-run
**codeMAX Sync** (Actions tab → Run workflow). `git rerere` is enabled, so a resolution is reused.

## How it stays separate from T3 Code

| | T3 Code | codeMAX |
| - | - | - |
| App name / bundle ID | T3 Code (Beta) / `com.t3tools.t3code` | codeMAX / `me.maxym.codemax` |
| Data (settings, DB, worktrees, logs) | `~/.t3` | `~/.codemax` |
| Electron profile, keychain entry | `~/Library/Application Support/t3code-v2` | `~/Library/Application Support/codemax` |
| Background service | `com.t3tools.t3code.service` | `me.maxym.codemax.service` |
| `t3code://` links | registered | not registered (links open T3 Code) |
| Updates from | pingdotgg/t3code releases | Maxymvs/codeMAX releases |
| Icon | stable icon | nightly icon |

The renderer keeps the internal `t3code://app` origin on purpose: remote T3 servers (SSH,
T3 Connect) only accept that origin. Don't use **Install `t3` command** in codeMAX; it would
shadow T3 Code's `t3` on your PATH.

## Secrets (already configured)

Repository → Settings → Secrets and variables → Actions. To rotate one, replace it there:

| Secret | Value |
| - | - |
| `CODEMAX_SYNC_SSH_KEY` | Private half of the write **deploy key** "codeMAX Sync (Actions)" (Settings → Deploy keys). GITHUB_TOKEN cannot push workflow-file changes; a deploy key can. |
| `CSC_LINK` | `base64 -i DeveloperID.p12` (Developer ID Application certificate + key) |
| `CSC_KEY_PASSWORD` | Password of that `.p12` |
| `APPLE_API_KEY` | Contents of the App Store Connect API key `AuthKey_XXXX.p8` |
| `APPLE_API_KEY_ID` | That key's ID |
| `APPLE_API_ISSUER` | Issuer ID (App Store Connect → Users and Access → Integrations) |
| `APPLE_TEAM_ID` | 10-character Team ID |
| `MACOS_PROVISIONING_PROFILE` | `base64 -i codeMAX.provisionprofile`: a **Developer ID** profile for App ID `me.maxym.codemax` with the **Associated Domains** capability |
