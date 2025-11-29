# Download a Single Page

eXeLearning now lets you export just one page of a project without downloading the entire package. This can be useful when you have to share or review a specific lesson or when you need an HTML/SCORM/IMS artifact for a fast feedback loop.

## Where to find it

1. Open any project in the Workarea.
2. In the navigation tree (left panel), hover a page entry to reveal two compact buttons.
3. Click the green **Download page** button (down arrow icon).
4. Pick a format in the modal dialog:
   - eXeLearning content (`.elpx`)
   - Website (multi-page HTML5)
   - Single page (HTML5 one-pager)
   - SCORM 1.2
   - IMS CP
   - ePub3

The modal remembers the last format you used per page, so repeated exports are faster.

## What happens next

- A toast indicates “Generating export files…”. Stay on the page until it finishes.
- When the export is ready, the file is downloaded directly in the browser or saved by the desktop app (Electron) with a filename derived from the page title.
- Any backend errors (validation, session mismatch, quota, etc.) are shown in an alert dialog so you know what to fix.

## API equivalent

Behind the scenes the UI calls `POST /api/v2/projects/{projectId}/pages/{pageId}/download`. You can trigger that endpoint yourself—see [REST API reference](../development/rest-api.md#download-a-single-page) for body/response details if you want to trigger it from an external tool.
