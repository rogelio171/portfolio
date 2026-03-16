# SkillBender

**Enterprise autonomous feature resolution workflow — from description to documented, tested code.**

SkillBender takes a plain-English feature description and autonomously runs a full pipeline: it scans your codebase for similar patterns, generates a spec document, implements the feature, validates it, and updates your documentation. Every step is tracked in a markdown spec file that serves as the source of truth.

```bash
skillbender resolve "Add rate limiting to all API endpoints"
```

---

## How It Works

```
Feature Description
      │
      ▼
  ┌─────────┐
  │ ANALYZE │  Scans codebase, finds similar patterns & conventions
  └────┬────┘
       │
       ▼
  ┌──────┐
  │ SPEC │  Generates a markdown spec with goal, approach, tasks
  └──┬───┘
     │  ← Human checkpoint (review spec before proceeding)
     ▼
  ┌───────────┐
  │ IMPLEMENT │  Writes code following existing patterns
  └─────┬─────┘
        │
        ▼
  ┌──────────┐
  │ VALIDATE │  Runs typecheck, lint, tests. Suggests fixes if needed.
  └────┬─────┘
       │
       ▼
  ┌──────────┐
  │ DOCUMENT │  Creates/updates docs and README
  └──────────┘
       │
       ▼
  Spec file updated with full progress log
```

Each run creates a spec file in `.skillbender/specs/` that tracks status, tasks, progress log, and generated documentation — a permanent audit trail.

---

## Installation

```bash
npm install -g skillbender
```

Or use without installing:

```bash
npx skillbender@latest resolve "Your feature here"
```

---

## Quick Start

### 1. Initialize your project

```bash
cd your-project
skillbender init
```

This creates `.skillbender/config.yaml` with sensible defaults.

### 2. Set your API key

```bash
# Anthropic Claude (default)
export ANTHROPIC_API_KEY=sk-ant-...

# Or OpenAI
export OPENAI_API_KEY=sk-...

# Or local Ollama (no key needed)
export OLLAMA_BASE_URL=http://localhost:11434/api
```

### 3. Resolve a feature

```bash
skillbender resolve "Add JWT authentication to all protected routes"
```

The pipeline will pause at the **spec checkpoint** so you can review and edit the generated spec before implementation begins.

### 4. Skip checkpoints (CI/automation)

```bash
skillbender resolve "Add health check endpoint" --yes
```

---

## Commands

| Command | Description |
|---|---|
| `skillbender resolve <description>` | Run the full pipeline |
| `skillbender analyze [description]` | Scan codebase only |
| `skillbender spec <description>` | Generate spec only |
| `skillbender document [specFile]` | Update docs only |
| `skillbender list` | List all specs |
| `skillbender init` | Initialize in current project |

### `resolve` options

```
skillbender resolve <description> [options]

Options:
  -s, --stages <stages>   Comma-separated stages to run (default: all)
  -y, --yes               Skip all checkpoints
  --spec <file>           Resume from an existing spec file
  --provider <provider>   LLM provider (anthropic|openai|ollama)
  --model <model>         LLM model ID
```

**Examples:**

```bash
# Run only analysis and spec (no code generation)
skillbender resolve "Add search feature" --stages analyze,spec

# Use GPT-4o instead of Claude
skillbender resolve "Refactor auth module" --provider openai --model gpt-4o

# Use local Ollama
skillbender resolve "Add caching layer" --provider ollama --model llama3.2
```

---

## Configuration

SkillBender uses layered configuration (highest priority first):

1. CLI flags
2. Environment variables (`SKILLBENDER_*`)
3. Project config (`.skillbender/config.yaml`)
4. Global config (`~/.config/skillbender/config.yaml`)
5. Defaults

### `.skillbender/config.yaml`

```yaml
version: "1"

llm:
  provider: anthropic          # anthropic | openai | ollama
  model: claude-sonnet-4-6
  maxTokens: 8192
  temperature: 0.2
  fallback:
    - provider: openai
      model: gpt-4o

pipeline:
  stages: [analyze, spec, implement, validate, document]
  checkpoints: [spec]          # Pause here for human review
  maxRetries: 3
  maxReviewLoops: 3

analyzer:
  include: [src, lib, app]
  exclude: [node_modules, dist]
  maxFileSize: 102400           # 100KB per file

tracker:
  outputDir: .skillbender/specs
  autoCommit: false

docs:
  dirs: [docs, README.md]
  createIfMissing: true

logging:
  level: info
  format: pretty                # pretty | json (use json in CI)
```

### Environment variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `OLLAMA_BASE_URL` | Ollama base URL (default: `http://localhost:11434/api`) |
| `SKILLBENDER_LLM_PROVIDER` | Provider override |
| `SKILLBENDER_LLM_MODEL` | Model override |
| `SKILLBENDER_LOG_LEVEL` | Log level override |
| `SKILLBENDER_LOG_FORMAT` | `pretty` or `json` |

---

## Spec Files

Every feature run produces a spec file in `.skillbender/specs/`:

```markdown
---
id: 1710000000000-add-jwt-auth
title: "Add JWT authentication"
status: done
created: 2026-03-16T10:00:00.000Z
updated: 2026-03-16T10:15:00.000Z
---

# Add JWT authentication

## Goal
...

## Status
`done`

## Approach
...

## Tasks
- [x] task-1: Set up JWT library
- [x] task-2: Implement token generation
- [x] task-3: Add middleware

## Progress Log
- **2026-03-16T10:00:00Z** [analyze] Scanned 42 files. Found similar patterns.
- **2026-03-16T10:02:00Z** [spec] Specification generated by AI. Awaiting review.
- **2026-03-16T10:05:00Z** [implement] Implementation generated: 3 file(s) written.
- **2026-03-16T10:12:00Z** [validate] Validation passed: 18 tests, no errors.
- **2026-03-16T10:15:00Z** [document] Documentation updated: docs/auth.md
```

List all specs:

```bash
skillbender list
skillbender list --status in-progress
```

---

## Provider-Agnostic Design

SkillBender abstracts the LLM layer so you can switch providers with one config change. All providers implement the same interface:

```typescript
interface LLMProvider {
  complete(messages: Message[], options?: CompletionOptions): Promise<LLMResponse>;
  stream(messages: Message[], options?: CompletionOptions): AsyncIterable<LLMStreamChunk>;
}
```

Supported providers:
- **Anthropic** (Claude) — `provider: anthropic`
- **OpenAI** (GPT-4o, o1) — `provider: openai`
- **Ollama** (local models) — `provider: ollama`

Configure a fallback chain for high-availability:

```yaml
llm:
  provider: anthropic
  model: claude-sonnet-4-6
  fallback:
    - provider: openai
      model: gpt-4o
```

---

## Enterprise Features

### Resilience
- **Retry with exponential backoff + jitter** — handles transient API errors
- **Circuit breaker** — stops hammering a failing provider
- **Provider fallback chain** — automatic failover to secondary providers

### Observability
- Structured JSON logging (set `logging.format: json` in config)
- Per-run token and cost tracking logged at pipeline completion
- Full progress audit trail in spec files

### Cost Control
- Every LLM call tracks input tokens, output tokens, and estimated USD cost
- Per-run totals printed at the end of every pipeline run
- Route to cheaper models via config (`claude-haiku`, `gpt-4o-mini`, `ollama`)

### Customizable Prompts
Prompts are versioned markdown files in the `prompts/` directory. Edit them to match your team's conventions:

```
prompts/
  analyze.md    (v1.0.0)
  spec.md       (v1.0.0)
  implement.md  (v1.0.0)
  validate.md   (v1.0.0)
  document.md   (v1.0.0)
```

---

## Architecture

```
src/
├── cli/                  # Commander.js CLI
│   ├── index.ts          # Entry point
│   └── commands/         # One file per command
├── agent/                # Pipeline orchestrator
│   ├── pipeline.ts       # Orchestrates stages
│   ├── state.ts          # Shared pipeline state
│   └── stages/           # Stage implementations
│       ├── analyze.ts
│       ├── spec.ts
│       ├── implement.ts
│       ├── validate.ts
│       └── document.ts
├── llm/                  # Provider abstraction
│   ├── provider.ts       # Core interface + ProviderChain
│   ├── factory.ts        # Creates providers from config
│   └── providers/        # Concrete adapters
│       ├── anthropic.ts
│       ├── openai.ts
│       └── ollama.ts
├── analyzer/             # Codebase scanner
│   └── codebase.ts
├── tracker/              # Spec file management
│   └── spec.ts
├── config/               # Layered config
│   ├── schema.ts         # Zod schema
│   └── loader.ts         # Priority-layered loader
├── logger/               # Pino structured logger
│   └── index.ts
└── utils/
    ├── retry.ts          # Retry with backoff + jitter
    └── circuit-breaker.ts
```

---

## Development

```bash
# Install dependencies
npm install

# Run in dev mode
npm run dev resolve "Test feature"

# Typecheck
npm run typecheck

# Lint
npm run lint

# Test
npm test

# Build
npm run build
```

---

## License

MIT
