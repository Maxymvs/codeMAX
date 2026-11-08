#!/usr/bin/env bash
# Rebuilds the `codemax` branch from the latest upstream stable tag plus the branches listed in
# .codemax/branches.txt (read from origin/fork/infra), using a temporary worktree so your current
# checkout is left alone.
#
#   scripts/codemax/sync.sh                 # rebuild local `codemax` from the latest stable tag
#   scripts/codemax/sync.sh --tag v0.1.7    # rebuild from a specific upstream tag
#   scripts/codemax/sync.sh --push          # also push `codemax` and mirror upstream main to origin/main
#
# Outputs `version`, `tag` and `changed` to $GITHUB_OUTPUT when run in GitHub Actions.
set -euo pipefail

UPSTREAM_URL="https://github.com/pingdotgg/t3code.git"
TARGET_BRANCH="codemax"
LIST_REF="origin/fork/infra"
LIST_PATH=".codemax/branches.txt"

tag=""
push=false
while (($# > 0)); do
  case "$1" in
    --tag) tag="${2:?--tag needs a value}"; shift 2 ;;
    --push) push=true; shift ;;
    -h | --help) sed -n '2,10p' "$0"; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

die() { echo "error: $*" >&2; exit 1; }
output() { [[ -n "${GITHUB_OUTPUT:-}" ]] && echo "$1=$2" >> "$GITHUB_OUTPUT"; return 0; }

cd "$(git rev-parse --show-toplevel)"

if [[ "$(git branch --show-current)" == "$TARGET_BRANCH" ]]; then
  die "you are on '$TARGET_BRANCH'; switch to another branch first (it is rebuilt, never edited)."
fi

git remote get-url upstream > /dev/null 2>&1 || git remote add upstream "$UPSTREAM_URL"
git config remote.origin.tagOpt --no-tags # the fork's release tags must not shadow upstream's
echo "Fetching upstream and origin..."
git fetch --quiet --force --tags upstream '+refs/heads/main:refs/remotes/upstream/main'
git fetch --quiet --prune --no-tags origin '+refs/heads/*:refs/remotes/origin/*'

if [[ -z "$tag" ]]; then
  tag="$(git tag -l 'v*' --sort=-v:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -n 1)"
  [[ -n "$tag" ]] || die "no upstream stable tag found."
fi
git rev-parse --verify -q "refs/tags/$tag^{commit}" > /dev/null || die "unknown upstream tag $tag."
version="${tag#v}"
echo "Building $TARGET_BRANCH from upstream $tag"

branches="$(git show "$LIST_REF:$LIST_PATH" 2> /dev/null)" || die "cannot read $LIST_PATH from $LIST_REF."

worktree="$(mktemp -d "${TMPDIR:-/tmp}/codemax-sync.XXXXXX")"
cleanup() {
  git -C "$worktree" cherry-pick --abort > /dev/null 2>&1 || true
  git worktree remove --force "$worktree" > /dev/null 2>&1 || true
  rm -rf "$worktree"
}
trap cleanup EXIT
git worktree add --quiet --detach "$worktree" "$tag"

while IFS= read -r line; do
  branch="${line%%#*}"
  branch="$(echo "$branch" | xargs)"
  [[ -n "$branch" ]] || continue
  ref="origin/$branch"
  git rev-parse --verify -q "$ref^{commit}" > /dev/null || die "branch '$branch' is not on origin. Push it first."
  base="$(git merge-base "$ref" upstream/main)"
  count="$(git rev-list --count --no-merges "$base..$ref")"
  echo "  applying $branch ($count commits)"
  ((count > 0)) || continue
  if ! git -C "$worktree" cherry-pick --empty=drop --no-merges "$base..$ref" > /dev/null; then
    conflicted="$(git -C "$worktree" diff --name-only --diff-filter=U | sed 's/^/    /')"
    die "$branch does not apply cleanly on $tag. Conflicting files:
$conflicted
Fix it by rebasing the branch onto the tag, resolving, and pushing:
    git switch $branch && git rebase --onto $tag $base && git push --force-with-lease
then run this script again. (git rerere remembers your resolutions for next time.)"
  fi
done <<< "$branches"

new_head="$(git -C "$worktree" rev-parse HEAD)"
changed=true
if git rev-parse --verify -q "refs/remotes/origin/$TARGET_BRANCH" > /dev/null &&
  [[ "$(git rev-parse "$new_head^{tree}")" == "$(git rev-parse "origin/$TARGET_BRANCH^{tree}")" ]]; then
  changed=false
fi
git branch --force "$TARGET_BRANCH" "$new_head"
echo "Local '$TARGET_BRANCH' is now $(git rev-parse --short "$new_head") (upstream $tag, changed: $changed)"

if $push; then
  # Keep the fork's main an exact mirror of upstream main (fast-forward only).
  git push --quiet origin "refs/remotes/upstream/main:refs/heads/main"
  if $changed; then
    git push --quiet --force origin "$TARGET_BRANCH:refs/heads/$TARGET_BRANCH"
    echo "Pushed $TARGET_BRANCH."
  else
    echo "Nothing changed; $TARGET_BRANCH not pushed."
  fi
fi

output tag "$tag"
output version "$version"
output changed "$changed"
