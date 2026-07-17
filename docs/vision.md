# Vision

## Working Title

(Codename for now)

---

# The Problem

Today's AI systems are incredibly capable, yet working across them is surprisingly primitive.

People who use ChatGPT, Claude, Gemini, Cursor, Windsurf and other AI tools become the orchestration layer themselves.

They manually:

- remember previous conversations
- summarize context
- decide which model to use
- rewrite prompts
- copy conversations between tools
- explain why earlier decisions were made

Every conversation becomes an isolated island.

The user continuously reconstructs project state from memory.

As projects become larger, the cost of context switching becomes greater than the cost of asking the AI.

The bottleneck is no longer intelligence.

The bottleneck is orchestration.

---

# The Observation

Current AI products treat conversations as the primary object.

We believe this is the wrong abstraction.

A conversation is only one temporary interaction with a project.

Projects outlive conversations.

Knowledge outlives prompts.

Reasoning outlives chats.

The project—not the conversation—should become the persistent unit.

---

# Our Thesis

AI chats should be stateless.

Projects should not.

Instead of every conversation independently accumulating context, there should exist a persistent cognitive layer that continuously understands the project regardless of which AI is currently being used.

The user should never have to manually rebuild context.

---

# What We Are Building

A cognitive operating layer that lives above existing AI systems.

Rather than replacing ChatGPT, Claude or Cursor, it coordinates them.

It continuously maintains an evolving understanding of:

- goals
- decisions
- constraints
- open questions
- tasks
- reasoning
- project evolution

When switching between AI systems, it transfers understanding instead of conversation history.

---

# Core Principle

We do not store chats.

We maintain project state.

Chats become disposable.

Knowledge persists.

---

# What Makes This Different

This is not:

- another chatbot
- another AI wrapper
- another memory feature
- another note-taking application
- another prompt library

Instead, it is a persistent cognitive layer.

The project itself becomes the source of truth.

---

# Long-Term Vision

Today people think in terms of:

"I was talking to Claude."

Tomorrow they should think:

"I'm building Project X."

The AI used becomes an implementation detail.

The project becomes continuous.

The intelligence becomes persistent.

---

# Success

A successful system makes AI conversations feel interchangeable.

Users should be able to switch between any model without thinking about context transfer.

The cognitive layer quietly maintains continuity while the underlying AI ecosystem continues to evolve.

The operating system for AI work is not another model.

It is the layer that understands the work itself.

# Design Principles

1. Projects over conversations.
2. Knowledge over transcripts.
3. Reasons over summaries.
4. Human remains in control.
5. AI models are replaceable.
6. Local-first where possible.
7. Structured state over free-form memory.
8. Minimize orchestration friction.