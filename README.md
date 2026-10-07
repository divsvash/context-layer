# Cortex

**A local-first context layer for working across AI tools without rebuilding project context every time.**

Cortex runs as a lightweight desktop overlay, observes useful project information you intentionally copy, extracts durable project knowledge, stores that understanding locally, and compiles it into portable context you can carry into another AI.

The idea is simple:

> **Your project should remember. Your chat shouldn't have to.**

Today, switching from ChatGPT to Claude, Gemini, Cursor, or another model usually means rebuilding context from scratch: what you are building, what decisions were made, which approaches failed, what constraints matter, and what changed since the last conversation.

Cortex is an attempt to make that context independent of the model.

---

## The problem

AI tools are increasingly good at individual tasks, but their understanding is fragmented.

A project might move through:

```text
ChatGPT → IDE → Claude → browser → another model → back to IDE
```

Each tool sees only a piece of the work.

The knowledge that actually defines the project—decisions, constraints, goals, technologies, unresolved questions, corrections, and history—gets buried inside individual conversations.

That creates a recurring tax:

```text
new tool
   ↓
explain the project again
   ↓
explain previous decisions
   ↓
explain what has already been tried
   ↓
correct outdated assumptions
   ↓
finally continue working
```

Cortex moves that memory outside the individual AI session.

Instead of treating chat transcripts as the source of truth, Cortex maintains a persistent representation of the **project itself**.

---

# What Cortex does today

The current implementation provides an end-to-end context loop:

```text
You copy useful project information
                │
                ▼
        Clipboard Observer
                │
                ▼
        Raw Observation
                │
                ▼
      Normalized Interaction
                │
                ▼
    Structured AI Extraction
                │
                ▼
       Project Understanding
                │
                ▼
            SQLite
                │
                ▼
      Inspect / Edit / Correct
                │
                ▼
        Generate Context
                │
                ▼
       System Clipboard
                │
                ▼
    Paste into another AI tool
```

Cortex currently understands six kinds of durable project knowledge:

- **Goals** — what the project is trying to accomplish
- **Decisions** — choices that have been made
- **Constraints** — boundaries the project must respect
- **Questions** — unresolved questions
- **Technologies** — relevant technologies and technical choices
- **Notes** — useful project information that does not fit another category

The system intentionally separates **what was observed** from **what Cortex believes is durable project knowledge**.

---

# A concrete example

Suppose you are discussing architecture in one AI tool and copy:

```text
We decided to keep SQLite as the durable local source of truth.
IndexedDB should only be used for renderer-local state if we actually need it.
```

Cortex observes the clipboard change and records the interaction.

If AI extraction is configured, the text can become structured project understanding such as:

```text
Decision
Keep SQLite as the durable local source of truth.

Constraint
IndexedDB should only be used for renderer-local state when necessary.
```

Later you might copy:

```text
We're replacing the previous IndexedDB persistence approach with SQLite.
```

Cortex can represent that evolution rather than pretending both statements are simultaneously current.

When you eventually click **Generate Context**, Cortex compiles the current project state into something closer to:

```text
PROJECT
Cortex

CURRENT GOALS
- Build a persistent context layer that survives switching AI tools.

KEY DECISIONS
- SQLite is the durable local source of truth.

CONSTRAINTS
- IndexedDB should only be used for renderer-local state when necessary.

TECHNOLOGIES
- Electron
- React
- TypeScript
- SQLite

OPEN QUESTIONS
- How should direct browser observation work?

RECENT RELEVANT DEVELOPMENTS
- Clipboard observation is the first implemented capture mechanism.
```

That text is copied to the system clipboard and can be pasted into whichever AI you want to use next.

---

# Core idea: store understanding, not transcripts

Cortex deliberately separates several layers that are easy to collapse into one.

```text
Observation
    ↓
Interaction
    ↓
Understanding
    ↓
Project State
    ↓
Context
```

They are not interchangeable.

## Observation

An observation is something Cortex saw.

In the current MVP, the implemented observation source is the system clipboard.

An observation does **not** decide whether the text is important or what it means.

It is evidence, not truth.

---

## Interaction

The interaction layer normalizes observations into a consistent representation.

This gives downstream systems a stable format without requiring the observer itself to understand project semantics.

The distinction matters because future sources should be able to feed the same pipeline without rewriting project logic.

---

## Understanding

Understanding is the durable semantic layer.

Useful interactions can become structured entries belonging to one of the six current knowledge categories:

```text
goal
decision
constraint
question
technology
note
```

Entries also retain provenance so Cortex can distinguish AI-extracted knowledge from information intentionally entered by the user.

---

## Project state

Understanding belongs to a project.

The current implementation supports multiple projects, including:

- creating projects
- switching the active project
- renaming projects
- deleting projects
- restoring the active project
- maintaining independent knowledge for each project

Project state is persisted locally using SQLite.

---

## Context

Context is **not another database**.

It is a read-only projection of the project's current understanding.

The compiler takes the persisted state and produces portable natural-language context.

Generating context does not make new project decisions or rewrite project memory.

```text
Project State ──→ Context Compiler ──→ Text

       ▲
       │
   source of truth
```

The generated text is a view of the project, not the project itself.

---

# Human correction is part of the architecture

AI-extracted memory should not quietly become unquestionable truth.

Cortex therefore treats human correction as a first-class operation.

From the overlay you can:

- manually add project knowledge
- choose its category
- edit an existing entry
- reclassify an entry
- delete incorrect knowledge
- inspect superseded history

Manual entries are explicitly tracked separately from AI-extracted entries.

More importantly, AI extraction is prevented from superseding manual knowledge automatically.

The human remains the authority over project truth.

---

# Knowledge evolution

Projects change.

A decision that was correct three weeks ago may no longer be correct today.

Simply overwriting old knowledge destroys useful history, while keeping every statement active eventually produces contradictory context.

Cortex instead supports **supersession**.

Conceptually:

```text
Old decision
    │
    │ superseded by
    ▼
New decision
```

The old entry can remain in history while the new entry becomes part of the active project understanding.

The current context compiler primarily uses active knowledge while optionally including a limited amount of important superseded history.

This allows a future AI to understand not only:

> what is true now

but also, where relevant:

> what changed.

---

# AI extraction

Cortex currently includes a working OpenAI-backed understanding extractor.

The extractor receives:

- the active project
- the normalized clipboard interaction
- current active project knowledge

It returns structured candidates rather than unrestricted prose.

The response is constrained to a strict schema containing:

```text
kind
content
reason
supersedesEntryId
```

with `kind` restricted to:

```text
goal
decision
constraint
question
technology
note
```

Extraction is deliberately conservative.

The extractor is instructed to return no entries for text that is:

- casual
- context-free
- sensitive-looking
- not useful as durable project knowledge

It is also instructed to classify only explicit information instead of inventing missing project facts.

---

# Extraction validation

Model output does not go directly into project memory.

Cortex validates extracted results before persistence.

Current safeguards include:

- strict allowed knowledge types
- non-empty content
- content length limits
- reason length limits
- a maximum number of extracted entries per interaction
- validation of supersession references
- supersession only against active entries
- protection of manually created knowledge from AI supersession

This creates an important boundary:

```text
LLM response
     ↓
structured output
     ↓
validation
     ↓
persistence
```

The model proposes understanding.

The application decides whether that proposal is structurally valid.

---

# Context compilation

Context generation is intentionally deterministic.

The compiler reads the current project state and groups active knowledge into:

```text
PROJECT

CURRENT GOALS

KEY DECISIONS

CONSTRAINTS

TECHNOLOGIES

OPEN QUESTIONS

RECENT RELEVANT DEVELOPMENTS
```

Empty sections are omitted.

Active entries are deduplicated before output.

A limited number of superseded entries may be emitted under:

```text
IMPORTANT HISTORICAL CONTEXT
```

when historical information exists.

The compiler itself does not call an LLM.

It does not modify project state.

It does not mark knowledge as used.

It does not create another hidden version of the project.

It simply projects persisted understanding into portable text.

---

# The desktop overlay

Cortex runs as a persistent Electron overlay rather than another full-screen workspace.

The collapsed state keeps Cortex available without demanding attention.

It exposes the active project and current activity state.

Expanding it exposes the current control surface.

The implemented UI currently supports:

**Project management**

Create, switch, rename, and delete projects.

**Observation controls**

Pause or resume clipboard observation.

**Context generation**

Compile the current project understanding and copy it to the clipboard.

**Manual project updates**

Add explicit goals, decisions, constraints, questions, technologies, or notes.

**Project understanding**

Inspect current knowledge grouped by category.

**Corrections**

Edit, reclassify, or delete knowledge.

**History**

Inspect superseded entries.

**AI configuration**

Configure or remove the OpenAI API key used for extraction.

Cortex intentionally does **not** contain an AI chat interface.

The point is not to replace the tools you already use.

---

# Local-first persistence

Project data is stored locally using SQLite through `better-sqlite3`.

The current database represents several distinct concepts:

```text
projects
observations
interactions
understanding_entries
settings
```

### `projects`

Stores project identity and timestamps.

### `observations`

Stores captured source material associated with a project.

### `interactions`

Stores normalized interactions and links them back to their observations.

### `understanding_entries`

Stores durable project knowledge, including:

- project ownership
- originating interaction when applicable
- knowledge type
- content
- reason
- provenance
- active/superseded status
- supersession relationship
- timestamps

### `settings`

Stores small persistent application settings such as the active project and encrypted credential material.

Foreign-key enforcement is enabled for the SQLite connection.

---

# Credentials

Cortex can obtain the OpenAI API key in two ways.

### Environment variable

```bash
OPENAI_API_KEY=...
```

### Cortex settings

The key can also be entered through the desktop UI.

When saved through Cortex, credential storage uses the operating system's secure encryption facility before the encrypted value is persisted.

The UI never redisplays the saved plaintext key.

If secure credential storage is unavailable on the operating system, Cortex refuses to persist the key rather than silently storing it as plaintext.

---

# Clipboard behavior

Clipboard observation is intentionally the first capture mechanism.

It provides a small, understandable vertical slice before Cortex attempts deeper browser or IDE integrations.

The observer handles more than simply polling text.

The implementation distinguishes repeated clipboard state from new clipboard activity and includes protection against Cortex ingesting the context it generated itself.

Without that boundary, this could happen:

```text
Generate Context
      ↓
Cortex writes clipboard
      ↓
Cortex observes clipboard
      ↓
Cortex stores its own output
      ↓
Generate Context
      ↓
feedback loop
```

Generated clipboard writes are therefore marked so they can be ignored by the observation pipeline.

---

# Architecture

The implemented path through Cortex is intentionally layered.

```text
┌──────────────────────────────────────────────┐
│                 Electron App                 │
│        window · lifecycle · preload          │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│                   Observer                   │
│              clipboard capture               │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│                 Interaction                  │
│                 normalization                │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│                     AI                       │
│      structured understanding extraction    │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│                Understanding                 │
│ goals · decisions · constraints · questions │
│           technologies · notes              │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│                  Project                     │
│         persistent project knowledge         │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│                   SQLite                     │
│              durable local state             │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│              Context Compiler                │
│       read-only natural-language view        │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
                 System Clipboard
```

`commands/cortex.ts` currently acts as the thin runtime coordinator connecting these pieces.

---

# Repository structure

The repository contains both implemented MVP code and scaffolding for later Cortex subsystems.

The important distinction is that **the existence of a directory does not mean that integration is implemented yet**.

The current implementation is concentrated around:

```text
cortex/
├── app/
│   ├── main/                 # Electron main process and lifecycle
│   ├── preload/              # constrained renderer ↔ main bridge
│   ├── renderer/             # current overlay UI
│   └── window/               # overlay/window behavior
│
├── observer/
│   └── ...                   # clipboard observation path
│
├── interaction/
│   └── ...                   # observation normalization
│
├── ai/
│   ├── extraction/           # extraction contracts + validation
│   └── providers/
│       └── openai/
│           └── extractor.ts  # current implemented AI extractor
│
├── understanding/
│   └── ...                   # durable knowledge representation
│
├── project/
│   └── ...                   # project/state types
│
├── storage/
│   ├── sqlite/
│   │   └── database.ts       # durable project persistence
│   └── credentials.ts        # secure API-key handling
│
├── context/
│   └── compiler/
│       └── compile.ts        # deterministic context projection
│
├── commands/
│   └── cortex.ts             # runtime coordination
│
└── tests/
    └── ...                   # automated behavior tests
```

Other directories in the repository represent planned architectural boundaries and should not be interpreted as completed integrations.

---

# Technology

The current desktop application uses:

| Layer | Technology |
|---|---|
| Desktop runtime | Electron |
| Language | TypeScript |
| UI | React |
| Styling | CSS Modules |
| Build tooling | Vite / electron-vite |
| Local database | SQLite |
| SQLite driver | better-sqlite3 |
| AI extraction | OpenAI Responses API |
| Testing | Vitest |
| Package manager | pnpm |

---

# Running locally

Cortex is currently an early-stage development project rather than a packaged desktop release.

Clone the repository:

```bash
git clone https://github.com/divsvash/context-layer-temp_name-.git
cd context-layer-temp_name-
```

Install dependencies:

```bash
pnpm install
```

Start the development build:

```bash
pnpm dev
```

Build the application:

```bash
pnpm build
```

Run the test suite:

```bash
pnpm test
```

Preview the built application:

```bash
pnpm preview
```

---

# Configuring AI extraction

AI extraction is optional.

Without an API key, Cortex can still maintain manually entered project knowledge and generate context from persisted understanding.

To enable automatic extraction, either set:

```bash
OPENAI_API_KEY=your_key
```

in the environment before launching Cortex, or configure the key through the Cortex overlay.

The current implementation uses OpenAI for extraction.

Other provider directories currently present in the repository are architectural scaffolding and are **not yet implemented providers**.

---

# Current capabilities

The current MVP implements the core context lifecycle:

```text
capture
  ✓

normalize
  ✓

extract
  ✓

validate
  ✓

persist
  ✓

inspect
  ✓

correct
  ✓

preserve history
  ✓

compile
  ✓

transfer
  ✓
```

More concretely, Cortex currently supports clipboard observation, multi-project local state, persisted active-project selection, structured OpenAI extraction, manual knowledge entry, knowledge correction and deletion, supersession history, pause/resume observation, deterministic context generation, context-to-clipboard transfer, encrypted stored API credentials, and local SQLite persistence.

---

# What Cortex does not do yet

The repository intentionally contains architecture for more than the current MVP implements.

At the moment, Cortex does **not** provide:

- direct ChatGPT conversation capture
- direct Claude conversation capture
- Gemini integration
- DeepSeek integration
- Kimi integration
- Ollama extraction
- browser DOM observation
- browser extensions
- VS Code observation
- Cursor observation
- Figma observation
- Notion observation
- cloud synchronization
- device synchronization
- vector search
- embeddings
- autonomous project modification
- automatic project detection
- a built-in AI chat interface

Some corresponding directories already exist as scaffolding.

They should be read as intended boundaries, not completed features.

---

# Design principles

A few rules drive Cortex's architecture.

### Projects are primary. Conversations are temporary.

The long-lived object is the project, not an individual AI conversation.

### Observation is not understanding.

Seeing text does not automatically make it project truth.

### AI proposes. Humans decide.

Extracted knowledge remains inspectable and correctable.

### Context is compiled, not copied.

The goal is not to accumulate giant chat transcripts. Cortex attempts to preserve durable understanding and generate the context required at the point of use.

### History should explain change.

Replacing an old decision should not require pretending that decision never existed.

### Generated context is read-only.

Context generation projects current state. It does not mutate that state.

### Local state should remain useful without AI.

The project store and compiler are not dependent on an LLM being available.

### Cortex should stay out of the way.

The intended workflow is still:

```text
99% → work inside the tools you already use
 1% → interact with Cortex when context needs attention
```

---

# Why not just use chat history?

Chat history answers:

> What happened in this conversation?

Cortex is trying to answer:

> What is true about this project now, how did it get here, and what does another model need to know to continue?

Those are different problems.

A transcript might contain:

```text
"We should use MongoDB."

"Actually SQLite is probably enough."

"Wait — because this is local-first, SQLite should be the source of truth."

"Yeah, lock that."
```

Blindly transferring the transcript forces the next model to reconstruct the decision.

Project understanding should instead preserve something closer to:

```text
Decision:
SQLite is the durable local source of truth.

Reason:
The application is local-first.
```

while retaining important historical information when it matters.

That distinction—**conversation history vs project understanding**—is the core experiment behind Cortex.

---

# Direction

Clipboard capture is deliberately only the first observation surface.

The broader direction is to let multiple environments contribute evidence to the same persistent project understanding:

```text
ChatGPT ──────┐
Claude ───────┤
Gemini ───────┤
Browser ──────┤
Cursor ───────┼──→ Cortex ──→ Project Understanding
VS Code ──────┤
Figma ────────┤
Notion ───────┘
```

And then allow that same understanding to be projected back into whichever tool is best for the next task.

The important part is not supporting the largest number of providers.

It is maintaining **one coherent project state across them**.

---

# Status

Cortex is under active development.

The current repository should be considered an **early working MVP / systems prototype**.

The core loop exists:

> observe → normalize → extract → persist → correct → compile → transfer

The harder work comes next: richer observation surfaces, stronger understanding and reconciliation, better context projection, and eventually reliable continuity across substantially different AI environments.

For now, the target is much smaller:

**Copy something useful. Let Cortex remember it. Switch tools. Keep working.**

---


Built as an experiment in persistent context, model-independent project memory, and what happens when the memory layer belongs to the user instead of the chat.
