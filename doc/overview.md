# Project Overview

| Key                      | Value                                                                                    |
| ------------------------ | -----------------------------------------------------------------------------------------|
| Responsible Organisation | INTEF - CEDEC                                                                            |
| Contact           	   | eXeLearning Team ([info@exelearning.net](mailto:info@exelearning.net)) 				  |
| Project Title            | eXeLearning                                                                              |
| Official Repository URL  | [https://github.com/exelearning/exelearning](https://github.com/exelearning/exelearning) |

## Current Architecture

eXeLearning is built with a modern TypeScript stack:

| Component | Technology |
|-----------|------------|
| Runtime | [Bun](https://bun.sh/) |
| Backend Framework | [Elysia](https://elysiajs.com/) |
| ORM | [Kysely](https://kysely.dev/) |
| Database | SQLite / PostgreSQL / MySQL |
| Real-time | WebSocket + [Yjs](https://yjs.dev/) |
| Frontend | Vanilla JavaScript |
| Desktop | [Electron](https://www.electronjs.org/) |

For detailed architecture information, see [Architecture Documentation](architecture.md).

## History

### 2024-03-26

Project initiated within the collaboration agreement between Spanish Ministry of Education, Vocational Training and Sports and the educational administrations of Junta de Andalucía and Junta de Extremadura.

The goal was to replace `exelearning-online` (Python 2.7) with a modern, accessible application.

### 2024-07-15

Repository migrated to GitHub as the official development location:
`https://github.com/exelearning/exelearning`

### 2024-11

Migration from Symfony/PHP to modern TypeScript stack begins:
- Backend rewritten with Elysia + Bun
- Database layer migrated to Kysely ORM
- Real-time collaboration implemented with Yjs WebSocket

### 2025

Current state:
- **Backend**: Elysia framework running on Bun runtime
- **Database**: Multi-database support via Kysely (SQLite, PostgreSQL, MySQL)
- **Real-time**: Yjs-based collaborative editing with WebSocket
- **Testing**: 90%+ coverage requirement with Bun test, Vitest, Playwright
- **Legacy code**: Available in `symfony_legacy/` and `nestjs_legacy/` for reference

## Development Practices

- **Git workflow**: Feature branches merged via Pull Requests
- **Testing**: Unit (Bun), Integration, Frontend (Vitest), E2E (Playwright)
- **Coverage**: Minimum 90% for new code
- **CI/CD**: GitHub Actions for testing and deployment

## See Also

- [Architecture Documentation](architecture.md)
- [Development Environment](development/environment.md)
- [Testing Guide](development/testing.md)
