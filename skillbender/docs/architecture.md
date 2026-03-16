# Architecture

## Overview

SkillBender is a deterministic pipeline orchestrator where:
- **TypeScript/Node.js code** controls stage transitions and state management
- **LLMs** do creative work only within each stage (analysis, code generation, documentation)
- **Markdown spec files** serve as the persistent state store and audit trail

This "harness + LLM" architecture avoids the unpredictability of fully autonomous agents while still delivering end-to-end automation.

## Core Principles

### 1. Deterministic Orchestration
The pipeline decides what runs next. The LLM never decides which stage to execute — it only executes the work within each stage. This makes behavior predictable, debuggable, and testable.

### 2. Provider Agnosticism
All LLM calls go through a common `LLMProvider` interface. Providers are selected at runtime via configuration. The same pipeline code runs unchanged against Claude, GPT-4o, or a local Ollama model.

### 3. State as Markdown
Pipeline state persists in a markdown spec file. Every stage reads the spec, does its work, and writes updates back. If the process crashes, it can resume from the last known state.

### 4. Human-in-the-Loop by Default
The spec stage pauses for human review before implementation begins. This checkpoint can be skipped (`--yes`) for fully automated flows.

## Data Flow

```
CLI
 │
 ▼
Pipeline Orchestrator (pipeline.ts)
 │  ┌─────────────────────────────────────────┐
 │  │  PipelineState (in-memory + spec file)  │
 │  └─────────────────────────────────────────┘
 │
 ├─▶ Analyze Stage
 │     ├── CodebaseScanner → FileEntry[]
 │     ├── buildLLMContext() → string (token-budgeted)
 │     └── LLMProvider.complete() → similarPatterns: string
 │
 ├─▶ Spec Stage
 │     ├── LLMProvider.complete() → raw spec markdown
 │     ├── parseSpecResponse() → { goal, approach, tasks }
 │     └── saveSpec() → .skillbender/specs/{id}.md
 │
 │  [CHECKPOINT — human reviews spec file]
 │
 ├─▶ Implement Stage
 │     ├── buildLLMContext() → focused codebase context
 │     ├── LLMProvider.complete() → code blocks
 │     ├── extractCodeBlocks() → Map<path, content>
 │     └── writeFileSync() → files on disk
 │
 ├─▶ Validate Stage
 │     ├── execa() → tsc, eslint, vitest/jest
 │     ├── parseValidationResults() → ValidationResult
 │     └── LLMProvider.complete() → fix suggestions (if failed)
 │
 └─▶ Document Stage
       ├── LLMProvider.complete() → documentation markdown
       ├── extractDocBlocks() → Map<path, content>
       └── mergeDocContent() + writeFileSync() → docs on disk
```

## LLM Provider Abstraction

```
┌──────────────────────────────────────┐
│          LLMProvider interface        │
│  complete(messages, options)          │
│  stream(messages, options)            │
└──────────────────────────────────────┘
          ▲          ▲          ▲
          │          │          │
   AnthropicProvider OpenAIProvider OllamaProvider
   (Vercel AI SDK adapters — swap with one config line)

┌─────────────────────────────────────────┐
│              ProviderChain              │
│  Wraps multiple providers for fallback  │
│  Primary → Fallback[0] → Fallback[1]   │
└─────────────────────────────────────────┘
```

## Resilience Stack

Every LLM call goes through:

```
call()
  └── CircuitBreaker.call()
        └── withRetry()
              └── provider.complete()
```

1. **withRetry** — exponential backoff + jitter for transient errors (429, 5xx)
2. **CircuitBreaker** — opens after N failures, prevents thundering herd
3. **ProviderChain** — falls back to secondary provider when circuit is open

## Spec File Structure

```markdown
---
id: {timestamp}-{slug}
title: "Feature title"
status: todo | in-progress | review | done | blocked
created: ISO8601
updated: ISO8601
---

# Feature Title

## Goal
## Status
## Approach
## Tasks
## Progress Log
## Implementation Notes
## Documentation
```

## Configuration Layers

```
Priority:  CLI args > ENV vars > project config > global config > defaults

ENV vars:  SKILLBENDER_LLM_PROVIDER, SKILLBENDER_LLM_MODEL, etc.
Project:   .skillbender/config.yaml
Global:    ~/.config/skillbender/config.yaml
Defaults:  defined in src/config/schema.ts (Zod)
```

## Prompt Versioning

Prompts are markdown files in `prompts/`. Version them in git alongside code:
- `MAJOR.MINOR.PATCH` in the prompt header comment
- Treat structural changes as MAJOR
- Keep separate prompts per stage for independent iteration
