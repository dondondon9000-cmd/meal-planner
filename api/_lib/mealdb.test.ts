import { describe, expect, it } from 'vitest'
import { mapMealDbMeal } from './mealdb.js'

describe('mapMealDbMeal', () => {
  it('maps ingredients, instructions, and attribution into a household recipe', () => {
    const recipe = mapMealDbMeal({
      idMeal: '42', strMeal: 'Garden Pie', strArea: 'British', strCategory: 'Vegetarian',
      strIngredient1: 'Potato', strMeasure1: '2 cups', strIngredient2: '', strMeasure2: '',
      strInstructions: 'Prepare the filling. Bake until golden.', strSource: 'https://example.com/recipe',
    })
    expect(recipe.id).toBe('mealdb-42')
    expect(recipe.ingredients).toHaveLength(1)
    expect(recipe.instructions).toEqual(['Prepare the filling.', 'Bake until golden.'])
    expect(recipe.source).toBe('TheMealDB')
  })
})
