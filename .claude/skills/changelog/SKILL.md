---
name: changelog
description: "Draft a new release-note block or update the current draft from merged pull requests, preserving published changelog history."
---

# Changelog draft

Use the requested mode: create a new version block, or append changes since an already-covered PR.
Use the version/cutoff already provided; ask only if the required value is missing. Do not infer a new
release version. Read [the procedure](references/procedure.md) for PR collection, classification and
existing entry style; its questions apply only when the request has not answered them.

Review actual merged PR descriptions and relevant diffs, paginate if the result limit is reached,
verify dependency versions, and remove semantic duplicates. Write user-visible outcomes in the existing
Added/Fixed/Upgraded/Removed style. Preserve published blocks and mark the result as a draft for review.
This skill does not authorize tagging, publishing or sending messages to reviewers.
