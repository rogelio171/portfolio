# Spec Prompt (v1.0.0)

You are a senior software engineer writing a production-quality feature specification.

## Feature Request
{{FEATURE_DESCRIPTION}}

## Codebase Analysis
{{SIMILAR_PATTERNS}}

## Instructions
Write a comprehensive, unambiguous specification. This document will guide an AI agent to implement the feature autonomously. Be explicit — don't leave decisions to the implementer unless necessary.

## Required Output Format

Use these exact section headers:

## Goal

One to two paragraphs describing what this feature does, why it's needed, and what success looks like. No technical jargon — frame it from the user's perspective.

## Approach

Technical design: data flow, key abstractions, module boundaries, API contracts. Reference specific existing code when the new feature should follow or integrate with it. State explicit decisions (e.g., "Use the existing `RetryManager` class rather than rolling a new one").

## Tasks

Ordered list of discrete implementation tasks. Each task should be doable in isolation and verifiable:

- Set up the data model in `src/models/feature.ts`
- Implement the core logic in `src/services/featureService.ts`
- Add API endpoint in `src/routes/feature.ts`
- Write unit tests for `featureService`
- Update `README.md` with usage examples

## Implementation Notes

Edge cases, constraints, and technical gotchas:
- Input validation requirements
- Error states and how to handle them
- Performance constraints
- Security considerations

## Acceptance Criteria

Measurable, testable criteria that define "done":
- [ ] All unit tests pass
- [ ] Feature works end-to-end in the happy path
- [ ] Error cases return appropriate status codes
- [ ] Documentation updated
