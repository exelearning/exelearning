# Skill selection and maintenance

Reviewed against this checkout on 2026-09-12. Skills are optional task procedures, not a replacement
for source inspection. Keep global constraints in AGENTS.md and load detailed references only when
needed. Existing translation terminology and changelog procedures remain in their skill references.

## External candidates

| Candidate | Decision for this project |
| --- | --- |
| [GitHub Actions hardening](https://github.com/github/awesome-copilot/tree/main/skills/github-actions-hardening) | Installed with `gh skills`: useful trigger, permission and injection checks. The explicit project preference for version tags overrides its SHA-pinning advice; authorized workflow edits need no additional approval. |
| [Microsoft Playwright CLI](https://github.com/microsoft/playwright-cli/tree/main/skills/playwright-cli) | Installed with `gh skills` for browser inspection, snapshots and traces. Existing `e2e-test` owns committed specs, fixtures and static/server differences. Use an available local CLI and isolated sessions; do not install global tools or close unrelated sessions merely because an example does. |
| [Liveblocks Yjs best practices](https://github.com/liveblocks/skills/tree/main/skills/yjs-best-practices) | Not installed. Liveblocks/React providers, YKeyValue and experimental update-format advice do not match the current relay protocol and shared schema. The reviewed content also spells the XML fragment constructor `Y.XMLFragment`; the API is `Y.XmlFragment`. Keep a source-informed `websocket-yjs` procedure. |
| [Bun development](https://github.com/mikkelkrogsholm/dev-skills) | Not installed. The reviewed `bun` skill uses examples such as `new Bun.sqlite()` and legacy binary-lockfile advice, and recommends broad runtime substitutions. This project uses `Database` from `bun:sqlite`, `bun.lock`, Kysely dialects and separate Bun/Vitest suites. |
| [Mindrally Kysely](https://github.com/Mindrally/skills) | Not installed. Its generic SQLite/PostgreSQL examples, root-package migration imports and unconditional `returning`/conflict examples need qualification for Kysely 0.29 and MySQL. Local query and migration skills cover the existing helpers and static migration registry. |
| [Focused Kysely](https://github.com/lobomfz/skills/tree/main/backend/kysely) | Not installed. Its domain wrappers, PostgreSQL-specific patterns and type assertions would introduce conventions absent from this codebase. A SQL generic does not normalize runtime driver values. |
| [TerminalSkills Yjs](https://github.com/TerminalSkills/skills) | Not installed. The general tutorial adds little to the existing relay, client persistence and editor lifecycle procedure. |
| [Official Elysia skills](https://github.com/elysiajs/skills) | Not installed. Generic architecture and testing examples add substantial context without improving the existing route/service harnesses. Keep the repository's authentication, injection and test contracts rather than adopting a new service layout or test dependency. |

Installed files remain verbatim, including `metadata.github-*` provenance; licenses are in
[../licenses/](../licenses/). `.claude/skills/` contains byte-identical regular-file copies for Windows.
Update only the canonical `.agents/skills/` tree from upstream, then mirror all files and removals into
Claude. The weekly/manual workflow does both and proposes the result as a PR. Review these changes as
instructions that can affect future agent behavior, including any new upstream references or scripts.

## Primary API references

- [Bun SQLite](https://bun.sh/docs/api/sqlite) and [lockfiles](https://bun.sh/docs/pm/lockfile): use current APIs and the checked-in lockfile.
- [Kysely migrations](https://kysely.dev/docs/migrations): migration imports and frozen historical schemas; verify dialect support in the installed version.
- [Yjs shared types](https://docs.yjs.dev/api/shared-types) and [Y.Doc](https://docs.yjs.dev/api/y.doc): transaction origins, ownership and document cleanup.
- [Elysia testing](https://elysiajs.com/patterns/unit-test): exercise handlers through existing test harnesses.

## Guidance design sources

Prepared with Codex assistance, using these articles as design references:

- [OpenAI: Rethinking skills and prompts for GPT-6 Astra](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra)
- [Anthropic: Prompting Claude Opus 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5)
- [Anthropic: Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Anthropic: Equipping agents for the real world with Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)

The practical choices are short task descriptions, scoped procedures, progressive reference loading,
actual command/path verification and explicit checks for completion. No application architecture or
runtime behavior changes are introduced by this guidance update.
