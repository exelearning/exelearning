<p align="center">
  <img src="logo.svg" alt="eXeLearning Logo">
</p>

# eXeLearning Docs

Welcome. This documentation serves three audiences:

- End Users (Educators): Install and run eXeLearning on Windows, macOS, and Linux.
- System Administrators: Deploy and maintain eXeLearning on servers with Docker.
- Developers/Contributors: Set up the environment, run tests, customize, and contribute.

Use the sections below to jump to what you need.

## For End Users
- [Install](install.md)
- [Profile pictures](profile-avatars.md)

## For System Administrators
- [Deployment](deployment.md)
- [High Availability](high-availability.md)

## For Developers
- Development Environment: [Setup and tooling](development/environment.md)
- Contributing: [How to contribute](development/contributing.md)
- Testing: [Unit, E2E, and CI](development/testing.md)
- Internationalization: [Add and update translations](development/internationalization.md)
- Real Time: [Yjs WebSocket collaboration](development/real-time.md)
- Customization: [Applying safe CSS/JS](development/customization.md)
- Customization: [Creating a Style](development/styles.md)
- Version Control: [Branching and PRs](development/version-control.md)
- Installers: [Installers](development/installers.md)

- Embedding: [Embedding the editor in LMS plugins](development/embedding.md)

- [REST API](development/rest-api.md)
- [Authentication](development/authentication.md)

## Technical Reference
- [Architecture Overview](architecture.md)

## File Formats
- [ELPX Format Hub](elpx-format.md) — Modern `.elpx` project file format (eXeLearning v3+); top-level overview that links to every detail subdoc below
- [Legacy ELP Format (contentv3.xml)](contentv3-format.md) — Legacy format (eXeLearning 2.x)

### ELPX Format Reference
Detailed subdocs under [doc/elpx-format/](elpx-format/):

- Container & XML
  - [Container layout](elpx-format/container.md) — every file/folder inside an `.elpx` ZIP
  - [content.xml reference](elpx-format/content-xml.md) — full ODE 2.0 element reference + bundled DTD
  - [ID format](elpx-format/ids.md) — `YYYYMMDDHHmmss + 6 chars` and synchronization rules
  - [Metadata properties](elpx-format/metadata.md) — every `pp_*` key
  - [Pages and blocks](elpx-format/pages-blocks.md) — flat-list navigation model
- iDevices
  - [Catalog](elpx-format/idevices/catalog.md) — every supported type
  - [Content patterns](elpx-format/idevices/patterns.md) — the four storage patterns
  - [Per-iDevice config.xml](elpx-format/idevices/config-xml.md)
  - [XML snippets](elpx-format/idevices/snippets.md) — copy-pasteable XML per type
- Resources
  - [Themes](elpx-format/themes.md) — bundle layout, default `base`, custom themes
  - [Bundled libraries](elpx-format/libraries.md) — `libs/` contents and inclusion rules
  - [Assets and `{{context_path}}`](elpx-format/assets.md)
  - [screenshot.png spec](elpx-format/screenshot.md)
- Pipelines & validation
  - [Export pipeline](elpx-format/export-pipeline.md)
  - [Import pipeline](elpx-format/import-pipeline.md)
  - [Validation](elpx-format/validation.md) — DTD/XSD + checklist
- AI generation
  - [AI generation rules](elpx-format/ai-generation.md) — rules for LLMs producing `.elpx`
- Examples
  - [Minimal content.xml](elpx-format/examples/minimal-content-xml.md)
  - [Multi-page content.xml](elpx-format/examples/multi-page-content-xml.md)
  - [Annotated package tree](elpx-format/examples/full-package-tree.md)

## For AI / LLM Agents
- [`/llms.txt`](../llms.txt) — top-level index for LLM consumption (per [llmstxt.org](https://llmstxt.org/))
- [`/llms-full.txt`](../llms-full.txt) — full ELPX-format doc bundle in a single file
- [AI generation rules](elpx-format/ai-generation.md) — start here when generating `.elpx` programmatically

## Project Overview
- [Project Summary](overview.md)

---

Need help choosing? If you are installing the desktop app on your computer, start with Install. If you plan to host eXeLearning for multiple users, see Deployment. If you want to contribute to the codebase, go to Development.
