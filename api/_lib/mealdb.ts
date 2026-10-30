import { parseIngredientLine, type Recipe } from '../../src/model.js'

type MealDbMeal = Record<string, string | null>

function instructions(value = '') {
  const lines = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  if (lines.length > 1) return lines
  return value.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(step => step.trim()).filter(Boolean) || []
}

export function mapMealDbMeal(meal: MealDbMeal): Recipe {
  const ingredients = Array.from({ length: 20 }, (_, index) => index + 1)
    .map(index => ({ name: meal[`strIngredient${index}`]?.trim() || '', measure: meal[`strMeasure${index}`]?.trim() || '' }))
    .filter(ingredient => ingredient.name)
    .map(ingredient => parseIngredientLine(`${ingredient.measure} ${ingredient.name}`.trim()))

  return {
    id: `mealdb-${meal.idMeal}`,
    title: meal.strMeal || 'Untitled meal',
    description: `${meal.strArea || 'Global'} ${meal.strCategory || 'meal'} from TheMealDB.`,
    cuisine: meal.strArea || 'Global',
    minutes: 45,
    cost: '$$',
    servings: 4,
    color: '#576d5a',
    sourceType: 'Sourced recipe',
    source: 'TheMealDB',
    sourceUrl: meal.strSource || `https://www.themealdb.com/meal/${meal.idMeal}`,
    imageUrl: meal.strMealThumb || undefined,
    ingredients,
    instructions: instructions(meal.strInstructions || ''),
  }
}

export async function searchMealDb(query: string, apiKey = process.env.THEMEALDB_API_KEY?.trim() || '1') {
  const url = new URL(`https://www.themealdb.com/api/json/v1/${encodeURIComponent(apiKey)}/search.php`)
  url.searchParams.set('s', query)
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8_000) })
  if (!response.ok) throw new Error(`Recipe provider returned ${response.status}`)
  const data = await response.json() as { meals?: MealDbMeal[] | null }
  return (data.meals || []).slice(0, 9).map(mapMealDbMeal)
}
