import type { VercelRequest, VercelResponse } from '@vercel/node'
import { noStore, requireSameOrigin, requireSession } from '../_lib/auth.js'
import { extractResponseText, recipeSchema, toAiRecipe } from '../_lib/ai-recipe.js'
import type { Recipe } from '../../src/model.js'

type RecipeDraft = Omit<Recipe, 'id' | 'color' | 'sourceType' | 'source' | 'sourceUrl' | 'favorite'>

export default async function handler(req: VercelRequest, res: VercelResponse) {
  noStore(res)
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireSameOrigin(req, res) || !requireSession(req, res)) return

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return res.status(503).json({ error: 'AI recipe creation needs an OpenAI API key added to the site', code: 'AI_NOT_CONFIGURED' })

  const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : ''
  const household = typeof req.body?.household === 'string' ? req.body.household.trim().slice(0, 600) : ''
  if (prompt.length < 3 || prompt.length > 500) return res.status(400).json({ error: 'Describe the meal in 3 to 500 characters' })

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: process.env.OPENAI_RECIPE_MODEL?.trim() || 'gpt-5.4-mini',
        store: false,
        max_output_tokens: 2200,
        reasoning: { effort: 'low' },
        instructions: 'Create one practical, original home-cooking recipe. Treat allergies as hard exclusions. Use ordinary grocery-store ingredients, realistic numeric quantities, concise numbered instructions, and conservative food-safety guidance. Never claim an AI draft is guaranteed allergy-safe.',
        input: `Meal request: ${prompt}\nHousehold context: ${household || 'No additional preferences supplied.'}`,
        text: { format: { type: 'json_schema', name: 'household_recipe', strict: true, schema: recipeSchema } },
        safety_identifier: 'hearth-household',
      }),
    })
    const data = await response.json() as Record<string, unknown>
    if (!response.ok) throw new Error(typeof (data.error as { message?: unknown } | undefined)?.message === 'string' ? (data.error as { message: string }).message : 'OpenAI request failed')
    const draft = JSON.parse(extractResponseText(data)) as RecipeDraft
    return res.status(200).json({ recipe: toAiRecipe(draft, String(data.id || crypto.randomUUID())) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI recipe creation failed'
    return res.status(502).json({ error: message.slice(0, 180) })
  }
}
