# Known Issues

This document lists known limitations and edge cases that are not currently planned to be fixed, usually due to low impact or high maintenance cost.

---

## Legacy .elp image footer structure not recognized by image editor

**Status:** Won't fix
**Affected versions:** Importing very old .elp files (pre eXe 2.9 figcaption format)
**Related issue:** [#1221](https://github.com/exelearning/exelearning/issues/1221)

### Description

When importing certain legacy .elp files, image footer metadata stored in older `<figcaption>` structures is displayed correctly in the iDevice preview. However, the image editing dialog does not recognize the legacy format, so the title field appears empty. Saving the iDevice without manually re-entering the title silently discards it.

The root cause is that the legacy figcaption uses plain text nodes and unsemantic markup instead of the current structure with `<span class="author">`, `<span class="title">`, and `<span class="license">` elements. This mismatch already existed in eXe 2.9 itself — TinyMCE's image dialog never parsed the old format either.

### Reason

Fixing this would require additional parsing and transformation logic to convert the legacy figcaption structure into the current format during import. The real-world impact is very limited (affects only a small subset of very old .elp files), and the added complexity and maintenance cost are not justified.

### Workaround

Manually adjust the image footer information after importing the legacy .elp file.
