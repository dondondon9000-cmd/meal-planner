import { describe, expect, it } from 'vitest'
import { extractResponseText, toAiRecipe } from './ai-recipe.js'

describe('AI recipe helpers', () => {
  it('extracts structured response text and maps it to a savable recipe', () => {
    const text = extractResponseText({ output: [{ content: [{ type: 'output_text', text: '{"title":"Soup"}' }] }] })
    expect(text).toContain('Soup')
    const recipe = toAiRecipe({
      title: 'Weeknight Soup', description: 'A simple vegetable soup.', cuisine: 'American', minutes: 30, cost: '$', servings: 4,
      ingredients: [{ name: 'carrot', amount: 2, unit: 'each', category: 'Produce' }], instructions: ['Chop the carrot.', 'Simmer until tender.'],
    }, 'response-1')
    expect(recipe.id).toBe('ai-response-1')
    expect(recipe.sourceType).toBe('AI draft')
    expect(recipe.ingredients[0].store).toBe('Walmart')
  })
})
