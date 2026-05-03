# TODO

## Backlog

### SuperPowers core local workflow integration

- Status: deferred
- Priority: medium
- Owner: unassigned

Goal:

Use the original SuperPowers project as the basis for an in-app local workflow engine, instead of porting SuperPowersWUI directly.

Context:

- SuperPowersWUI is an Open WebUI Tool and depends on Open WebUI internals such as `generate_chat_completion`, Tool Calling metadata, and Fileshed-style storage.
- The original SuperPowers project is easier to adapt because its core behavior is mostly skill markdown, command markdown, prompt templates, and hooks.
- The current app already has provider/model selection for `lm_studio`, `ollama`, and CLI providers.

Proposed approach:

1. Vendor or reference the original SuperPowers repo under a clearly licensed path.
2. Load selected skills such as `brainstorming`, `writing-plans`, `executing-plans`, and `verification-before-completion`.
3. Create an app-native workflow engine that maps those skills onto existing providers.
4. Use local LLMs for brainstorm/spec/plan/diff proposals.
5. Use Codex/CLI providers for actual file edits and verification.
6. Save generated specs and plans under `docs/designs` and `docs/plans`, or a dedicated app storage path.

Open questions:

- Should this be a dedicated `SuperPowers Workflow` screen or remain a Workspace preset?
- Should skill files be vendored into this repo or referenced from a local path?
- Which local model should be the default for each phase?
- How much of the original hook/skill auto-trigger behavior should be reproduced?

Not doing now:

- Directly porting SuperPowersWUI's Open WebUI Tool implementation.
- Allowing LM Studio/Ollama HTTP providers to edit files directly without a file-edit execution layer.
