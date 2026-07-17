# Principles

These principles define how the system should think, evolve, and make trade-offs. Every architectural decision, feature, and interaction should reinforce these principles. If a future implementation conflicts with one of them, the implementation should be questioned before the principle is.

---

## 1. Continuity over Sessions

Conversations are temporary.

Projects persist.

The system exists to maintain continuity across sessions, tools, and models. A user should never feel like they are "starting over" simply because they switched to another AI.

---

## 2. Understanding over Memory

Memory is storage.

Understanding is interpretation.

The goal is not to remember everything the user said. The goal is to understand what the user is trying to accomplish, how their thinking evolves, and what knowledge should persist.

---

## 3. Knowledge over Transcripts

Raw conversations are implementation details.

Structured knowledge is the product.

Chat logs are noisy, repetitive, and model-specific. The system extracts and maintains meaningful project knowledge rather than treating conversations as the source of truth.

---

## 4. Intent over Text

The value of a conversation is not the words that were typed.

The value is the intent, conclusions, assumptions, and decisions that emerged from it.

The system preserves meaning, not wording.

---

## 5. Reasons over Conclusions

A decision without its reasoning is incomplete.

The system should preserve:

* why a decision was made
* what alternatives were considered
* what evidence supported it
* what constraints influenced it

Reasoning is first-class knowledge.

---

## 6. Projects over Conversations

A conversation is only an interaction with a project.

The project is the persistent entity.

Every conversation should contribute to an evolving project state rather than becoming an isolated record.

---

## 7. Compiled Context over Copied Context

The system does not transfer conversations.

It compiles project understanding into the most relevant context for the next AI, task, or workflow.

Every destination receives the context it actually needs—not a generic summary.

---

## 8. Humans Own Truth

AI can observe.

AI can infer.

AI can recommend.

Only the user determines what becomes canonical project knowledge.

The human is always the final authority.

---

## 9. Models Are Replaceable

No feature should depend on a specific AI model or provider.

The cognitive layer should remain stable while the underlying AI ecosystem continues to evolve.

Models are execution engines.

The project state is permanent.

---

## 10. The Human Is Never the Message Bus

Users should not spend their time remembering context, rewriting prompts, or manually transferring knowledge between AI systems.

The cognitive layer exists to eliminate orchestration overhead so people can focus on thinking rather than coordination.

---

## 11. Knowledge Evolves

Ideas become hypotheses.

Hypotheses become decisions.

Decisions become obsolete.

The system should preserve this evolution rather than pretending knowledge is static.

Project understanding is a living structure.

---

## 12. Minimize Cognitive Friction

The best interaction is often no interaction.

The system should integrate naturally into existing workflows, requiring as little manual effort as possible while remaining transparent and controllable.

It should quietly amplify human thinking rather than constantly demanding attention.

---

# Foundational Belief

The project is the source of truth.

Conversations are observations of the project.

The cognitive layer exists to continuously transform those observations into persistent understanding.

Everything else—memory, summaries, context transfer, orchestration, and AI collaboration—is a consequence of this single idea.
