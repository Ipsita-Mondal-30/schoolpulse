# Git Push & Create PR

Push changes to GitHub and create a Pull Request.

## Steps

1. **Check for changes**: Run `git status` to see what has changed. If there are no changes (working tree clean and no new commits to push), inform the user and stop.

2. **Determine branch name**: Run `git branch --show-current` to get the current branch name. If on `main`, create a new branch with a descriptive name based on the changes (e.g., `feature/short-description` or `fix/short-description`).

3. **Stage all changes**: Run `git add -A` to stage all changes.

4. **Commit**: Run `git commit -m "<descriptive commit message>"` with a clear, concise commit message summarizing the changes. If there are no staged changes but there are unpushed commits, skip this step.

5. **Push to GitHub**: Run `git push origin <branch-name>` to push the branch. If the branch doesn't exist on the remote yet, use `git push -u origin <branch-name>`.

6. **Create Pull Request**: Run `gh pr create --title "<PR title>" --body "<PR description>" --base main` to create a PR. The title should be descriptive and the body should summarize all changes made. If a PR already exists for this branch, run `gh pr view --web` instead and provide the existing PR URL.

7. **Provide the PR link**: After creating the PR, provide the full PR URL to the user. Get it by running `gh pr view --json url --jq '.url'`.

## Important Notes
- Always use `gh` CLI for PR creation (it's already authenticated)
- The remote is `origin` pointing to `https://github.com/sreedhargs89/schoolpulse.git`
- Default base branch for PRs is `main`
- If $ARGUMENTS is provided, use it as the commit message
