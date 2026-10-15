# AI Configuration

eXeLearning offers AI assistance when authoring **game-generation iDevices**
(quizzes, identify, classify, ...). This page explains how to control which AI
options users see and, optionally, how to route generation through your own
server-side AI provider instead of public assistants.

The design follows the separation of concerns of Moodle's AI subsystem (without
reusing its code):

- **Placement** — where AI appears in the UI (the game-generation editor).
- **Action** — what is requested (generate questions).
- **Provider** — who executes the request (Azure OpenAI, Ollama, an
  OpenAI-compatible endpoint, or the user's chosen public assistant).
- **Manager** — selects the configured provider and runs the action.

## Where settings live

AI settings are read from the `app_settings` database table first, falling back
to the matching environment variable. This means:

- Environment variables (`.env`) provide the **initial defaults** for a
  deployment.
- Administrators can **override them at runtime** from the admin panel **AI**
  tab, with no redeploy.

API keys are stored **server-side only**. They are never returned by any API,
never embedded in the static bundle, and never exposed to the frontend.

## Default behaviour

With no configuration, AI features are **enabled** and the provider is
**`external`**, preserving the historical behaviour:

- The game editor offers a prompt and a public AI assistant selector
  (ChatGPT, Claude, Perplexity, Le Chat, Grok, Qwen).
- The **Send to AI** button opens the selected assistant with the prompt.
- Users can pick their preferred assistant via the `defaultAI` preference.

## Behaviour matrix

| `AI_FEATURES_ENABLED` | `AI_PROVIDER` | Game editor | `defaultAI` preference |
|-----------------------|---------------|-------------|------------------------|
| `false`               | (any)         | Copy-only AI tab: prompt + **Copy**, no provider selector / **Send to AI** / **Generate** | Hidden |
| `true`                | `external`    | Prompt + assistant selector + **Send to AI** | Shown |
| `true`                | `azure` / `ollama` / `openai_compat` | **Generate** tab with a server-side **Create** button; no external selector | Hidden |

In managed mode the editor calls `POST /api/ai/generate-text`; the server runs
the configured provider and returns generated text, which the editor turns into
questions. eXeLearning **never falls back** to a public AI service when a
managed provider is selected but misconfigured — it shows a clear error.

## Disabling all AI features

```env
AI_FEATURES_ENABLED=false
```

This removes every AI **provider** integration — the assistant selector, the
**Send to AI** button, the managed **Generate**/**Create** surface and the
`defaultAI` preference all disappear, and the server endpoint responds with a
safe `AI_DISABLED` error if called directly.

The AI tab itself **stays visible** in a copy-only form: teachers can still read
and **Copy** the auto-built prompt, take it to any AI tool of their choice, and
paste the result back into the **Questions** tab. This keeps the
heavily-used game-authoring workflow available without eXeLearning ever calling
an AI provider.

## Configuring a managed provider

Set `AI_PROVIDER` and the matching fields. After deployment, the same values can
be edited from the admin panel **AI** tab (API keys are write-only there: leave
the field blank to keep the stored key).

### Azure OpenAI

```env
AI_PROVIDER=azure
AI_AZURE_ENDPOINT=https://my-resource.openai.azure.com
AI_AZURE_API_KEY=...                # server-side only
AI_AZURE_DEPLOYMENT=gpt-4o
AI_AZURE_API_VERSION=2024-02-01
```

Calls `{endpoint}/openai/deployments/{deployment}/chat/completions?api-version={apiVersion}`
with the `api-key` header.

### Ollama

```env
AI_PROVIDER=ollama
AI_OLLAMA_ENDPOINT=http://localhost:11434   # default
AI_OLLAMA_MODEL=llama3
```

Calls `{endpoint}/api/chat` (non-streaming). No API key is required; a local or
institutional endpoint is expected.

### OpenAI-compatible

```env
AI_PROVIDER=openai_compat
AI_COMPAT_ENDPOINT=https://api.example.com/v1
AI_COMPAT_API_KEY=...               # optional, server-side only
AI_COMPAT_MODEL=gpt-4o-mini
```

Calls `{endpoint}/chat/completions` with a `Bearer` token when a key is set.

### Generation options (managed providers)

```env
AI_REQUEST_TIMEOUT_MS=60000
AI_MAX_OUTPUT_TOKENS=4096
AI_TEMPERATURE=0.2
```

## Troubleshooting a managed provider

When a managed provider request fails, the editor shows a safe, generic message
such as *"The AI provider returned an error (HTTP 500)"*. To avoid leaking
request details (provider URL, API key, prompt payload) or the provider's
answer, the server maps every transport/HTTP failure to a typed error and
**discards the upstream response body** — it is not returned to the client and
is not written to a log. There are no dedicated `[ai]` log lines to grep for.

Administrators can use **Test connection** in the admin **AI** tab to check the
configuration end to end. It performs a real request and returns only the same
safe, typed result — `{ ok: false, error: <code>, message: <generic message> }`
on failure — with no upstream `details` snippet. Because the exact provider
error is not surfaced anywhere, diagnose failures by checking the provider and
endpoint directly against the common causes below.

Common causes of an upstream `HTTP 500`:

- **Ollama** — the model named in `AI_OLLAMA_MODEL` has not been pulled
  (`ollama pull <model>`), so Ollama answers with *model not found*.
- **Azure / OpenAI-compatible** — a wrong deployment name, API version or key,
  or an endpoint that is not actually reachable from the server (e.g. a
  `localhost` Ollama is not reachable from inside the Docker container started by
  `make up`; use a host-reachable address there).

## Security notes

- Provider credentials stay on the server. `/api/config`,
  `/api/parameter-management/parameters/data/list`, the admin settings API and
  the static bundle expose only safe flags: `{ enabled, provider, mode,
  configured }`.
- `AI_PROVIDER` is validated against an allow-list; managed endpoint URLs are
  validated as `http(s)` URLs on save.
- The endpoint is administrator-configured (a trusted value) and the browser
  only ever sends the prompt text — it cannot choose the provider URL.
- Managed AI generation is **online only**. Static/offline builds never require
  provider secrets and only ever offer the external (or disabled) mode.

## Where this lives in the code

- Service layer: `src/services/ai/` (`config.ts`, `manager.ts`, `types.ts`,
  `providers/`).
- Route: `src/routes/ai.ts` (`POST /api/ai/generate-text`,
  `POST /api/ai/test-connection`).
- Public config: `src/routes/config.ts` + `src/routes/parameter-response.ts`
  (`ai` object) and `src/routes/config-params.ts` (`defaultAI` gating).
- Admin settings: `src/routes/admin.ts` (allow-list + secret masking) and the
  admin **AI** tab (`views/admin/index.njk`, `public/app/admin/ai.js`).
- Editor UI: `public/app/common/common_edition.js` (`getTabIA`, `aiSettings`)
  and `public/app/rest/apiCallManager.js` (`getGenerateQuestions`).
