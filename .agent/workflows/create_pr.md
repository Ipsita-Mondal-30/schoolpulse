---
description: Automatically branch, commit, push, create, and conditionally merge a Pull Request
---
# Create PR Workflow

This workflow automates the repetitive process of creating and merging a Pull Request for the user's current changes.
It handles checking out a new branch, staging files, committing with a standard message, pushing to the remote, and opening a PR via the GitHub CLI.

**IMPORTANT:** This workflow handles merging the PR, but ONLY after explicitly asking the user for confirmation and receiving a 'y' or similar positive response.

## Steps

1. Check the current git status to identify modified/untracked files.
2. If on the `main` branch, automatically checkout a new feature branch (`feature/<descriptive-name>`) based on the context of the uncommitted changes.
3. Add all modified and untracked files to staging.
4. Commit the changes using Conventional Commits format (e.g., `feat: ...`, `fix: ...`, `docs: ...`).
5. Push the branch to the remote origin.
6. Create a Pull Request using `gh pr create --title "<commit-title>" --body "<description>"`.
7. Return the PR link to the user and **ASK for explicit permission to merge.**
8. If the user replies with 'y' or approves, check if they explicitly said "keep for the future".
    - If they **did not** say "keep for the future" (default behavior): use `gh pr merge --merge --delete-branch` to merge the PR and clean up the branch.
    - If they **did** say "keep for the future":
        1. Use `gh pr merge --merge` (WITHOUT `--delete-branch`) to merge the PR but keep the branch.
        2. Create a git tag on the current commit to mark it (e.g., `git tag upcoming-feature-<name>`).
        3. Push the tag to remote: `git push origin --tags`.

// turbo-all
