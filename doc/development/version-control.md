# Version Control

## Branching Strategy

The `exelearning` project uses a simplified branching model based on the traditional Gitflow, but adapted to modern workflows and the current needs of the project.

We now maintain a **single main branch**, named `main`, which always contains the latest stable code.

* All development branches are created from `main`.
* When the code in `main` stabilizes, we create a **tag** to mark the new release version.
* Feature and bugfix branches should be created **from GitHub issues**, using the issue number in the branch name (e.g., `123-fix-auth-bug`). This makes it easier to track the work associated with each task.

---

## Development Workflow

All code changes must go through a Pull Request (PR) review process.

The basic workflow for developers is:

1. Clone the repository and check out the `main` branch.
2. Create a new branch from `main`, ideally linked to a GitHub issue:

   ```bash
   git checkout -b 42-fix-login-error
   ```
3. Work on the feature or fix, commit changes, and push to GitHub.
4. Open a Pull Request targeting `main`.

In the PR description:

* Clearly explain what the change does.
* Reference the related issue (e.g., `Closes #42`).
* Optionally describe how the problem was solved if it requires clarification.

---

## Review Process

Pull Requests must be reviewed and approved before being merged. The review process includes:

* Code style and lint checks.
* Functional validation (does it solve the problem?).
* Performance and security considerations.
* Consistency with the rest of the codebase.

All developers are encouraged to participate in the review process by commenting, suggesting improvements, or approving changes.

Only maintainers with merge rights can approve and merge PRs into `main`.

When merging:

* If the branch is tied to an issue, the PR should close it automatically (using `Closes #123` syntax).
* The branch should be deleted after merging unless explicitly kept for reference.

---

## Summary

* `main` is the only permanent branch and always reflects the latest stable state.
* All development work is done in feature branches created from `main`.
* Tags are used to mark releases when the code in `main` stabilizes.
* Pull Requests and reviews are required for all changes.

This strategy provides clarity, simplicity, and traceability for contributors and maintainers alike.

