# User manual: edit, build and release

The [eXeLearning user manual](../manual/index.md) lives in this repository and is published with
every release. This page is for the people who maintain it.

The manual of the application is one document per language. It is unrelated to the plugin
integration manual (`doc/plugins/manual.es.elpx`), which is maintained and published separately.

## Where it lives

```text
doc/manual/
├── index.md, index.es.md   pages of the documentation site
├── LICENSE                 CC BY-SA 4.0, the licence of the manual
├── en/                     one folder per language
└── es/
    ├── content.xml         pages, iDevices and properties
    ├── content/resources/  images, videos, audio and other files used by the manual
    └── screenshot.png      cover shown by eXeLearning
```

Each language folder is an eXeLearning project **without its generated files**. The HTML export,
`content.dtd`, `libs/`, `idevices/` and the style are not stored: the build adds them, so the
published website and the editable project always come from the same sources. The manual uses the
*Cedec* style that ships with eXeLearning (`public/files/perm/themes/base/cedec`), which means every
release publishes the manual with the style of that release. A language folder may add its own
`theme/` or `custom/` folder if it ever needs a style that eXeLearning does not include.

## Edit the manual

1. Get the project: download `exelearning-manual-<lang>.elpx` from the
   [documentation site](../manual/index.md), or build it from your branch (see below).
2. Open it in eXeLearning, edit and save it as `.elpx`.
3. Copy the sources into your branch, replacing the previous ones so that files you deleted in
   eXeLearning disappear from the repository too:

    ```sh
    rm -rf doc/manual/es/content/resources
    unzip -o manual.elpx 'content.xml' 'screenshot.png' 'content/resources/*' -d doc/manual/es
    ```

    Use the folder of the language you edited (`doc/manual/en`, `doc/manual/es`…).

4. Run `make build-manual` and open a pull request, one topic per pull request.

The manual can also be opened straight from the repository with
[github.exelearning.dev](https://github.exelearning.dev/?repo=exelearning/exelearning&path=doc/manual/es),
which edits it in the browser and saves the changes as a commit or a pull request. Leave its option
to include the HTML export unticked.

Editorial rules:

- Update the subtitle (*Properties → Subtitle*, "Versión de eXe: X.Y.Z") when the manual is updated
  for a new version. The build warns when a release is published with a manual for another version.
- Add images under a licence compatible with CC BY-SA 4.0 and state their author and licence in the
  caption, like the rest of the manual. Do not add logos or all-rights-reserved material.
- Do not remove credits or licence notices, and update the version history on the credits page.

## Build and validate

```sh
make build-manual                    # every language
make build-manual MANUAL_LANG=es     # one language
```

`scripts/build-manual.ts` packs the sources and exports them with the exporter of your checkout,
the same code as `bun cli elp:export`. It writes to `dist/manual/`:

| File | Content |
| --- | --- |
| `exelearning-manual-<lang>.elpx` | the complete project, as eXeLearning would save it |
| `exelearning-manual-<lang>-html.zip` | the HTML5 website |
| `site/<lang>/` | the same website, unpacked |

The build fails, and nothing is written, when:

- `content.xml` is missing or not well-formed;
- `content.xml` references a resource that is not stored. Names are compared case-sensitively on
  every platform: `Editar.PNG` does not satisfy a reference to `editar.png`, even though it would
  appear to work on Windows or macOS;
- a page of the website links to a local file that was not exported, or a Mermaid diagram was left
  unrendered or drawn empty.

Resources that nothing references are reported as warnings, and so are links into the editor's own
files (`files/perm/…`), which come from the content and are fixed in the editor. `make test-unit`
checks the stored sources of every language as well.

## Continuous integration

`.github/workflows/manual.yml` builds and validates the manuals in every pull request that changes
`doc/manual/`, the build script or the workflow, and keeps the `.elpx` and the HTML ZIP as a
workflow artifact (`user-manual-<pull request number>`) so reviewers can open the result.

## Releases

Nothing has to be tagged or released separately. When an eXeLearning release (or pre-release) is
published, `manual.yml` checks out the release tag, builds every language with the exporter of that
tag and attaches to the **same release**:

- `exelearning-manual-<lang>-<tag>.elpx`
- `exelearning-manual-<lang>-<tag>-html.zip`

If the build or the validation fails, nothing is attached. When the release is promoted from
pre-release to release, `docs-and-repos.yml` builds the manuals again from the same tag and
publishes them on the documentation site, at `/manual/<lang>/` and
`/manual/exelearning-manual-<lang>.elpx`.

### Correcting a published manual

Files attached to a release are never replaced: the upload fails if a file with the same name
exists. To publish a correction for a released version:

1. Merge the fix. For a strict backport, create a branch from the release tag and cherry-pick the
   manual fix there, so the correction is built with the exporter of that release.
2. Run the **User Manual** workflow manually from that branch (or from `main`) with the release
   `tag` (`v4.0.6`) and the next `revision` number (`1`, `2`, …).

The corrected files are attached next to the original ones as
`exelearning-manual-<lang>-v4.0.6-1.elpx` and `exelearning-manual-<lang>-v4.0.6-1-html.zip`. The
documentation site picks up the corrected manual the next time `docs-and-repos.yml` runs, which can
also be started manually.

## Add a language

1. Create `doc/manual/<lang>/` with the project sources (`content.xml`, `content/resources/`,
   `screenshot.png`), using the language code of the documentation (`ca`, `fr`, `pt-BR`…).
2. Run `make build-manual MANUAL_LANG=<lang>`.
3. Add the language to the table in `doc/manual/index.md` and, if it has a translated documentation
   page, to `mkdocs.yml`.

The build, the pull request check, the release files and the documentation site discover languages
from the folders: no script or workflow needs to change.

## Former repository

Until eXeLearning 4.0.6 the Spanish manual was maintained in
[`exelearning/exelearning-manual-es`](https://github.com/exelearning/exelearning-manual-es), with its
own tags, releases and website. Its sources were imported here from the final 4.0.6 manual, together
with the English manual, which had no repository of its own. The
former repository and its published URLs stay available during the transition; new changes and
releases happen only in this repository.

| Former location | Current location |
| --- | --- |
| `https://exelearning.github.io/exelearning-manual-es/` | `https://exelearning.github.io/exelearning/manual/es/` |
| Releases of `exelearning-manual-es` (`exelearning-manual-es-v4.0.5.elpx`) | [eXeLearning releases](https://github.com/exelearning/exelearning/releases) (`exelearning-manual-es-<tag>.elpx`) |
| `releases/latest/download/exelearning-manual-es.elpx` | `https://exelearning.github.io/exelearning/manual/exelearning-manual-es.elpx` |
| Issues and pull requests of `exelearning-manual-es` | Issues and pull requests of this repository |
