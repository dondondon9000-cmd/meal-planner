# Hearth & Harvest

Phone-first shared household meal planning with an enchanted-cottage visual system. The first usable release includes the weekly Hearth, an offline recipe shelf, diner-based serving scaling, explicit leftovers, a confirm-before-use pantry snapshot with camera barcode scanning, multi-store shopping, a transparent Walmart search handoff, and household profiles.

Production: https://hearth-and-harvest-household.vercel.app

The production deployment uses a Vercel-provisioned Neon database and a shared household password. All writes pass through authenticated serverless endpoints; the browser never receives database credentials or the configured password.

## Run locally

```bash
npm install
npm run dev
```

The demo works without credentials and persists to this browser's `localStorage`. Use the seeded six-person household and dog profile to walk the full flow immediately. Run `npm test` and `npm run build` before release.

## Production path (Vercel + Neon)

1. Create a Neon project and run [`database/schema.sql`](database/schema.sql).
2. Add `DATABASE_URL` in Vercel project environment settings. Keep it server-side and never expose it with a `VITE_` prefix.
3. Replace the `useStoredState` adapter with authenticated Vercel API routes using parameterized Neon queries. The schema already separates households and uses version fields for safe shared-list updates.
4. Add a shared-household passphrase flow. Store only an Argon2id password hash; issue secure, HTTP-only, same-site session cookies. Never store the passphrase itself.
5. Deploy the Vite build to Vercel (`npm run build`; output directory `dist`).

The demo intentionally does not pretend to sync across devices. The interface labels local behavior honestly.

## Optional providers

- Barcode scanning uses the browser's camera (via `@zxing/browser`) and looks products up against [Open Food Facts](https://world.openfoodfacts.org/), a free, keyless, client-side product database. Items it can't find are shown with their raw barcode so you can type the name in manually.
- `THEMEALDB_API_KEY`: optional server-side override for attributed, user-initiated recipe search. When unset, this private household app uses TheMealDB's published basic key `1`. Results link to their source, and the key never enters the browser.
- `ANTHROPIC_API_KEY`: optional server-side key for in-app AI recipe creation (Claude). AI drafts use structured output via tool use and can be saved to the shared shelf like sourced recipes. Never expose this key to browser code.
- `ANTHROPIC_RECIPE_MODEL`: optional model override; defaults to `claude-haiku-5-5`.

Copy `.env.example` to `.env.local` only for local development. Never commit secrets.

## Recipe-data decision

The built-in shelf is a small, original set maintained in source, so it is fast, predictable, offline-capable, and free of ambiguous bulk-dataset rights. Family recipes stay within the household.

TheMealDB powers basic, attributed, user-initiated meal-name search with its published key `1`; its documentation reserves supporter keys for broader production/app-store use. Optional Claude recipe generation stays inside the app and produces a complete, savable draft; it is disabled until a server-side API key is configured. Edamam has strong filtering and data quality but its standard web-recipe plans restrict caching and omit third-party instructions, so it is not used as the offline library. RecipeNLG is research-oriented, very large, inconsistently sourced, and does not present a sufficiently clear whole-dataset content license for redistribution here. Spoonacular remains a possible paid provider, but would add vendor cost and terms review without improving the private household release enough.

No MCP server is required for the app runtime. A runtime MCP dependency would add an unnecessary privacy and availability boundary to an ordinary user-facing recipe search.

## Privacy and scope

- Pantry inventory is a shopping-cycle snapshot, not a permanent inventory system.
- Photo-derived items remain drafts until a person confirms them.
- The dog never contributes human serving counts; pet items are grocery reminders only.
- Walmart support is a search deep-link, not direct cart modification.
- Automatic meal scheduling, price comparison, coupons, unsupported cart integration, and live store inventory are intentionally out of scope.

## Generated artwork

`public/assets/cottage-kitchen.png` was generated specifically for this project with the built-in OpenAI image generation tool. Prompt summary: an original candlelit wizard-cottage kitchen still life with a copper pot, bread, herbs, vegetables, pantry jars, forest green cabinetry, and no text, logos, franchise symbols, or recognizable copyrighted props.
