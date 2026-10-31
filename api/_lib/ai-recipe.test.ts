import { describe, expect, it } from 'vitest'
import { extractToolInput, toAiRecipe } from './ai-recipe.js'

describe('AI recipe helpers', () => {
  it('extracts the tool_use input and maps it to a savable recipe', () => {
    const input = extractToolInput({ content: [{ type: 'text', text: 'ignored' }, { type: 'tool_use', name: 'household_recipe', input: { title: 'Soup' } }] })
    expect(input).toEqual({ title: 'Soup' })
    const recipe = toAiRecipe({
      title: 'Weeknight Soup', description: 'A simple vegetable soup.', cuisine: 'American', minutes: 30, cost: '$', servings: 4,
      ingredients: [{ name: 'carrot', amount: 2, unit: 'each', category: 'Produce' }], instructions: ['Chop the carrot.', 'Simmer until tender.'],
    }, 'response-1')
    expect(recipe.id).toBe('ai-response-1')
    expect(recipe.sourceType).toBe('AI draft')
    expect(recipe.source).toBe('Claude')
    expect(recipe.ingredients[0].store).toBe('Walmart')
  })

  it('throws when no tool_use block is present', () => {
    expect(() => extractToolInput({ content: [{ type: 'text', text: 'no tool call here' }] })).toThrow()
  })
})
