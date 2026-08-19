<div align="center">
  <a href="https://github.com/exelearning/exelearning">
    <img src="public/images/logo_readme.png" alt="eXeLearning Logo" height="225">
  </a>

  <h1 align="center">eXeLearning</h1>

  <p align="center">
    <strong>eXeLearning</strong> is an AGPL-licensed free/libre tool to create and publish open educational resources.
    <br />
    <a href="https://github.com/exelearning/exelearning"><strong>Explore the project »</strong></a>
    <br />
    <br />
    <a href="https://github.com/exelearning/exelearning/issues/new?labels=bug">Report a Bug</a>
    ·
    <a href="https://github.com/exelearning/exelearning/issues/new?labels=enhancement">Request Feature</a>
  </p>
</div>

<p align="center">
  <a href="https://codecov.io/gh/exelearning/exelearning">
    <img src="https://codecov.io/gh/exelearning/exelearning/graph/badge.svg" alt="codecov" />
  </a>
</p>

## About the Project

eXeLearning is a free and open source authoring tool for creating interactive educational resources. It was originally developed within the eXeLearning.org project in New Zealand and, since 2010,it has been maintained and further developed by the eXeLearning.net project, led by the Spanish Ministry of Education, Vocational Training and Sports (MEFPD) through Cedec-INTEF.

Currently, the development of the code is carried out in a coordinated manner between the MEFPD and the regional administrations, ensuring its continuous evolution, the improvement of its architecture, and the incorporation of new features.

This version is built with modern technologies (Bun, Elysia, Kysely) and provides an accessible and up-to-date user interface for creating interactive educational content.

### Key Features

* Creation and edition of interactive educational content
* Multiple iDevices (interactive elements)
* Multilingual support
* Exportation to various formats
* Moodle integration
* RESTful API built with [Elysia](https://elysiajs.com/)
* Real-time collaborative editing powered by [Yjs](https://yjs.dev/) WebSocket
* [Architecture Documentation](./doc/architecture.md)
* Modern and accessible interface built with [Bootstrap](https://getbootstrap.com/)
* Multiple authentication methods (Password, CAS, OpenID Connect)
* Compatible with MySQL, PostgreSQL, and SQLite databases
* Offline installers supported via [Electron](https://www.electronjs.org/) and [nativePHP](https://nativephp.com/)

## Quick Start

### Using Docker

```bash
docker run --pull always -p 8080:8080 --name exelearning exelearning/exelearning:latest
```

This will start eXeLearning at `http://localhost:8080` with the default credentials: `user@exelearning.net` / `1234`.

### Local Development

First install [Bun](https://bun.sh/) if you don't have it yet. Then:

```bash
git clone https://github.com/exelearning/exelearning.git
cd exelearning
make up-local
```

This will install dependencies, build assets, and start eXeLearning at `http://localhost:8080` with hot reload.

Offline installers for Linux, Windows and macOS are also available on the [Releases page](https://github.com/exelearning/exelearning/releases).

## Deployment

To deploy eXeLearning in a production environment, see:

- Overview: [doc/deployment.md](./doc/deployment.md)
- Sample Compose files: [doc/deploy/README.md](./doc/deploy/README.md)
- Upgrading from previous versions: [UPGRADE.md](./UPGRADE.md)

## Development Environment

See [doc/development/environment.md](./doc/development/environment.md) for full setup instructions.

```bash
git clone https://github.com/exelearning/exelearning.git
cd exelearning
make up-local
```

This will install dependencies, build assets, and start the development server at `http://localhost:8080` with hot reload.

More development tools, options, and real-time collaboration info are documented in the `doc/` folder. See also [Architecture Documentation](./doc/architecture.md).
For profiling and performance investigations in Electron and export/save flows, see [doc/development/profiling.md](./doc/development/profiling.md).


## Usage

eXeLearning enables educators to:

1. Create interactive educational projects
2. Add different types of content using iDevices
3. Structure content with a hierarchical index
4. Export content for use in Moodle or other platforms
5. Share and collaborate on educational resources

## Internationalization

The project supports multiple languages using [i18n](https://www.npmjs.com/package/i18n). Currently available:

* English (default)
* Español
* Català
* Euskara
* Galego
* Valencià
* Esperanto

For more information on translation management, see the [internationalization documentation](./doc/development/internationalization.md).

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

See our [versioning guide](./doc/development/version-control.md) for details about our Git workflow.

### Useful Makefile Commands

The project includes a Makefile to simplify development tasks:

```
make up-local         # Start development server (installs deps + hot reload)
make up               # Start with Docker
make test-unit        # Run unit tests
make test-integration # Run integration tests
make test-frontend    # Run frontend tests (Vitest)
make test-e2e         # Run E2E tests (Playwright)
make lint             # Run linter
make fix              # Auto-fix linting issues
```

To see all available commands, run:

```
make help
```

## Known Issues

Some legacy limitations and edge cases are documented in [KNOWN_ISSUES.md](KNOWN_ISSUES.md).

## Documentation

The full project documentation is available in the [`doc`](./doc/index.md) directory

## Contributors

<a href="https://github.com/exelearning/exelearning/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=exelearning/exelearning" alt="Contributors" />
</a>

## Solo Logic Alpha — Build & Demo

This section documents the Solo Logic Alpha deliverable (commit `3c7c7e82163e812f04cbb033240942f8ac1214a0`, fork `danghoangsqtt-sys/exelearning` branch `feature/solo-logic-alpha`).

### Quick Start (Docker, matches P02 verified environment)

```bash
git clone https://github.com/danghoangsqtt-sys/exelearning.git
cd exelearning
git checkout feature/solo-logic-alpha
docker run --rm -v ${PWD}:/app -w /app oven/bun:1.3-alpine sh -c "bun run build:all"
docker run --rm -p 8080:8080 -v ${PWD}:/app -w /app oven/bun:1.3-alpine bun run start
```

Open `http://localhost:8080`, login `user@exelearning.net` / `1234`.

### Load Demo Course

1. File → Open → select `test/fixtures/electronics-logic-demo.elpx`
2. Course contains: text + image + video + Truth Table (3 vars) + Karnaugh (4 vars, wrap/overlap/don't-care) + Half-Adder Circuit

### Verify Learner Flows (Preview or HTML Offline)

**Truth Table (AT-05)**: Fill 7/8 correct, click **Kiểm tra** → "7 / 8" with 1 failed cell. Fix → "8 / 8".

**Karnaugh (AT-06)**: Fill 16 cells (minterms 0,2,8,10,12,14=1; don't-care 4=X). Create groups {0,2,8,10} and {8,10,12,14} (overlap at 8,10, wrap both edges). Click **Kiểm tra** → "10 / 10", solution "!B*!D+A*!D".

**Half-Adder (AT-07)**: Place 2×INPUT, 1×XOR, 1×AND, 2×OUTPUT. Wire A→XOR.a, B→XOR.b, A→AND.a, B→AND.b, XOR.out→Sum, AND.out→Carry. Click **Kiểm tra** → "8 / 8". Remove wire → structural error.

### Export HTML5 Offline (AT-09, EXP-03)

File → Export → HTML5 Website. Open `index.html` directly in browser (no server). All three activities grade offline. Export audited for forbidden patterns (`.agents/`, `.claude/`, `.ai/`, absolute paths, tokens, stack traces).

### Run Tests

```bash
# Backend unit
bun test ./src ./test/helpers ./scripts ./app --coverage
# Frontend unit
bun run test:frontend
# Integration
bun run test:integration
# E2E (Playwright Chromium)
bun x playwright test --project=chromium
# Electronics Logic full regression
npx vitest run public/files/perm/idevices/base/electronics-logic
bun x playwright test --project=chromium test/e2e/playwright/specs/idevices/electronics-logic.spec.ts
bun x playwright test --project=chromium test/e2e/playwright/specs/demo/electronics-logic-demo.spec.ts
# Lint
bunx @biomejs/biome check src/ test/ public/app/
```

### Offline Verification

After HTML5 export, disconnect network. Open exported `index.html` directly. All activities work. No network requests.

### Skill Verification (AT-S01, AT-S02, AT-S03)

```bash
cat .ai/skills.lock.json | head -50
powershell -File tools/ai/sync-project-skills.ps1 -Check
cat .ai/evidence/AT-S03-nemotron-dry-run.md
```

Full evidence: `.ai/evidence/test-report-AT.md`, `.ai/evidence/release-notes.md`, `repo-map.md`.

## License

Distributed under the GNU AFFERO GENERAL PUBLIC LICENSE v3.0. See `LICENSE` for more information.
