# Feature Resolution Workflow

## Overview

The workflow transforms a plain-English feature description into implemented, validated, and documented code through five stages.

---

## Stage 1: Analyze

**Purpose**: Understand the codebase before writing anything.

**What it does**:
1. Scans all files in configured `include` directories
2. Respects `exclude` patterns (node_modules, dist, etc.)
3. Builds a token-budgeted LLM context (prioritizes smaller/utility files)
4. Asks the LLM to identify similar patterns, conventions, and integration points

**Output**: `state.similarPatterns` — a structured markdown analysis including:
- Similar existing implementations
- Coding conventions observed
- Relevant files to read
- Integration points for the new feature
- Risks and dependencies

**When to skip**: If you have a fresh codebase with no relevant patterns, skip with `--stages spec,implement,validate,document`.

---

## Stage 2: Spec

**Purpose**: Generate a precise, unambiguous feature specification before any code is written.

**What it does**:
1. Uses analyze output + feature description to generate a structured spec
2. Saves the spec as a markdown file in `.skillbender/specs/`
3. **Pauses for human review** (configurable checkpoint)

**Output**: `.skillbender/specs/{timestamp}-{slug}.md` with:
- Goal, Approach, Tasks, Implementation Notes
- Status: `in-progress`
- Initial progress log entry

**Human checkpoint**: Before proceeding to implement, you can:
- Edit the spec file to correct the approach
- Add/remove tasks
- Update implementation notes
- Then confirm in the CLI to continue

To skip the checkpoint: `skillbender resolve "..." --yes`

---

## Stage 3: Implement

**Purpose**: Generate production-quality code following the spec.

**What it does**:
1. Builds a focused codebase context for the LLM (60K char budget)
2. Generates implementation code with a self-review loop (up to `maxReviewLoops`)
3. Parses code blocks from LLM response
4. Writes files to disk
5. Updates task statuses in the spec

**File format expected from LLM**:
````
```typescript:src/path/to/file.ts
// implementation
```
````

**Review loops**: The LLM generates code, then optionally reviews and refines it. Set `pipeline.maxReviewLoops: 0` to disable.

**Output**: New/modified files on disk, spec tasks marked done.

---

## Stage 4: Validate

**Purpose**: Verify the implementation actually works.

**What it does**:
1. Runs `typecheck` script (or `tsc --noEmit` directly)
2. Runs `lint` script if available
3. Runs `test` script if available
4. If validation fails, asks LLM for fix suggestions
5. Updates spec with validation results

**Output**: `state.validationResult` with pass/fail, error counts, and LLM fix suggestions if needed.

**Note**: SkillBender does not automatically apply LLM fix suggestions — they're saved to the spec for human review. This prevents cascading auto-fixes from making things worse.

---

## Stage 5: Document

**Purpose**: Keep documentation in sync with implementation.

**What it does**:
1. Generates documentation markdown based on what was implemented
2. Creates new doc files if `docs.createIfMissing: true`
3. Merges new sections into existing files (doesn't overwrite)
4. Updates the spec with documentation links
5. Marks spec status as `done`

**Merge strategy**: For existing files, new sections are appended only if they don't already exist by heading name. Existing content is preserved.

**Output**: Updated markdown files in `docs/`, spec marked `done`.

---

## Resuming a Pipeline

If a pipeline fails mid-way, resume from the spec file:

```bash
skillbender resolve "Original description" --spec .skillbender/specs/{id}.md --stages implement,validate,document
```

Or just run the document stage after manually fixing implementation issues:

```bash
skillbender document .skillbender/specs/{id}.md
```

---

## Partial Runs

Run only specific stages:

```bash
# Just generate a spec
skillbender spec "Add webhook support"

# Just run analysis
skillbender analyze "What patterns exist for event handling?"

# Just update docs
skillbender document --description "Webhook support"

# Analyze and spec only (review before committing to implementation)
skillbender resolve "Add webhooks" --stages analyze,spec
```

---

## Customizing the Workflow

### Add a custom stage via config

You can customize which stages run and in what order:

```yaml
pipeline:
  stages:
    - analyze
    - spec
    - implement
    - validate
    - document
```

### Move or remove the checkpoint

```yaml
pipeline:
  checkpoints:
    - implement   # Checkpoint before implementation instead of spec
```

Or remove all checkpoints for fully autonomous mode:

```yaml
pipeline:
  checkpoints: []
```

### Customize prompts

Edit files in `prompts/` to match your team's conventions. Each prompt has a version header — increment it when you make changes for tracking.
