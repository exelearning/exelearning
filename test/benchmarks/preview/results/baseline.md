# Preview refresh benchmark — baseline

- Date: 2026-07-11T00:12:36.541Z
- Git: `939f93f24f70` (feat/incremental-preview-revisions)
- Machine: darwin/arm64, 10× Apple M5, 24 GiB RAM
- Node: v26.4.0

Refresh time is wall-clock from triggering the action to the preview provider completing the sync. S2–S6 are debounced edits, so their time includes the fixed 500 ms debounce; S1 is a direct click-to-open (no debounce). Uploaded bytes = manifest JSON (real on-wire size) + blob payload (derived from the manifest ∩ the server's missing set; excludes small multipart framing). Median of the repeats.

## SMALL — 3 pages, 0 images (200.0 KiB each)

First preview open uploaded **1.64 MiB** across **77** files. JS heap after build: 29.75 MiB.

| Scenario | Refresh ms (median) | Uploaded (median) | Manifest | Blobs | Requests | Files in manifest |
|---|--:|--:|--:|--:|--:|--:|
| S1 initial preview open (cold session) | 238 | 1.64 MiB | 8.7 KiB | 1.63 MiB | 3 | 77 |
| S2 text edit (one word) | 579 | 21.6 KiB | 8.7 KiB | 12.9 KiB | 2 | 77 |
| S3 add a new ~2 MiB image | 608 | 2.02 MiB | 9.0 KiB | 2.01 MiB | 2 | 80 |
| S4 text edit after adding image | 582 | 22.4 KiB | 9.1 KiB | 13.3 KiB | 2 | 80 |
| S5 rename a page (structural) | 582 | 48.3 KiB | 9.1 KiB | 39.2 KiB | 2 | 80 |

- **S1**: Full upload of every file; repeated with a fresh session each time.
- **S2**: Only the edited page HTML should change.
- **S3**: New image blob must be uploaded once.
- **S4**: Blob upload median 13.3 KiB — the 2 MiB image from S3 is NOT re-uploaded (manifest-diff de-dups by hash).
- **S5**: A title change rewrites the shared nav on every page, so all page HTML re-uploads.

### S6 rapid-typing / lost-update

- **Burst** (10 edits as fast as possible): 1 refresh(es) fired; final marker expected `rev1010`, shown `rev1010` → final state reflected.
- **Overlap probe**: attempted=true, in-flight refresh observed=true, dropped refresh observed=true, lost update reproduced=**true** (expected `rev2001`, shown `rev2000`). Upload throttled to 12 KiB/s: A stayed in-flight through its upload, B's refresh hit the isLoading guard and was dropped (1 refresh for 2 edits); the preview still shows rev2000 — rev2001 LOST until the next edit.

## MEDIUM — 25 pages, 10 images (200.0 KiB each)

First preview open uploaded **3.91 MiB** across **109** files. JS heap after build: 45.20 MiB.

| Scenario | Refresh ms (median) | Uploaded (median) | Manifest | Blobs | Requests | Files in manifest |
|---|--:|--:|--:|--:|--:|--:|
| S1 initial preview open (cold session) | 225 | 3.91 MiB | 12.3 KiB | 3.90 MiB | 3 | 109 |
| S2 text edit (one word) | 585 | 26.6 KiB | 12.3 KiB | 14.3 KiB | 2 | 109 |
| S3 add a new ~2 MiB image | 608 | 2.03 MiB | 12.5 KiB | 2.01 MiB | 2 | 112 |
| S4 text edit after adding image | 607 | 27.5 KiB | 12.7 KiB | 14.9 KiB | 2 | 112 |
| S5 rename a page (structural) | 592 | 375.0 KiB | 12.7 KiB | 362.3 KiB | 2 | 112 |

- **S1**: Full upload of every file; repeated with a fresh session each time.
- **S2**: Only the edited page HTML should change.
- **S3**: New image blob must be uploaded once.
- **S4**: Blob upload median 14.9 KiB — the 2 MiB image from S3 is NOT re-uploaded (manifest-diff de-dups by hash).
- **S5**: A title change rewrites the shared nav on every page, so all page HTML re-uploads.

### S6 rapid-typing / lost-update

- **Burst** (10 edits as fast as possible): 1 refresh(es) fired; final marker expected `rev1010`, shown `rev1010` → final state reflected.
- **Overlap probe**: attempted=true, in-flight refresh observed=true, dropped refresh observed=true, lost update reproduced=**true** (expected `rev2001`, shown `rev2000`). Upload throttled to 12 KiB/s: A stayed in-flight through its upload, B's refresh hit the isLoading guard and was dropped (1 refresh for 2 edits); the preview still shows rev2000 — rev2001 LOST until the next edit.

## LARGE — 50 pages, 30 images (200.0 KiB each), 1 media asset 50.00 MiB

First preview open uploaded **58.26 MiB** across **155** files. JS heap after build: 132.56 MiB.

| Scenario | Refresh ms (median) | Uploaded (median) | Manifest | Blobs | Requests | Files in manifest |
|---|--:|--:|--:|--:|--:|--:|
| S1 initial preview open (cold session) | 439 | 58.26 MiB | 17.5 KiB | 58.24 MiB | 3 | 155 |
| S2 text edit (one word) | 772 | 33.4 KiB | 17.5 KiB | 15.8 KiB | 2 | 155 |
| S3 add a new ~2 MiB image | 803 | 2.03 MiB | 17.8 KiB | 2.02 MiB | 2 | 158 |
| S4 text edit after adding image | 795 | 34.4 KiB | 17.9 KiB | 16.5 KiB | 2 | 158 |
| S5 rename a page (structural) | 1211 | 826.4 KiB | 17.9 KiB | 808.5 KiB | 2 | 158 |

- **S1**: Full upload of every file; repeated with a fresh session each time.
- **S2**: Only the edited page HTML should change.
- **S3**: New image blob must be uploaded once.
- **S4**: Blob upload median 16.5 KiB — the 2 MiB image from S3 is NOT re-uploaded (manifest-diff de-dups by hash).
- **S5**: A title change rewrites the shared nav on every page, so all page HTML re-uploads.

### S6 rapid-typing / lost-update

- **Burst** (10 edits as fast as possible): 1 refresh(es) fired; final marker expected `rev1010`, shown `rev1010` → final state reflected.
- **Overlap probe**: attempted=true, in-flight refresh observed=true, dropped refresh observed=true, lost update reproduced=**true** (expected `rev2001`, shown `rev2000`). Upload throttled to 12 KiB/s: A stayed in-flight through its upload, B's refresh hit the isLoading guard and was dropped (1 refresh for 2 edits); the preview still shows rev2000 — rev2001 LOST until the next edit.
