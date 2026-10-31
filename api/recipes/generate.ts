import type { VercelRequest, VercelResponse } from '@vercel/node'
import { noStore, requireSameOrigin, requireSession } from '../_lib/auth.js'
import { extractToolInput, recipeSchema, toAiRecipe } from '../_lib/ai-recipe.js'
import type { Recipe } from '../../src/model.js'

type RecipeDraft = Omit<Recipe, 'id' | 'color' | 'sourceType' | 'source' | 'sourceUrl' | 'favorite'>

export default async function handler(req: VercelRequest, res: VercelResponse) {
  noStore(res)
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireSameOrigin(req, res) || !requireSession(req, res)) return

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) return res.status(503).json({ error: 'AI recipe creation needs an Anthropic API key added to the site', code: 'AI_NOT_CONFIGURED' })

  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : ''
  const household = typeof req.body?.household === 'string' ? req.body.household.trim().slice(0, 1200) : ''
  if (prompt.length < 3 || prompt.length > 500) return res.status(400).json({ error: 'Describe the meal in 3 to 500 characters' })

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: process.env.ANTHROPIC_RECIPE_MODEL?.trim() || 'claude-haiku-5-5',
        max_tokens: 2000,
        system: 'Create one practical, original home-cooking recipe. Treat allergies as hard exclusions. Use ordinary grocery-store ingredients, realistic numeric quantities, concise numbered instructions, and conservative food-safety guidance. Never claim an AI draft is guaranteed allergy-safe. When the household context lists pantry items already on hand, prefer a recipe that makes good use of them (especially anything noted as expiring soon or already open) instead of requiring a full list of new ingredients, but do not force in pantry items that would make the dish worse.',
        messages: [{ role: 'user', content: `Meal request: ${prompt}\nHousehold context: ${household || 'No additional preferences supplied.'}` }],
        tools: [{ name: 'household_recipe', description: 'Return the generated recipe as structured data.', input_schema: recipeSchema }],
        tool_choice: { type: 'tool', name: 'household_recipe' },
      }),
    })
    const data = await response.json() as Record<string, unknown>
    if (!response.ok) throw new Error(typeof (data.error as { message?: unknown } | undefined)?.message === 'string' ? (data.error as { message: string }).message : 'Anthropic request failed')
    const draft = extractToolInput(data) as RecipeDraft
    return res.status(200).json({ recipe: toAiRecipe(draft, String(data.id || crypto.randomUUID())) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI recipe creation failed'
    return res.status(502).json({ error: message.slice(0, 180) })
  }
}
