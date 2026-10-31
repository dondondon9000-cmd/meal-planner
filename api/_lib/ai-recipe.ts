import type { Recipe } from '../../src/model.js'

export const recipeSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'description', 'cuisine', 'minutes', 'cost', 'servings', 'ingredients', 'instructions'],
  properties: {
    title: { type: 'string', minLength: 3, maxLength: 90 },
    description: { type: 'string', minLength: 10, maxLength: 220 },
    cuisine: { type: 'string', minLength: 2, maxLength: 50 },
    minutes: { type: 'integer', minimum: 5, maximum: 240 },
    cost: { type: 'string', enum: ['$', '$$', '$$$'] },
    servings: { type: 'integer', minimum: 1, maximum: 12 },
    ingredients: {
      type: 'array', minItems: 2, maxItems: 24,
      items: {
        type: 'object', additionalProperties: false,
        required: ['name', 'amount', 'unit', 'category'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 80 },
          amount: { type: 'number', minimum: 0.01, maximum: 100 },
          unit: { type: 'string', minLength: 1, maxLength: 30 },
          category: { type: 'string', minLength: 1, maxLength: 40 },
        },
      },
    },
    instructions: { type: 'array', minItems: 2, maxItems: 18, items: { type: 'string', minLength: 3, maxLength: 400 } },
  },
} as const

export function extractToolInput(response: Record<string, unknown>): unknown {
  const content = Array.isArray(response.content) ? response.content : []
  for (const block of content) {
    if (block && typeof block === 'object' && (block as { type?: unknown }).type === 'tool_use') return (block as { input?: unknown }).input
  }
  throw new Error('The model did not return a recipe')
}

export function toAiRecipe(value: Omit<Recipe, 'id' | 'color' | 'sourceType' | 'source' | 'sourceUrl' | 'favorite'>, responseId: string): Recipe {
  return {
    ...value,
    id: `ai-${responseId}`,
    color: '#73536f',
    sourceType: 'AI draft',
    source: 'Claude',
    ingredients: value.ingredients.map(ingredient => ({ ...ingredient, store: 'Walmart' })),
  }
}
