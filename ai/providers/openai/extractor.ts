import type { ExtractionInput, UnderstandingCandidate, UnderstandingExtractor } from '../../extraction/extractor';
import { validateExtractionOutput } from '../../extraction/extractor';

interface OpenAIResponse {
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
}

export class OpenAIUnderstandingExtractor implements UnderstandingExtractor {
  constructor(
    private readonly getApiKey: () => string | null,
    private readonly model = 'gpt-4o-mini',
    private readonly request: typeof fetch = fetch,
  ) {}

  isAvailable(): boolean {
    return this.getApiKey() !== null;
  }

  async extract(input: ExtractionInput): Promise<UnderstandingCandidate[]> {
    const apiKey = this.getApiKey();
    if (!apiKey) return [];

    const response = await this.request('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        instructions: [
          'You extract durable project knowledge from one clipboard interaction.',
          'Return zero entries when the text is casual, context-free, sensitive-looking, or not useful project knowledge.',
          'Classify only explicit information. Never infer facts that are not stated.',
          'Use note only for useful project knowledge that does not fit another category.',
          'A supersession reference is allowed only when the new text explicitly replaces an existing non-manual entry.',
        ].join(' '),
        input: JSON.stringify({
          project: input.project.name,
          interaction: input.interaction.content,
          currentKnowledge: input.activeEntries.map((entry) => ({
            id: entry.id,
            kind: entry.kind,
            content: entry.content,
            provenance: entry.provenance,
          })),
        }),
        text: {
          format: {
            type: 'json_schema',
            name: 'cortex_understanding',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['entries'],
              properties: {
                entries: {
                  type: 'array',
                  maxItems: 8,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['kind', 'content', 'reason', 'supersedesEntryId'],
                    properties: {
                      kind: { type: 'string', enum: ['goal', 'decision', 'constraint', 'question', 'technology', 'note'] },
                      content: { type: 'string', minLength: 1, maxLength: 2000 },
                      reason: { type: ['string', 'null'], maxLength: 1000 },
                      supersedesEntryId: { type: ['string', 'null'] },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI extraction request failed (${response.status})`);
    }

    const data = await response.json() as OpenAIResponse;
    const text = data.output?.flatMap((item) => item.content ?? []).find((item) => item.type === 'output_text')?.text;
    if (!text) throw new Error('OpenAI extraction response did not contain structured output');

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('OpenAI extraction response was not valid JSON');
    }
    return validateExtractionOutput(parsed, input.activeEntries);
  }
}
