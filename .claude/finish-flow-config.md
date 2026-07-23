# Finish Flow — Project Config

## Integration target

- Merge feature and fix work into `develop`.
- Merge release-ready `develop` into `main` only during a release flow.

## Mandatory post-merge cleanup gate

A flow that created a branch or worktree is **not complete** until its merged branch and temporary worktree are gone. This applies to L-size `L-5.7`, hotfix `H-9.5`, fix `F.5`, and any equivalent project flow.

1. Verify the exact branch is contained by the integration target with `git merge-base --is-ancestor <branch> develop`.
2. Inspect `git worktree list --porcelain`. If the branch is checked out, first verify that worktree is clean, then switch a primary worktree to `develop` or remove a temporary worktree with `git worktree remove <exact-path>`. A dirty worktree blocks cleanup.
3. Delete the local branch with `git branch -d <branch>`; never use `-D` as routine cleanup.
4. Check the remote with `git ls-remote --heads origin refs/heads/<branch>` and delete it with `git push origin --delete <branch>` when present.
5. Re-run all three inventories. Completion evidence must show:
   - the branch absent from `git branch --list <branch>`;
   - no remote ref from `git ls-remote --heads origin refs/heads/<branch>`;
   - no task path in `git worktree list`.

If a branch is unmerged, dirty, checked out, or owned by another active workflow, preserve it with its exact tip and reason. Report it as an explicit follow-up; do not claim the flow is fully cleaned.

At session end, also list merged leftovers with:

```bash
git for-each-ref --format='%(refname:short)' --merged=develop refs/heads/feat/ refs/heads/fix/ refs/heads/hotfix/
```

An unexpected result blocks flow completion until each branch is safely deleted or explicitly preserved.
