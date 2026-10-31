export type MealKind = 'Breakfast' | 'Lunch' | 'Dinner'
export type Room = 'hearth' | 'recipes' | 'pantry' | 'shopping' | 'household'

export type Member = {
  id: string
  name: string
  initials: string
  color: string
  kind: 'human' | 'dog'
  allergies?: string
  dislikes?: string
}

export type Ingredient = {
  name: string
  amount: number
  unit: string
  category: string
  store?: string
}

export type Recipe = {
  id: string
  title: string
  description: string
  cuisine: string
  minutes: number
  cost: '$' | '$$' | '$$$'
  servings: number
  ingredients: Ingredient[]
  instructions: string[]
  sourceType: 'Hearth original' | 'Family recipe' | 'Sourced recipe' | 'AI draft'
  source?: string
  sourceUrl?: string
  imageUrl?: string
  favorite?: boolean
  rating?: number
  notes?: string
  cookedCount?: number
  lastCookedAt?: string
  color: string
}

export type MealSlot = {
  id: string
  day: number
  kind: MealKind
  recipeId: string
  diners: string[]
  servings: number
  leftoverFrom?: string
}

export type FullnessLevel = 'full' | 'three_quarters' | 'half' | 'quarter' | 'low'
export type PantryItem = {
  id: string; name: string; amount: number; unit: string; confirmed: boolean
  expiresAt?: string; fullness?: FullnessLevel; note?: string; location?: string
}

export const fullnessLevels: FullnessLevel[] = ['full', 'three_quarters', 'half', 'quarter', 'low']
export const fullnessLabels: Record<FullnessLevel, string> = {
  full: 'Full / new', three_quarters: 'Three-quarters', half: 'Half', quarter: 'Quarter', low: 'Low / almost gone',
}

export function isExpired(item: PantryItem, today = new Date()): boolean {
  if (!item.expiresAt) return false
  return item.expiresAt < today.toISOString().slice(0, 10)
}

export type LocationZone = 'Pantry' | 'Fridge' | 'Deep Freezer 1' | 'Deep Freezer 2' | 'Spice Shelf' | 'Cabinets'

export const locationZones: LocationZone[] = ['Pantry', 'Fridge', 'Deep Freezer 1', 'Deep Freezer 2', 'Spice Shelf', 'Cabinets']

export const locationZoneColors: Record<LocationZone, string> = {
  'Pantry': '#c78637',
  'Fridge': '#4f93c4',
  'Deep Freezer 1': '#6f7fd8',
  'Deep Freezer 2': '#8f6fd8',
  'Spice Shelf': '#c05a4a',
  'Cabinets': '#6f9c6b',
}

export const pantryLocationsByZone: Record<LocationZone, string[]> = {
  'Pantry': ['Pantry Shelf 1', 'Pantry Shelf 2', 'Pantry Shelf 3', 'Pantry Shelf 4', 'Pantry Shelf 5', 'Pantry Floor'],
  'Fridge': ['Fridge Shelf 1', 'Fridge Shelf 2', 'Fridge Shelf 3', 'Fridge Shelf 4', 'Fridge Shelf 5', 'Fridge Drawer 1', 'Fridge Drawer 2', 'Fridge Door Top', 'Fridge Door Bottom'],
  'Deep Freezer 1': ['Deep Freezer 1'],
  'Deep Freezer 2': ['Deep Freezer 2 Shelf 1', 'Deep Freezer 2 Shelf 2', 'Deep Freezer 2 Shelf 3', 'Deep Freezer 2 Shelf 4', 'Deep Freezer 2 Shelf 5', 'Deep Freezer 2 Shelf 6'],
  'Spice Shelf': ['Spice Shelf'],
  'Cabinets': ['Cabinet 1', 'Cabinet 2'],
}

const locationZoneByLabel = new Map<string, LocationZone>(
  locationZones.flatMap(zone => pantryLocationsByZone[zone].map(label => [label, zone] as const))
)

export function locationZoneOf(location?: string): LocationZone | undefined {
  return location ? locationZoneByLabel.get(location) : undefined
}

export function locationColor(location?: string): string | undefined {
  const zone = locationZoneOf(location)
  return zone ? locationZoneColors[zone] : undefined
}
export type GroceryItem = Ingredient & { id: string; checked: boolean; review?: boolean; source: 'plan' | 'manual' | 'pet' }

export const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const mealKinds: MealKind[] = ['Breakfast', 'Lunch', 'Dinner']

export const seedMembers: Member[] = [
  { id: 'alex', name: 'Alex', initials: 'AL', color: '#c27543', kind: 'human' },
  { id: 'sam', name: 'Sam', initials: 'SA', color: '#608f72', kind: 'human', allergies: 'Tree nuts' },
  { id: 'june', name: 'June', initials: 'JU', color: '#9c6c88', kind: 'human' },
  { id: 'milo', name: 'Milo', initials: 'MI', color: '#567e91', kind: 'human', dislikes: 'Mushrooms' },
  { id: 'ella', name: 'Ella', initials: 'EL', color: '#b99a4b', kind: 'human' },
  { id: 'noah', name: 'Noah', initials: 'NO', color: '#846bb0', kind: 'human' },
  { id: 'bramble', name: 'Bramble', initials: '🐾', color: '#8b6847', kind: 'dog' },
]

export const seedRecipes: Recipe[] = [
  {
    id: 'oats', title: 'Apple-Cinnamon Hearth Oats', description: 'Creamy oats with soft apples and maple.', cuisine: 'Breakfast', minutes: 18, cost: '$', servings: 4, color: '#be7f3d', sourceType: 'Hearth original',
    ingredients: [
      { name: 'rolled oats', amount: 2, unit: 'cup', category: 'Grains', store: 'Walmart' },
      { name: 'milk', amount: 3, unit: 'cup', category: 'Dairy', store: 'Walmart' },
      { name: 'apple', amount: 2, unit: 'each', category: 'Produce', store: 'Farmers Market' },
      { name: 'maple syrup', amount: 3, unit: 'tbsp', category: 'Pantry', store: 'Walmart' },
    ],
    instructions: ['Dice the apples.', 'Simmer oats and milk until creamy.', 'Fold in apples, cinnamon, and maple syrup.'],
  },
  {
    id: 'soup', title: 'Golden Root & Lentil Soup', description: 'A bright one-pot supper with lemon and herbs.', cuisine: 'Mediterranean', minutes: 42, cost: '$', servings: 6, color: '#c89235', favorite: true, sourceType: 'Hearth original',
    ingredients: [
      { name: 'carrot', amount: 4, unit: 'each', category: 'Produce', store: 'Walmart' },
      { name: 'red lentils', amount: 2, unit: 'cup', category: 'Pantry', store: 'Walmart' },
      { name: 'vegetable broth', amount: 6, unit: 'cup', category: 'Pantry', store: 'Walmart' },
      { name: 'lemon', amount: 1, unit: 'each', category: 'Produce', store: 'Farmers Market' },
      { name: 'spinach', amount: 5, unit: 'oz', category: 'Produce', store: 'Farmers Market' },
    ],
    instructions: ['Sauté chopped carrots with olive oil.', 'Add lentils and broth; simmer 25 minutes.', 'Stir in spinach and lemon. Season to taste.'],
  },
  {
    id: 'chicken', title: 'Rosemary Sheet-Pan Chicken', description: 'Crisp chicken, potatoes, and green beans.', cuisine: 'American', minutes: 50, cost: '$$', servings: 6, color: '#9b5d46', favorite: true, sourceType: 'Family recipe',
    ingredients: [
      { name: 'chicken thighs', amount: 3, unit: 'lb', category: 'Meat', store: 'Walmart' },
      { name: 'baby potatoes', amount: 2, unit: 'lb', category: 'Produce', store: 'Walmart' },
      { name: 'green beans', amount: 1, unit: 'lb', category: 'Produce', store: 'Farmers Market' },
      { name: 'rosemary', amount: 3, unit: 'tbsp', category: 'Produce', store: 'Farmers Market' },
    ],
    instructions: ['Heat oven to 425°F.', 'Toss everything with olive oil, salt, and pepper.', 'Roast 35–40 minutes until chicken is cooked through.'],
  },
  {
    id: 'tacos', title: 'Smoky Black Bean Tacos', description: 'Fast weeknight tacos with lime slaw.', cuisine: 'Mexican-inspired', minutes: 28, cost: '$', servings: 4, color: '#7f6634', sourceType: 'Hearth original',
    ingredients: [
      { name: 'black beans', amount: 2, unit: 'can', category: 'Pantry', store: 'Walmart' },
      { name: 'corn tortillas', amount: 12, unit: 'each', category: 'Bakery', store: 'Mercado' },
      { name: 'cabbage', amount: 0.5, unit: 'head', category: 'Produce', store: 'Walmart' },
      { name: 'lime', amount: 2, unit: 'each', category: 'Produce', store: 'Mercado' },
      { name: 'avocado', amount: 2, unit: 'each', category: 'Produce', store: 'Mercado' },
    ],
    instructions: ['Warm beans with cumin and smoked paprika.', 'Toss shredded cabbage with lime.', 'Fill warm tortillas and top with avocado.'],
  },
  {
    id: 'pasta', title: 'Tomato Basil Pantry Pasta', description: 'A dependable family favorite from shelf staples.', cuisine: 'Italian', minutes: 25, cost: '$', servings: 6, color: '#984f49', sourceType: 'Family recipe',
    ingredients: [
      { name: 'spaghetti', amount: 1.5, unit: 'lb', category: 'Grains', store: 'Walmart' },
      { name: 'crushed tomatoes', amount: 2, unit: 'can', category: 'Pantry', store: 'Walmart' },
      { name: 'garlic', amount: 4, unit: 'clove', category: 'Produce', store: 'Walmart' },
      { name: 'basil', amount: 1, unit: 'bunch', category: 'Produce', store: 'Farmers Market' },
      { name: 'parmesan', amount: 4, unit: 'oz', category: 'Dairy', store: 'Walmart' },
    ],
    instructions: ['Boil pasta in salted water.', 'Simmer tomatoes and garlic for 15 minutes.', 'Toss together with basil and parmesan.'],
  },
  {
    id: 'salad', title: 'Orchard Chicken Salad', description: 'Crunchy apples, greens, chicken, and cider dressing.', cuisine: 'American', minutes: 20, cost: '$$', servings: 4, color: '#587c53', sourceType: 'Hearth original',
    ingredients: [
      { name: 'cooked chicken', amount: 1, unit: 'lb', category: 'Meat', store: 'Walmart' },
      { name: 'mixed greens', amount: 8, unit: 'oz', category: 'Produce', store: 'Farmers Market' },
      { name: 'apple', amount: 2, unit: 'each', category: 'Produce', store: 'Farmers Market' },
      { name: 'cheddar', amount: 4, unit: 'oz', category: 'Dairy', store: 'Walmart' },
    ],
    instructions: ['Slice chicken and apples.', 'Whisk cider vinegar, mustard, and olive oil.', 'Toss and serve immediately.'],
  },
]

export const seedSlots: MealSlot[] = [
  { id: 's1', day: 0, kind: 'Dinner', recipeId: 'chicken', diners: ['alex', 'sam', 'june', 'milo', 'ella', 'noah'], servings: 6 },
  { id: 's2', day: 1, kind: 'Breakfast', recipeId: 'oats', diners: ['alex', 'sam', 'june', 'milo'], servings: 4 },
  { id: 's3', day: 2, kind: 'Dinner', recipeId: 'tacos', diners: ['alex', 'sam', 'ella', 'noah'], servings: 4 },
  { id: 's4', day: 4, kind: 'Dinner', recipeId: 'soup', diners: ['alex', 'sam', 'june', 'milo', 'ella', 'noah'], servings: 6 },
]

const singular = (unit: string) => unit.toLowerCase().replace(/s$/, '')
export const normalizeName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ')

const units = ['tablespoons', 'tablespoon', 'tbsp', 'teaspoons', 'teaspoon', 'tsp', 'cups', 'cup', 'ounces', 'ounce', 'oz', 'pounds', 'pound', 'lbs', 'lb', 'cans', 'can', 'cloves', 'clove', 'packages', 'package', 'bags', 'bag', 'heads', 'head', 'bunches', 'bunch', 'each']
const unicodeFractions: Record<string, number> = { '¼': .25, '½': .5, '¾': .75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': .125, '⅜': .375, '⅝': .625, '⅞': .875 }

export function parseAmount(value: string) {
  const clean = value.trim()
  if (unicodeFractions[clean] !== undefined) return unicodeFractions[clean]
  const mixedUnicode = clean.match(/^(\d+)\s*([¼½¾⅓⅔⅛⅜⅝⅞])$/)
  if (mixedUnicode) return Number(mixedUnicode[1]) + unicodeFractions[mixedUnicode[2]]
  const fraction = clean.match(/^(\d+)\/(\d+)$/)
  if (fraction && Number(fraction[2])) return Number(fraction[1]) / Number(fraction[2])
  const mixed = clean.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (mixed && Number(mixed[3])) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3])
  const number = Number(clean)
  return Number.isFinite(number) && number > 0 ? number : 1
}

function categoryFor(name: string) {
  const value = normalizeName(name)
  if (/chicken|beef|pork|turkey|sausage|fish|salmon|shrimp/.test(value)) return 'Meat'
  if (/milk|cheese|cream|yogurt|butter|egg/.test(value)) return 'Dairy'
  if (/bread|tortilla|roll|bun|bagel/.test(value)) return 'Bakery'
  if (/apple|onion|garlic|carrot|potato|tomato|pepper|spinach|lettuce|cabbage|lime|lemon|avocado|herb|basil|cilantro/.test(value)) return 'Produce'
  return 'Pantry'
}

export function parseIngredientLine(line: string): Ingredient {
  const clean = line.trim().replace(/^[-•]\s*/, '')
  const match = clean.match(new RegExp(`^((?:\\d+\\s+\\d+\\/\\d+)|(?:\\d+\\/\\d+)|(?:\\d*[¼½¾⅓⅔⅛⅜⅝⅞])|(?:\\d+(?:\\.\\d+)?))?\\s*(${units.join('|')})?\\s*(?:of\\s+)?(.+)$`, 'i'))
  const name = (match?.[3] || clean).trim()
  return { name, amount: parseAmount(match?.[1] || '1'), unit: singular(match?.[2] || 'each'), category: categoryFor(name), store: 'Walmart' }
}

export function parsePantryEntry(value: string): PantryItem {
  const ingredient = parseIngredientLine(value)
  return { id: crypto.randomUUID(), name: ingredient.name, amount: ingredient.amount, unit: ingredient.unit, confirmed: false, fullness: 'full' }
}

export function formatAmount(value: number) {
  const rounded = Math.round(value * 8) / 8
  const whole = Math.floor(rounded)
  const fraction = rounded - whole
  const labels: Record<string, string> = { '0.125': '⅛', '0.25': '¼', '0.375': '⅜', '0.5': '½', '0.625': '⅝', '0.75': '¾', '0.875': '⅞' }
  const suffix = labels[String(fraction)] || ''
  return suffix ? `${whole || ''}${suffix}` : String(Math.round(rounded * 100) / 100)
}

const allergyExpansion: Record<string, string[]> = {
  'tree nuts': ['almond', 'walnut', 'pecan', 'cashew', 'pistachio', 'hazelnut', 'macadamia', 'brazil nut', 'pine nut'],
  nuts: ['almond', 'walnut', 'pecan', 'cashew', 'pistachio', 'hazelnut', 'macadamia', 'peanut'],
  dairy: ['milk', 'cheese', 'cream', 'butter', 'yogurt'],
  shellfish: ['shrimp', 'crab', 'lobster', 'prawn', 'clam', 'mussel', 'oyster'],
}

export function recipeConflicts(recipe: Recipe, members: Member[]) {
  const ingredientText = recipe.ingredients.map(item => normalizeName(item.name)).join(' ')
  const listed = members.flatMap(member => (member.allergies || '').toLowerCase().split(/[,;/]/).map(item => item.trim()).filter(Boolean))
  return listed.some(allergy => [allergy, ...(allergyExpansion[allergy] || [])].some(term => ingredientText.includes(term)))
}

export function findPantryItem(ingredientName: string, pantry: PantryItem[]): PantryItem | undefined {
  const target = normalizeName(ingredientName)
  return pantry.find(item => item.confirmed && (normalizeName(item.name).includes(target) || target.includes(normalizeName(item.name))))
}

export type PantryMatch = { recipe: Recipe; matched: number; total: number; percent: number; missing: Ingredient[]; conflict: boolean }

export function matchRecipesToPantry(recipes: Recipe[], pantry: PantryItem[], members: Member[]): PantryMatch[] {
  const available = pantry.filter(item => item.confirmed).map(item => normalizeName(item.name))
  return recipes.map(recipe => {
    const missing = recipe.ingredients.filter(ingredient => !available.some(name => name.includes(normalizeName(ingredient.name)) || normalizeName(ingredient.name).includes(name)))
    const total = recipe.ingredients.length
    const matched = total - missing.length
    return { recipe, matched, total, percent: total ? Math.round(matched / total * 100) : 0, missing, conflict: recipeConflicts(recipe, members) }
  }).sort((a, b) => Number(a.conflict) - Number(b.conflict) || b.percent - a.percent || a.missing.length - b.missing.length || a.recipe.minutes - b.recipe.minutes)
}

export function buildWeekDraft(recipes: Recipe[], members: Member[], preferences: Record<string, unknown>, existing: MealSlot[]) {
  const humans = members.filter(member => member.kind === 'human').map(member => member.id)
  const timeLimit = Number(preferences.cookingLimit || 60)
  const budget = String(preferences.budget || 'Flexible')
  const candidates = recipes.filter(recipe => !recipeConflicts(recipe, members) && recipe.minutes <= timeLimit && (budget !== 'Frugal' || recipe.cost === '$'))
  const fallback = recipes.filter(recipe => !recipeConflicts(recipe, members))
  const pool = (candidates.length ? candidates : fallback).slice().sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)) || (a.lastCookedAt || '').localeCompare(b.lastCookedAt || '') || (a.cookedCount || 0) - (b.cookedCount || 0))
  if (!pool.length || !humans.length) return existing
  const occupied = new Set(existing.map(slot => `${slot.day}-${slot.kind}`))
  const additions: MealSlot[] = []
  for (let day = 0; day < 7; day++) {
    if (occupied.has(`${day}-Dinner`)) continue
    const recipe = pool[additions.length % pool.length]
    additions.push({ id: crypto.randomUUID(), day, kind: 'Dinner', recipeId: recipe.id, diners: humans, servings: humans.length })
  }
  return [...existing, ...additions]
}

export function buildGroceryList(slots: MealSlot[], recipes: Recipe[], pantry: PantryItem[]): GroceryItem[] {
  const needs: GroceryItem[] = []
  for (const slot of slots) {
    if (slot.leftoverFrom) continue
    const recipe = recipes.find(r => r.id === slot.recipeId)
    if (!recipe) continue
    const scale = slot.servings / recipe.servings
    for (const ingredient of recipe.ingredients) {
      const name = normalizeName(ingredient.name)
      const unit = singular(ingredient.unit)
      const existing = needs.find(item => normalizeName(item.name) === name && singular(item.unit) === unit)
      if (existing) existing.amount += ingredient.amount * scale
      else needs.push({ ...ingredient, id: `plan-${name}-${unit}`, amount: ingredient.amount * scale, checked: false, source: 'plan' })
    }
  }

  for (const available of pantry.filter(item => item.confirmed)) {
    const match = needs.find(item => normalizeName(item.name) === normalizeName(available.name) && singular(item.unit) === singular(available.unit))
    if (match) match.amount = Math.max(0, match.amount - available.amount)
  }

  return needs.filter(item => item.amount > 0.001).map(item => ({ ...item, amount: Math.round(item.amount * 100) / 100 }))
}

export const initialPantry: PantryItem[] = [
  { id: 'p1', name: 'red lentils', amount: 1, unit: 'cup', confirmed: true },
  { id: 'p2', name: 'crushed tomatoes', amount: 1, unit: 'can', confirmed: true },
  { id: 'p3', name: 'garlic', amount: 2, unit: 'clove', confirmed: true },
]
