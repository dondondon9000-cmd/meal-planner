import { describe, expect, it } from 'vitest'
import { buildGroceryList, buildWeekDraft, findPantryItem, formatAmount, isExpired, locationColor, locationZoneOf, matchRecipesToPantry, parseIngredientLine, parsePantryEntry, recipeConflicts, type MealSlot, type PantryItem, type Recipe } from './model'

const recipe: Recipe = {
  id: 'r', title: 'Test stew', description: '', cuisine: 'Test', minutes: 10, cost: '$', servings: 4,
  sourceType: 'Family recipe', color: '#000', instructions: [], ingredients: [
    { name: 'Carrot', amount: 4, unit: 'each', category: 'Produce' },
    { name: 'Broth', amount: 2, unit: 'cups', category: 'Pantry' },
  ],
}

describe('buildGroceryList', () => {
  it('scales ingredients and merges compatible units', () => {
    const slots: MealSlot[] = [
      { id: 'a', day: 0, kind: 'Dinner', recipeId: 'r', diners: ['1', '2'], servings: 2 },
      { id: 'b', day: 2, kind: 'Dinner', recipeId: 'r', diners: ['1', '2', '3', '4'], servings: 4 },
    ]
    const list = buildGroceryList(slots, [recipe], [])
    expect(list.find(i => i.name === 'Carrot')?.amount).toBe(6)
    expect(list.find(i => i.name === 'Broth')?.amount).toBe(3)
  })

  it('subtracts only confirmed pantry quantities', () => {
    const slots: MealSlot[] = [{ id: 'a', day: 0, kind: 'Dinner', recipeId: 'r', diners: ['1', '2', '3', '4'], servings: 4 }]
    const pantry: PantryItem[] = [
      { id: 'p1', name: 'carrot', amount: 3, unit: 'each', confirmed: true },
      { id: 'p2', name: 'broth', amount: 2, unit: 'cup', confirmed: false },
    ]
    const list = buildGroceryList(slots, [recipe], pantry)
    expect(list.find(i => i.name === 'Carrot')?.amount).toBe(1)
    expect(list.find(i => i.name === 'Broth')?.amount).toBe(2)
  })

  it('does not add ingredients for leftover placements', () => {
    const slots: MealSlot[] = [
      { id: 'a', day: 0, kind: 'Dinner', recipeId: 'r', diners: ['1', '2', '3', '4'], servings: 4 },
      { id: 'b', day: 1, kind: 'Lunch', recipeId: 'r', diners: ['1', '2'], servings: 2, leftoverFrom: 'a' },
    ]
    expect(buildGroceryList(slots, [recipe], []).find(i => i.name === 'Carrot')?.amount).toBe(4)
  })

  it('keeps incompatible units separate', () => {
    const variant = { ...recipe, id: 'r2', ingredients: [{ name: 'Carrot', amount: 1, unit: 'lb', category: 'Produce' }] }
    const slots: MealSlot[] = [
      { id: 'a', day: 0, kind: 'Dinner', recipeId: 'r', diners: ['1', '2', '3', '4'], servings: 4 },
      { id: 'b', day: 1, kind: 'Dinner', recipeId: 'r2', diners: ['1', '2', '3', '4'], servings: 4 },
    ]
    expect(buildGroceryList(slots, [recipe, variant], []).filter(i => i.name === 'Carrot')).toHaveLength(2)
  })
})

describe('ingredient and recommendation helpers', () => {
  it('parses mixed and unicode quantities', () => {
    expect(parseIngredientLine('1 1/2 cups broth')).toMatchObject({ name: 'broth', amount: 1.5, unit: 'cup' })
    expect(parseIngredientLine('2½ lb potatoes')).toMatchObject({ name: 'potatoes', amount: 2.5, unit: 'lb' })
    expect(formatAmount(.5)).toBe('½')
  })

  it('ranks recipes by confirmed pantry coverage', () => {
    const pantry: PantryItem[] = [{ id: 'p', name: 'carrot', amount: 4, unit: 'each', confirmed: true }]
    expect(matchRecipesToPantry([recipe], pantry, [])[0]).toMatchObject({ matched: 1, total: 2, percent: 50 })
  })

  it('flags listed allergies and excludes them from a drafted week', () => {
    const nutRecipe = { ...recipe, id: 'nuts', ingredients: [{ name: 'walnuts', amount: 1, unit: 'cup', category: 'Pantry' }] }
    const members = [{ id: 'm', name: 'Sam', initials: 'S', color: '#000', kind: 'human' as const, allergies: 'Tree nuts' }]
    expect(recipeConflicts(nutRecipe, members)).toBe(true)
    const draft = buildWeekDraft([nutRecipe, recipe], members, { cookingLimit: 45, budget: 'Flexible' }, [])
    expect(draft).toHaveLength(7)
    expect(draft.every(slot => slot.recipeId === 'r')).toBe(true)
  })
})

describe('isExpired', () => {
  const item: PantryItem = { id: 'p', name: 'milk', amount: 1, unit: 'each', confirmed: true }
  it('is false when there is no expiration date', () => {
    expect(isExpired(item)).toBe(false)
  })
  it('is true once the expiration date has passed', () => {
    expect(isExpired({ ...item, expiresAt: '2020-01-01' }, new Date('2020-06-01'))).toBe(true)
  })
  it('is false on and before the expiration date', () => {
    expect(isExpired({ ...item, expiresAt: '2020-06-01' }, new Date('2020-06-01'))).toBe(false)
    expect(isExpired({ ...item, expiresAt: '2020-12-01' }, new Date('2020-06-01'))).toBe(false)
  })
})

describe('parsePantryEntry', () => {
  it('defaults new items to full fullness', () => {
    expect(parsePantryEntry('2 cans black beans').fullness).toBe('full')
    expect(parsePantryEntry('spaghetti').fullness).toBe('full')
  })
})

describe('findPantryItem', () => {
  it('matches a confirmed pantry item by fuzzy name and skips unconfirmed ones', () => {
    const pantry: PantryItem[] = [
      { id: 'a', name: 'crushed tomatoes', amount: 1, unit: 'can', confirmed: true, location: 'Pantry Shelf 2' },
      { id: 'b', name: 'garlic', amount: 2, unit: 'clove', confirmed: false },
    ]
    expect(findPantryItem('tomatoes', pantry)?.id).toBe('a')
    expect(findPantryItem('garlic', pantry)).toBeUndefined()
    expect(findPantryItem('basil', pantry)).toBeUndefined()
  })

  it('does not treat an unrelated compound item as a match for its first word', () => {
    const pantry: PantryItem[] = [
      { id: 'a', name: 'carrot cake', amount: 1, unit: 'each', confirmed: true, location: 'Pantry Shelf 4' },
      { id: 'b', name: 'garlic bread', amount: 1, unit: 'each', confirmed: true, location: 'Pantry Shelf 4' },
    ]
    expect(findPantryItem('carrots', pantry)).toBeUndefined()
    expect(findPantryItem('garlic', pantry)).toBeUndefined()
  })

  it('still matches a qualified variant of the same food', () => {
    const pantry: PantryItem[] = [
      { id: 'a', name: 'yellow onion', amount: 2, unit: 'each', confirmed: true },
      { id: 'b', name: 'roasted garlic', amount: 1, unit: 'clove', confirmed: true },
    ]
    expect(findPantryItem('onion', pantry)?.id).toBe('a')
    expect(findPantryItem('garlic', pantry)?.id).toBe('b')
  })

  it('treats a "with"/"in" flavor note as secondary, not the primary food', () => {
    const pantry: PantryItem[] = [
      { id: 'a', name: 'tuna with basil', amount: 1, unit: 'can', confirmed: true },
      { id: 'b', name: 'peaches in syrup', amount: 1, unit: 'can', confirmed: true },
    ]
    expect(findPantryItem('basil', pantry)).toBeUndefined()
    expect(findPantryItem('tuna', pantry)?.id).toBe('a')
    expect(findPantryItem('syrup', pantry)).toBeUndefined()
    expect(findPantryItem('peaches', pantry)?.id).toBe('b')
  })

  it('matches a staple described only with safe descriptors, not a different dish sharing a word', () => {
    const pantry: PantryItem[] = [
      { id: 'a', name: 'carrot cake', amount: 1, unit: 'each', confirmed: true, location: 'Pantry Shelf 4' },
      { id: 'b', name: 'sliced carrots', amount: 1, unit: 'can', confirmed: true, location: 'Pantry Shelf 2' },
    ]
    expect(findPantryItem('carrots', pantry)?.id).toBe('b')
  })

  it('does not match a processed form of the same base food, e.g. condensed milk for milk', () => {
    const pantry: PantryItem[] = [
      { id: 'a', name: 'condensed milk', amount: 1, unit: 'can', confirmed: true, location: 'Pantry Shelf 5' },
    ]
    expect(findPantryItem('milk', pantry)).toBeUndefined()
  })

  it('a brand-prefixed item only matches once the brand name is dropped', () => {
    const pantry: PantryItem[] = [
      { id: 'a', name: 'schnucks sliced carrots', amount: 1, unit: 'can', confirmed: true },
    ]
    expect(findPantryItem('carrots', pantry)).toBeUndefined()
  })
})

describe('pantry locations', () => {
  it('resolves a specific location to its zone and color', () => {
    expect(locationZoneOf('Deep Freezer 2 Shelf 3')).toBe('Deep Freezer 2')
    expect(locationColor('Deep Freezer 2 Shelf 3')).toBe(locationColor('Deep Freezer 2 Shelf 1'))
    expect(locationZoneOf('Cabinet 2')).toBe('Cabinets')
  })
  it('returns undefined for an unset or unknown location', () => {
    expect(locationZoneOf(undefined)).toBeUndefined()
    expect(locationColor('Garage Shelf')).toBeUndefined()
  })
})
