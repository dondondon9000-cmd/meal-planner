import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import {
  Archive, BookOpen, CalendarDays, Camera, Check, ChevronLeft, ChevronRight, CirclePlus,
  ChefHat, Clock3, Download, ExternalLink, Flame, Heart, Home, ImagePlus, Leaf, ListChecks,
  MoreHorizontal, NotebookPen, PackageCheck, KeyRound, Plus, RotateCcw, Search, Settings2,
  ShoppingBasket, Smartphone, Sparkles, Star, Trash2, Users, WandSparkles, X,
} from 'lucide-react'
import {
  buildGroceryList, buildWeekDraft, days, formatAmount, initialPantry, matchRecipesToPantry,
  mealKinds, parseIngredientLine, parsePantryEntry, seedMembers, seedRecipes, seedSlots,
  type GroceryItem, type MealKind, type MealSlot, type Member, type PantryItem, type Recipe, type Room,
} from './model'

declare global {
  interface Document {
    modelContext?: {
      registerTool: (tool: {
        name: string; title?: string; description: string; inputSchema: object;
        annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
        execute: (input: unknown) => unknown | Promise<unknown>;
      }, options?: { signal?: AbortSignal }) => void | Promise<void>
    }
  }
}

const roomInfo: Record<Room, { label: string; eyebrow: string; icon: typeof Home }> = {
  hearth: { label: 'The Hearth', eyebrow: 'Plan the week', icon: Flame },
  recipes: { label: 'Recipe Library', eyebrow: 'Find something good', icon: BookOpen },
  pantry: { label: 'Enchanted Pantry', eyebrow: 'Use what you have', icon: Archive },
  shopping: { label: 'Kitchen Table', eyebrow: 'Shop together', icon: ShoppingBasket },
  household: { label: 'Household Book', eyebrow: 'People & preferences', icon: Users },
}

type AddTarget = { day: number; kind: MealKind } | null
type Toast = { id: number; text: string }
type ConnectionState = 'checking' | 'local' | 'locked' | 'online' | 'saving' | 'error'
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

function useStoredState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try { return JSON.parse(localStorage.getItem(key) || '') as T } catch { return initial }
  })
  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)) }, [key, value])
  return [value, setValue] as const
}

function App() {
  const [room, setRoom] = useState<Room>('hearth')
  const [recipes, setRecipes] = useStoredState<Recipe[]>('hh-recipes', seedRecipes)
  const [members, setMembers] = useStoredState<Member[]>('hh-members', seedMembers)
  const [slots, setSlots] = useStoredState<MealSlot[]>('hh-slots', seedSlots)
  const [pantry, setPantry] = useStoredState<PantryItem[]>('hh-pantry', initialPantry)
  const [manualItems, setManualItems] = useStoredState<GroceryItem[]>('hh-manual', [
    { id: 'dog-food', name: 'Bramble’s dog food', amount: 1, unit: 'bag', category: 'Pet', store: 'Walmart', checked: false, source: 'pet' },
    { id: 'dish-tabs', name: 'Dishwasher tablets', amount: 1, unit: 'box', category: 'Household', store: 'Walmart', checked: false, source: 'manual' },
  ])
  const [weekOffset, setWeekOffset] = useState(0)
  const [addTarget, setAddTarget] = useState<AddTarget>(null)
  const [detail, setDetail] = useState<Recipe | null>(null)
  const [selectedRecipe, setSelectedRecipe] = useState<string>('')
  const [selectedDiners, setSelectedDiners] = useState<string[]>(members.filter(m => m.kind === 'human').map(m => m.id))
  const [toast, setToast] = useState<Toast | null>(null)
  const [groceryChecks, setGroceryChecks] = useStoredState<Record<string, boolean>>('hh-checks', {})
  const [storeOverrides, setStoreOverrides] = useStoredState<Record<string, string>>('hh-stores', {})
  const [preferences, setPreferences] = useStoredState<Record<string, unknown>>('hh-preferences', { cuisine: 'Flexible', cookingLimit: 45, budget: 'Balanced', weekBegins: 'Monday' })
  const [connection, setConnection] = useState<ConnectionState>('checking')
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches)
  const revisionRef = useRef(0)
  const remoteLoadedRef = useRef(false)
  const suppressSaveRef = useRef(false)
  const savingRef = useRef(false)

  useEffect(() => {
    const ready = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPromptEvent) }
    const complete = () => { setInstalled(true); setInstallPrompt(null) }
    window.addEventListener('beforeinstallprompt', ready)
    window.addEventListener('appinstalled', complete)
    return () => { window.removeEventListener('beforeinstallprompt', ready); window.removeEventListener('appinstalled', complete) }
  }, [])

  const plannedGroceries = useMemo(() => buildGroceryList(slots, recipes, pantry).map(item => ({
    ...item, checked: groceryChecks[item.id] ?? false, store: storeOverrides[item.name] || item.store || 'Walmart',
  })), [slots, recipes, pantry, groceryChecks, storeOverrides])
  const groceries = [...plannedGroceries, ...manualItems]

  const householdState = useMemo(() => ({ recipes, members, slots, pantry, manualItems, groceryChecks, storeOverrides, preferences }), [recipes, members, slots, pantry, manualItems, groceryChecks, storeOverrides, preferences])

  const applyRemoteState = (payload: { state: Partial<typeof householdState>; revision: number }) => {
    suppressSaveRef.current = true
    if (Array.isArray(payload.state.recipes)) setRecipes(payload.state.recipes)
    if (Array.isArray(payload.state.members)) setMembers(payload.state.members)
    if (Array.isArray(payload.state.slots)) setSlots(payload.state.slots)
    if (Array.isArray(payload.state.pantry)) setPantry(payload.state.pantry)
    if (Array.isArray(payload.state.manualItems)) setManualItems(payload.state.manualItems)
    if (payload.state.groceryChecks) setGroceryChecks(payload.state.groceryChecks)
    if (payload.state.storeOverrides) setStoreOverrides(payload.state.storeOverrides)
    if (payload.state.preferences) setPreferences(payload.state.preferences)
    revisionRef.current = payload.revision
    remoteLoadedRef.current = true
  }

  const loadRemoteState = async () => {
    const response = await fetch('/api/state', { credentials: 'same-origin', cache: 'no-store' })
    if (response.status === 401) { setConnection('locked'); return false }
    if (!response.ok) throw new Error('Household storage unavailable')
    applyRemoteState(await response.json())
    setConnection('online')
    return true
  }

  useEffect(() => {
    let active = true
    fetch('/api/session', { credentials: 'same-origin', cache: 'no-store' }).then(async response => {
      const data = await response.json()
      if (!active) return
      if (data.persistence !== 'neon') { setConnection('local'); return }
      if (!data.authenticated) { setConnection('locked'); return }
      await loadRemoteState()
    }).catch(() => { if (active) setConnection('local') })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!remoteLoadedRef.current || (connection !== 'online' && connection !== 'saving')) return
    if (suppressSaveRef.current) { suppressSaveRef.current = false; return }
    const timer = window.setTimeout(async () => {
      savingRef.current = true; setConnection('saving')
      try {
        const response = await fetch('/api/state', { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: householdState, revision: revisionRef.current }) })
        const result = await response.json()
        if (response.status === 409) { applyRemoteState(result); setConnection('online'); return }
        if (!response.ok) throw new Error(result.error || 'Save failed')
        revisionRef.current = result.revision; setConnection('online')
      } catch { setConnection('error') } finally { savingRef.current = false }
    }, 650)
    return () => window.clearTimeout(timer)
  }, [householdState])

  useEffect(() => {
    if (connection !== 'online') return
    const timer = window.setInterval(async () => {
      if (savingRef.current) return
      try {
        const response = await fetch('/api/state', { credentials: 'same-origin', cache: 'no-store' })
        if (!response.ok) return
        const payload = await response.json()
        if (payload.revision > revisionRef.current) { applyRemoteState(payload); notify('Household changes synced') }
      } catch { /* The next poll retries quietly. */ }
    }, 8000)
    return () => window.clearInterval(timer)
  }, [connection])

  useEffect(() => {
    const context = document.modelContext
    if (!context?.registerTool) return
    const lifecycle = new AbortController()
    try {
      void Promise.resolve(context.registerTool({
        name: 'add_grocery_items',
        title: 'Add grocery items',
        description: 'Add one or more manual grocery, household, or pet items to the visible Kitchen Table list.',
        inputSchema: {
          type: 'object', additionalProperties: false, required: ['items'],
          properties: { items: { type: 'array', minItems: 1, maxItems: 20, items: { type: 'object', additionalProperties: false, required: ['name'], properties: { name: { type: 'string', minLength: 1, maxLength: 120 }, category: { type: 'string', enum: ['Other', 'Household', 'Pet', 'Produce', 'Pantry', 'Dairy', 'Meat', 'Bakery'] }, store: { type: 'string', enum: ['Walmart', 'Farmers Market', 'Mercado'] } } } } },
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          const payload = input as { items?: Array<{ name?: string; category?: string; store?: string }> }
          if (!Array.isArray(payload.items) || !payload.items.length || payload.items.some(item => typeof item.name !== 'string' || !item.name.trim())) throw new Error('items must contain at least one non-empty name')
          const added = payload.items.map(item => ({ id: crypto.randomUUID(), name: item.name!.trim(), amount: 1, unit: 'each', category: item.category || 'Other', store: item.store || 'Walmart', checked: false, source: 'manual' as const }))
          setManualItems(current => [...current, ...added])
          setRoom('shopping')
          return { added: added.map(item => ({ id: item.id, name: item.name, store: item.store })), count: added.length }
        },
      }, { signal: lifecycle.signal })).catch(() => undefined)
    } catch { /* Unsupported preview implementations should not affect the app. */ }
    return () => lifecycle.abort()
  }, [setManualItems])

  const notify = (text: string) => {
    const next = { id: Date.now(), text }; setToast(next)
    window.setTimeout(() => setToast(current => current?.id === next.id ? null : current), 2600)
  }

  const updateRecipe = (id: string, patch: Partial<Recipe>) => {
    setRecipes(current => current.map(recipe => recipe.id === id ? { ...recipe, ...patch } : recipe))
    setDetail(current => current?.id === id ? { ...current, ...patch } : current)
  }

  const markCooked = (recipe: Recipe) => {
    updateRecipe(recipe.id, { cookedCount: (recipe.cookedCount || 0) + 1, lastCookedAt: new Date().toISOString() })
    notify(`${recipe.title} added to cooking history`)
  }

  const generateArtwork = async (recipe: Recipe) => {
    if (recipes.filter(item => item.imageUrl?.startsWith('data:image/')).length >= 3) throw new Error('The shared shelf can hold three generated recipe images for now')
    const response = await fetch('/api/recipes/artwork', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: recipe.title, description: recipe.description, ingredients: recipe.ingredients.slice(0, 10).map(item => item.name) }) })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Artwork generation failed')
    updateRecipe(recipe.id, { imageUrl: result.imageUrl })
    notify('Recipe artwork added')
  }

  const openAdd = (day: number, kind: MealKind) => {
    setAddTarget({ day, kind }); setSelectedRecipe('');
    setSelectedDiners(members.filter(m => m.kind === 'human').map(m => m.id))
  }

  const addMeal = () => {
    if (!addTarget || !selectedRecipe || selectedDiners.length === 0) return
    const recipe = recipes.find(r => r.id === selectedRecipe)!
    setSlots(current => [...current.filter(s => !(s.day === addTarget.day && s.kind === addTarget.kind)), {
      id: crypto.randomUUID(), ...addTarget, recipeId: recipe.id, diners: selectedDiners, servings: selectedDiners.length,
    }])
    setAddTarget(null); notify(`${recipe.title} added to ${days[addTarget.day]} ${addTarget.kind.toLowerCase()}`)
  }

  const nav = (next: Room) => { setRoom(next); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  return (
    <div className={`app room-${room}`}>
      <div className="ambient" aria-hidden="true"><i /><i /><i /></div>
      <header className="topbar">
        <button className="brand" onClick={() => nav('hearth')} aria-label="Go to The Hearth">
          <span className="brand-mark"><Flame size={21} /></span>
          <span><b>Hearth &amp; Harvest</b><small>Willowmere Household</small></span>
        </button>
        <div className={`sync-pill ${connection}`}><span /> {connection === 'online' ? 'Shared hearth · synced' : connection === 'saving' ? 'Saving household changes…' : connection === 'locked' ? 'Shared hearth · locked' : connection === 'error' ? 'Sync paused · retrying' : connection === 'checking' ? 'Checking the shared hearth…' : 'Demo hearth · saved locally'}</div>
        <button className="round-button" onClick={() => nav('household')} aria-label="Open settings"><Settings2 size={20} /></button>
      </header>

      <main>
        <section className="room-heading">
          <div>
            <p className="eyebrow">{roomInfo[room].eyebrow}</p>
            <h1>{roomInfo[room].label}</h1>
          </div>
          {room === 'hearth' && <WeekPicker offset={weekOffset} onChange={setWeekOffset} />}
        </section>

        {room === 'hearth' && <Hearth slots={slots} recipes={recipes} members={members} onAdd={openAdd} onRemove={id => { setSlots(s => s.filter(x => x.id !== id)); notify('Meal removed') }} onLeftovers={(slot, servings) => { setAddTarget({ day: Math.min(6, slot.day + 1), kind: 'Lunch' }); setSelectedRecipe(slot.recipeId); setSelectedDiners(members.filter(m => m.kind === 'human').slice(0, servings).map(m => m.id)); notify(`${servings} leftover servings ready to place`) }} onMove={(slot, direction) => setSlots(current => current.map(s => s.id === slot.id ? { ...s, day: Math.max(0, Math.min(6, s.day + direction)) } : s))} onCooked={markCooked} onBuildWeek={() => { const next = buildWeekDraft(recipes, members, preferences, slots); const added = next.length - slots.length; setSlots(next); notify(added ? `${added} open dinners filled` : 'Every dinner already has a plan') }} onShopping={() => nav('shopping')} groceryCount={groceries.filter(i => !i.checked).length} />}
        {room === 'recipes' && <Recipes recipes={recipes} setRecipes={setRecipes} members={members} preferences={preferences} onDetail={setDetail} onAdd={(recipe) => { setSelectedRecipe(recipe.id); setAddTarget({ day: 0, kind: 'Dinner' }) }} notify={notify} />}
        {room === 'pantry' && <Pantry pantry={pantry} setPantry={setPantry} recipes={recipes} members={members} onDetail={setDetail} onAdd={recipe => { setSelectedRecipe(recipe.id); setAddTarget({ day: 0, kind: 'Dinner' }) }} onAddMissing={(recipe, missing) => { const names = new Set(manualItems.map(item => item.name.toLowerCase())); const additions = missing.filter(item => !names.has(item.name.toLowerCase())).map(item => ({ ...item, id: crypto.randomUUID(), checked: false, source: 'manual' as const })); setManualItems(current => [...current, ...additions]); notify(`${additions.length} missing ${additions.length === 1 ? 'item' : 'items'} added to the list`) }} notify={notify} />}
        {room === 'shopping' && <Shopping items={groceries} planCount={plannedGroceries.length} setChecks={setGroceryChecks} manualItems={manualItems} setManualItems={setManualItems} setStoreOverrides={setStoreOverrides} notify={notify} />}
        {room === 'household' && <Household members={members} setMembers={setMembers} preferences={preferences} setPreferences={setPreferences} connection={connection} installPrompt={installPrompt} installed={installed} onInstall={async () => { if (!installPrompt) return; await installPrompt.prompt(); const choice = await installPrompt.userChoice; if (choice.outcome === 'accepted') setInstalled(true); setInstallPrompt(null) }} notify={notify} />}
      </main>

      <nav className="bottom-nav" aria-label="Main rooms">
        {(Object.entries(roomInfo) as [Room, typeof roomInfo[Room]][]).map(([key, item]) => {
          const Icon = item.icon
          return <button key={key} className={room === key ? 'active' : ''} onClick={() => nav(key)}><Icon size={21} /><span>{item.label.replace('The ', '').replace('Recipe ', '').replace('Enchanted ', '').replace('Kitchen ', '').replace('Household ', '')}</span></button>
        })}
      </nav>

      {addTarget && <AddMealDialog target={addTarget} recipes={recipes} members={members} selectedRecipe={selectedRecipe} setSelectedRecipe={setSelectedRecipe} selectedDiners={selectedDiners} setSelectedDiners={setSelectedDiners} onClose={() => setAddTarget(null)} onAdd={addMeal} />}
      {detail && <RecipeDetail recipe={detail} onClose={() => setDetail(null)} onAdd={() => { setSelectedRecipe(detail.id); setDetail(null); setAddTarget({ day: 0, kind: 'Dinner' }) }} onUpdate={patch => updateRecipe(detail.id, patch)} onCooked={() => markCooked(detail)} onArtwork={() => generateArtwork(detail)} />}
      {toast && <div className="toast" role="status"><Check size={17} /> {toast.text}</div>}
      {connection === 'locked' && <LoginDialog onAuthenticated={loadRemoteState} />}
    </div>
  )
}

function WeekPicker({ offset, onChange }: { offset: number; onChange: (n: number) => void }) {
  const base = new Date(); base.setDate(base.getDate() - ((base.getDay() + 6) % 7) + offset * 7)
  const end = new Date(base); end.setDate(end.getDate() + 6)
  const label = offset === 0 ? 'This week' : offset === 1 ? 'Next week' : `${base.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}–${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
  return <div className="week-picker"><button onClick={() => onChange(offset - 1)} aria-label="Previous week"><ChevronLeft size={18} /></button><span><b>{label}</b><small>{base.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small></span><button onClick={() => onChange(offset + 1)} aria-label="Next week"><ChevronRight size={18} /></button></div>
}

function Hearth({ slots, recipes, members, onAdd, onRemove, onLeftovers, onMove, onCooked, onBuildWeek, onShopping, groceryCount }: { slots: MealSlot[]; recipes: Recipe[]; members: Member[]; onAdd: (day: number, kind: MealKind) => void; onRemove: (id: string) => void; onLeftovers: (slot: MealSlot, servings: number) => void; onMove: (slot: MealSlot, direction: number) => void; onCooked: (recipe: Recipe) => void; onBuildWeek: () => void; onShopping: () => void; groceryCount: number }) {
  const [leftoverSlot, setLeftoverSlot] = useState<MealSlot | null>(null)
  const [remaining, setRemaining] = useState(2)
  return <>
    <div className="hearth-summary card"><div className="sigil"><CalendarDays /></div><div><b>{slots.length} {slots.length === 1 ? 'meal is' : 'meals are'} warming the week</b><span>Build my week fills open dinners without replacing anything you chose.</span></div><div className="summary-actions"><button className="button" onClick={onBuildWeek}><WandSparkles size={18} /> Build my week</button><button className="button gold" onClick={onShopping}><ShoppingBasket size={18} /> {groceryCount} to gather</button></div></div>
    <div className="calendar-grid">
      {days.map((day, dayIndex) => <article className={`day-card ${dayIndex === ((new Date().getDay() + 6) % 7) ? 'today' : ''}`} key={day}>
        <header><span>{day}</span>{dayIndex === ((new Date().getDay() + 6) % 7) && <em>Today</em>}</header>
        {mealKinds.map(kind => {
          const slot = slots.find(s => s.day === dayIndex && s.kind === kind)
          const recipe = slot && recipes.find(r => r.id === slot.recipeId)
          return <div className={`meal-slot ${slot ? 'filled' : ''}`} key={kind}>
            <span className="meal-kind">{kind}</span>
            {!slot || !recipe ? <button className="empty-slot" onClick={() => onAdd(dayIndex, kind)}><Plus size={16} /> Add meal</button> : <>
              <button className="meal-main" onClick={() => onAdd(dayIndex, kind)}><i style={{ background: recipe.color }} /><span><b>{recipe.title}</b><small><Clock3 size={13} /> {recipe.minutes} min · {slot.servings} servings</small></span></button>
              <div className="meal-footer"><div className="avatar-stack">{slot.diners.slice(0, 4).map(id => { const m = members.find(x => x.id === id); return m ? <span key={id} style={{ background: m.color }}>{m.initials}</span> : null })}{slot.diners.length > 4 && <span>+{slot.diners.length - 4}</span>}</div><details><summary aria-label="Meal actions"><MoreHorizontal size={18} /></summary><div className="action-menu"><button onClick={() => onCooked(recipe)}>Mark cooked</button><button disabled={dayIndex === 0} onClick={() => onMove(slot, -1)}>Move one day earlier</button><button disabled={dayIndex === 6} onClick={() => onMove(slot, 1)}>Move one day later</button><button onClick={() => { setLeftoverSlot(slot); setRemaining(2) }}>Save leftovers</button><button className="danger" onClick={() => onRemove(slot.id)}>Remove meal</button></div></details></div>
            </>}
          </div>
        })}
      </article>)}
    </div>
    {leftoverSlot && <div className="modal-backdrop"><div className="dialog small"><button className="close" onClick={() => setLeftoverSlot(null)}><X /></button><div className="dialog-icon"><PackageCheck /></div><p className="eyebrow">Manual leftovers</p><h2>How much was saved?</h2><p className="muted">Leftovers won’t add ingredients to the grocery list a second time.</p><label>Remaining servings<input type="number" min="1" max="12" value={remaining} onChange={e => setRemaining(Number(e.target.value))} /></label><button className="button gold full" onClick={() => { onLeftovers(leftoverSlot, remaining); setLeftoverSlot(null) }}>Place leftovers tomorrow</button></div></div>}
  </>
}

function Recipes({ recipes, setRecipes, members, preferences, onDetail, onAdd, notify }: { recipes: Recipe[]; setRecipes: (value: Recipe[] | ((r: Recipe[]) => Recipe[])) => void; members: Member[]; preferences: Record<string, unknown>; onDetail: (r: Recipe) => void; onAdd: (r: Recipe) => void; notify: (s: string) => void }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [manualOpen, setManualOpen] = useState(false)
  const [sourceResults, setSourceResults] = useState<Recipe[]>([])
  const [searching, setSearching] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [searchMessage, setSearchMessage] = useState('Search the internet by meal name, then save anything you like to your household shelf.')
  const filtered = recipes.filter(r => (filter === 'All' || (filter === 'Favorites' ? r.favorite : filter === 'Recently cooked' ? r.cookedCount : r.minutes <= 30)) && `${r.title} ${r.cuisine}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => filter === 'Recently cooked' ? (b.lastCookedAt || '').localeCompare(a.lastCookedAt || '') : 0)

  const searchSources = async () => {
    if (query.trim().length < 2) { setSearchMessage('Type at least two letters to search the internet.'); return }
    setSearching(true)
    try {
      const response = await fetch(`/api/recipes/search?q=${encodeURIComponent(query.trim())}`, { credentials: 'same-origin' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Search failed')
      const mapped = data.recipes as Recipe[]
      setSourceResults(mapped)
      setSearchMessage(mapped.length ? `${mapped.length} internet ${mapped.length === 1 ? 'recipe' : 'recipes'} found through TheMealDB.` : `No internet recipes found for “${query.trim()}”. Try a simpler meal name.`)
    } catch (error) { setSearchMessage(error instanceof Error ? error.message : 'Internet search is unavailable right now'); notify('Internet recipe search is unavailable right now') } finally { setSearching(false) }
  }

  const saveSource = (recipe: Recipe) => setRecipes(all => all.some(item => item.id === recipe.id) ? all : [...all, recipe])

  const createWithAi = async () => {
    if (query.trim().length < 3) { setSearchMessage('Describe the meal you want in at least three characters.'); return }
    setGenerating(true)
    try {
      const allergies = members.map(member => member.allergies).filter(Boolean).join(', ') || 'none listed'
      const household = `${members.filter(member => member.kind === 'human').length} people; allergies: ${allergies}; preferred cuisine: ${String(preferences.cuisine || 'flexible')}; cooking limit: ${String(preferences.cookingLimit || 45)} minutes; budget: ${String(preferences.budget || 'balanced')}`
      const response = await fetch('/api/recipes/generate', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: query.trim(), household }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'AI recipe creation failed')
      setSourceResults([data.recipe as Recipe])
      setSearchMessage('AI recipe created. Review it, then choose Save & view or add it to the calendar.')
    } catch (error) { setSearchMessage(error instanceof Error ? error.message : 'AI recipe creation is unavailable'); notify('AI recipe creation needs attention') } finally { setGenerating(false) }
  }

  return <>
    <div className="library-hero">
      <img src="/assets/cottage-kitchen.png" alt="Copper pot, bread, vegetables, and herbs in a candlelit cottage kitchen" />
      <div className="library-overlay"><span className="source-badge"><Leaf size={15} /> {recipes.length} saved {recipes.length === 1 ? 'recipe' : 'recipes'}</span><h2>A shelf that grows with your household</h2><p>Search, create, rate, and keep the meals worth making again.</p></div>
    </div>
    <div className="toolbar"><label className="search-field"><Search size={19} /><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchSources()} placeholder="Try chicken, curry, or describe a new meal" /></label><button className="button" disabled={searching || generating} onClick={searchSources}>{searching ? 'Searching…' : 'Search internet'}</button><button className="button ai-button" disabled={searching || generating} onClick={createWithAi}><WandSparkles size={18} />{generating ? 'Creating…' : 'Create with AI'}</button><button className="button gold" onClick={() => setManualOpen(true)}><Plus size={18} /> Family recipe</button></div>
    <div className="filter-row">{['All', 'Favorites', 'Under 30 min', 'Recently cooked'].map(f => <button className={filter === f ? 'active' : ''} onClick={() => setFilter(f)} key={f}>{f}</button>)}<span className="filter-note"><Settings2 size={15} /> Household-aware suggestions</span></div>
    <div className="notice secure"><Sparkles size={18} /><span><b>Search or create without leaving the app.</b> {searchMessage} AI drafts are sent to OpenAI only when you press Create with AI; always check ingredients and labels for allergies.</span></div>
    <div className="recipe-grid">{[...filtered, ...sourceResults.filter(result => !filtered.some(recipe => recipe.id === result.id))].map(recipe => { const isNewSource = sourceResults.some(result => result.id === recipe.id) && !recipes.some(item => item.id === recipe.id); return <article className="recipe-card" key={recipe.id}>
      <button className={`heart ${recipe.favorite ? 'active' : ''}`} aria-label={recipe.favorite ? 'Remove favorite' : 'Add favorite'} onClick={() => isNewSource ? (saveSource({ ...recipe, favorite: true }), notify('Internet recipe saved to the shelf')) : setRecipes(all => all.map(r => r.id === recipe.id ? { ...r, favorite: !r.favorite } : r))}><Heart size={18} fill={recipe.favorite ? 'currentColor' : 'none'} /></button>
      <div className={`recipe-art ${recipe.imageUrl ? 'has-photo' : ''}`} style={{ background: `linear-gradient(135deg, ${recipe.color}, #253a31)` }}>{recipe.imageUrl ? <img src={recipe.imageUrl} alt={recipe.title} /> : <><span>{recipe.title.split(' ').slice(0, 2).map(w => w[0]).join('')}</span><i /></>}</div>
      <div className="recipe-body"><div className="recipe-meta"><span>{recipe.sourceType}</span><span><Clock3 size={13} /> {recipe.minutes} min</span><span>{recipe.cost}</span>{Boolean(recipe.rating) && <span><Star size={12} fill="currentColor" /> {recipe.rating}</span>}</div><h3>{recipe.title}</h3><p>{recipe.description}</p>{Boolean(recipe.cookedCount) && <small className="cooked-note">Cooked {recipe.cookedCount} {recipe.cookedCount === 1 ? 'time' : 'times'}{recipe.lastCookedAt ? ` · ${new Date(recipe.lastCookedAt).toLocaleDateString()}` : ''}</small>}<div className="recipe-actions"><button onClick={() => { if (isNewSource) { saveSource(recipe); notify('Recipe saved to the shelf') }; onDetail(recipe) }}>{isNewSource ? 'Save & view' : 'View recipe'}</button><button className="icon-action" onClick={() => { if (isNewSource) saveSource(recipe); onAdd(recipe) }} aria-label={`Add ${recipe.title} to calendar`}><CalendarDays size={18} /></button></div></div>
    </article> })}</div>
    {manualOpen && <ManualRecipeDialog onClose={() => setManualOpen(false)} onSave={recipe => { setRecipes(r => [...r, recipe]); setManualOpen(false); notify('Family recipe added to the shelf') }} />}
  </>
}

function Pantry({ pantry, setPantry, recipes, members, onDetail, onAdd, onAddMissing, notify }: { pantry: PantryItem[]; setPantry: (value: PantryItem[] | ((r: PantryItem[]) => PantryItem[])) => void; recipes: Recipe[]; members: Member[]; onDetail: (recipe: Recipe) => void; onAdd: (recipe: Recipe) => void; onAddMissing: (recipe: Recipe, missing: Recipe['ingredients']) => void; notify: (s: string) => void }) {
  const [draft, setDraft] = useState<PantryItem[]>(pantry)
  const [entry, setEntry] = useState('')
  const [scanning, setScanning] = useState(false)
  const matches = matchRecipesToPantry(recipes, draft, members).filter(match => !match.conflict).slice(0, 3)
  const addText = () => {
    const parts = entry.split(',').map(x => x.trim()).filter(Boolean)
    setDraft(current => [...current, ...parts.map(parsePantryEntry)]); setEntry('')
  }
  const photoDraft = () => {
    setScanning(true); window.setTimeout(() => { setDraft(current => [...current, { id: crypto.randomUUID(), name: 'yellow onion', amount: 2, unit: 'each', confirmed: false }, { id: crypto.randomUUID(), name: 'eggs', amount: 8, unit: 'each', confirmed: false }, { id: crypto.randomUUID(), name: 'cheddar', amount: 6, unit: 'oz', confirmed: false }]); setScanning(false); notify('Demo draft is ready for your review') }, 1100)
  }
  return <><section className="tonight-panel"><div className="section-title"><div><p className="eyebrow">What can I cook tonight?</p><h2>Your closest pantry matches</h2></div><span>Allergy conflicts are left out</span></div><div className="match-grid">{matches.map(match => <article className="match-card" key={match.recipe.id}><div className="match-score"><span style={{ '--match': `${match.percent * 3.6}deg` } as CSSProperties}><b>{match.percent}%</b></span></div><div><h3>{match.recipe.title}</h3><p>{match.matched} of {match.total} ingredients on hand · {match.recipe.minutes} min</p><small>{match.missing.length ? `Missing: ${match.missing.slice(0, 3).map(item => item.name).join(', ')}${match.missing.length > 3 ? '…' : ''}` : 'Ready to cook now'}</small></div><div className="match-actions"><button onClick={() => onDetail(match.recipe)}>View</button><button onClick={() => onAdd(match.recipe)}>Plan it</button>{Boolean(match.missing.length) && <button onClick={() => onAddMissing(match.recipe, match.missing)}>Add missing</button>}</div></article>)}</div></section><div className="pantry-layout"><section className="scan-panel card"><div className="pantry-shelves" aria-hidden="true"><span>◒</span><span>▥</span><span>◉</span><span>▤</span></div><div className="scan-copy"><div className="dialog-icon"><Camera /></div><h2>Take a fresh look</h2><p>Photograph a shelf or enter what you have. A scan is always a draft until you confirm it.</p><label className={`upload-button ${scanning ? 'scanning' : ''}`}><Camera size={19} />{scanning ? 'Reading the shelf…' : 'Choose a pantry photo'}<input type="file" accept="image/*" capture="environment" onChange={photoDraft} /></label><small>Demo mode suggests sample items. Images are not uploaded or retained.</small></div></section>
    <section className="inventory-panel"><div className="section-title"><div><p className="eyebrow">Active shopping cycle</p><h2>Confirm what’s available</h2></div><span>{draft.filter(i => i.confirmed).length} confirmed</span></div><div className="quick-entry"><input value={entry} onChange={e => setEntry(e.target.value)} onKeyDown={e => e.key === 'Enter' && addText()} placeholder="Try: rice, 2 onions, 1½ cups broth" /><button onClick={addText}><Plus /></button></div><div className="inventory-list">{draft.map(item => <div className={item.confirmed ? 'confirmed' : ''} key={item.id}><button className="check-button" onClick={() => setDraft(all => all.map(x => x.id === item.id ? { ...x, confirmed: !x.confirmed } : x))}>{item.confirmed && <Check size={15} />}</button><input value={item.name} onChange={e => setDraft(all => all.map(x => x.id === item.id ? { ...x, name: e.target.value } : x))} /><input className="qty" type="number" value={item.amount} min="0" step="0.125" onChange={e => setDraft(all => all.map(x => x.id === item.id ? { ...x, amount: Number(e.target.value) } : x))} /><select value={item.unit} onChange={e => setDraft(all => all.map(x => x.id === item.id ? { ...x, unit: e.target.value } : x))}><option>each</option><option>cup</option><option>tbsp</option><option>tsp</option><option>can</option><option>oz</option><option>lb</option><option>clove</option><option>package</option><option>bag</option></select><button className="plain-icon" onClick={() => setDraft(all => all.filter(x => x.id !== item.id))}><Trash2 size={17} /></button></div>)}</div><div className="sticky-confirm"><p><b>Only confirmed items are subtracted.</b><span>This snapshot clears after your shopping cycle.</span></p><button className="button gold" onClick={() => { const confirmed = draft.filter(i => i.confirmed); setPantry(confirmed); setDraft(confirmed); notify('Pantry snapshot confirmed') }}><WandSparkles size={18} /> Confirm snapshot</button></div></section></div></>
}

function Shopping({ items, planCount, setChecks, manualItems, setManualItems, setStoreOverrides, notify }: { items: GroceryItem[]; planCount: number; setChecks: (value: Record<string, boolean> | ((r: Record<string, boolean>) => Record<string, boolean>)) => void; manualItems: GroceryItem[]; setManualItems: (value: GroceryItem[] | ((r: GroceryItem[]) => GroceryItem[])) => void; setStoreOverrides: (value: Record<string, string> | ((r: Record<string, string>) => Record<string, string>)) => void; notify: (s: string) => void }) {
  const stores = ['Walmart', 'Farmers Market', 'Mercado']
  const [manual, setManual] = useState('')
  const grouped = stores.reduce<Record<string, GroceryItem[]>>((acc, store) => ({ ...acc, [store]: items.filter(i => (i.store || 'Walmart') === store) }), {})
  const completed = items.filter(i => i.checked).length
  const setChecked = (item: GroceryItem) => item.source === 'plan' ? setChecks(c => ({ ...c, [item.id]: !item.checked })) : setManualItems(all => all.map(x => x.id === item.id ? { ...x, checked: !x.checked } : x))
  const changeStore = (item: GroceryItem, store: string) => item.source === 'plan' ? setStoreOverrides(s => ({ ...s, [item.name]: store })) : setManualItems(all => all.map(x => x.id === item.id ? { ...x, store } : x))
  const addManual = () => { if (!manual.trim()) return; setManualItems(all => [...all, { id: crypto.randomUUID(), name: manual.trim(), amount: 1, unit: 'each', category: 'Other', store: 'Walmart', checked: false, source: 'manual' }]); setManual(''); notify('Item added') }
  return <><div className="shopping-top card"><div className="progress-ring" style={{ '--progress': `${items.length ? completed / items.length * 360 : 0}deg` } as CSSProperties}><span>{completed}<small>of {items.length}</small></span></div><div><p className="eyebrow">Generated from this week</p><h2>{items.length - completed} things left to gather</h2><p>{planCount} recipe needs, pantry quantities already subtracted, plus household reminders.</p></div><button className="button" onClick={() => window.print()}><ListChecks size={18} /> Print list</button></div>
    <div className="notice secure"><Users size={18} /><span><b>Shared-list ready.</b> Demo changes stay on this device. With Neon connected, list changes can sync across household devices.</span></div>
    <div className="manual-add"><input value={manual} onChange={e => setManual(e.target.value)} onKeyDown={e => e.key === 'Enter' && addManual()} placeholder="Add grocery, household, or pet item" /><button className="button gold" onClick={addManual}><Plus size={18} /> Add</button></div>
    <div className="store-columns">{stores.map(store => { const categories = grouped[store].reduce<Record<string, GroceryItem[]>>((acc, item) => { (acc[item.category] ||= []).push(item); return acc }, {}); return <section className="store-card" key={store}><header><div><p className="eyebrow">Store</p><h2>{store}</h2></div><span>{grouped[store].filter(i => !i.checked).length} left</span></header>{Object.entries(categories).map(([category, categoryItems]) => <div className="grocery-category" key={category}><h3>{category}</h3>{categoryItems.map(item => <div className={`grocery-row ${item.checked ? 'done' : ''}`} key={item.id}><button className="check-button" onClick={() => setChecked(item)}>{item.checked && <Check size={15} />}</button><div className="grocery-name"><b>{item.name}</b><small>{item.amount} {item.unit} · {item.source === 'plan' ? 'meal plan' : item.source}</small></div><select aria-label={`Store for ${item.name}`} value={item.store || 'Walmart'} onChange={e => changeStore(item, e.target.value)}>{stores.map(s => <option key={s}>{s}</option>)}</select>{item.source !== 'plan' && <button className="plain-icon" onClick={() => setManualItems(all => all.filter(x => x.id !== item.id))}><X size={16} /></button>}</div>)}</div>)}</section> })}</div>
    <div className="walmart-handoff"><div className="walmart-mark">✦</div><div><p className="eyebrow">Walmart handoff</p><h2>Search your remaining Walmart items</h2><p>Opens product search in a new tab. This first release does not claim to fill a cart automatically.</p></div><a className="button gold" target="_blank" rel="noreferrer" href={`https://www.walmart.com/search?q=${encodeURIComponent(grouped.Walmart.filter(i => !i.checked).map(i => i.name).slice(0, 8).join(' '))}`}>Open Walmart search <ExternalLink size={17} /></a></div>
  </>
}

function Household({ members, setMembers, preferences, setPreferences, connection, installPrompt, installed, onInstall, notify }: { members: Member[]; setMembers: (value: Member[] | ((r: Member[]) => Member[])) => void; preferences: Record<string, unknown>; setPreferences: (value: Record<string, unknown> | ((r: Record<string, unknown>) => Record<string, unknown>)) => void; connection: ConnectionState; installPrompt: InstallPromptEvent | null; installed: boolean; onInstall: () => Promise<void>; notify: (s: string) => void }) {
  const [name, setName] = useState('')
  const addMember = () => { if (!name.trim()) return; const clean = name.trim(); setMembers(m => [...m, { id: crypto.randomUUID(), name: clean, initials: clean.slice(0, 2).toUpperCase(), color: '#6f8064', kind: 'human' }]); setName(''); notify(`${clean} joined the household`) }
  return <div className="book-layout"><section className="member-section"><div className="section-title"><div><p className="eyebrow">One shared household</p><h2>Who gathers at the table?</h2></div><span>{members.filter(m => m.kind === 'human').length} people · {members.filter(m => m.kind === 'dog').length} dog</span></div><div className="member-grid">{members.map(member => <article className="member-card" key={member.id}><span className="large-avatar" style={{ background: member.color }}>{member.initials}</span><div><h3>{member.name}</h3><p>{member.kind === 'dog' ? 'Pet reminders only · never counted as a serving' : member.allergies ? `Allergy: ${member.allergies}` : member.dislikes ? `Dislikes: ${member.dislikes}` : 'No food notes yet'}</p></div><button className="plain-icon" aria-label={`Remove ${member.name}`} onClick={() => setMembers(m => m.filter(x => x.id !== member.id))}><X size={17} /></button></article>)}</div><div className="quick-entry"><input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addMember()} placeholder="Add a household member" /><button onClick={addMember}><Plus /></button></div></section>
    <aside className="settings-card card"><p className="eyebrow">Household defaults</p><h2>The house rules</h2><label>Preferred cuisines<select value={String(preferences.cuisine || 'Flexible')} onChange={e => setPreferences(p => ({ ...p, cuisine: e.target.value }))}><option>Flexible</option><option>Mediterranean</option><option>Mexican-inspired</option><option>Comfort food</option></select></label><label>Weeknight cooking limit<select value={String(preferences.cookingLimit || 45)} onChange={e => setPreferences(p => ({ ...p, cookingLimit: Number(e.target.value) }))}><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option></select></label><label>Everyday budget<select value={String(preferences.budget || 'Balanced')} onChange={e => setPreferences(p => ({ ...p, budget: e.target.value }))}><option value="Frugal">Frugal ($)</option><option value="Balanced">Balanced ($$)</option><option value="Flexible">Flexible ($$$)</option></select></label><label>Week begins<select value={String(preferences.weekBegins || 'Monday')} onChange={e => setPreferences(p => ({ ...p, weekBegins: e.target.value }))}><option>Monday</option><option>Sunday</option></select></label><div className="privacy-note"><PackageCheck size={20} /><p><b>{connection === 'online' ? 'Protected Neon storage' : 'Privacy by default'}</b><span>{connection === 'online' ? 'Household data is shared through authenticated server endpoints. Production secrets never enter the browser.' : 'Pantry photos are temporary. Demo data remains in this browser; production secrets stay server-side.'}</span></p></div><button className="button gold full" onClick={() => notify('Household defaults saved')}>Save house rules</button><div className="install-card"><Smartphone size={22} /><div><b>{installed ? 'Installed on this device' : 'Put Hearth on this phone'}</b><span>{installed ? 'It opens like an app from your home screen.' : installPrompt ? 'Install it for a full-screen, app-like experience.' : /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'In Safari, tap Share, then Add to Home Screen.' : 'Use your browser menu and choose Install app or Add to Home screen.'}</span></div>{installPrompt && !installed && <button className="button" onClick={onInstall}><Download size={17} /> Install</button>}</div></aside></div>
}

function LoginDialog({ onAuthenticated }: { onAuthenticated: () => Promise<boolean> }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const response = await fetch('/api/login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to unlock')
      await onAuthenticated()
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to unlock') } finally { setBusy(false) }
  }
  return <div className="modal-backdrop login-backdrop"><form className="dialog login-dialog" onSubmit={submit}><div className="login-seal"><KeyRound /></div><p className="eyebrow">Willowmere Household</p><h2>Unlock the shared hearth</h2><p className="muted">Use the household password on each phone. The password is never stored in the browser or database.</p><label>Household password<input autoFocus type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button gold full" disabled={busy || !password}>{busy ? 'Opening the hearth…' : 'Enter the household'}</button></form></div>
}

function AddMealDialog({ target, recipes, members, selectedRecipe, setSelectedRecipe, selectedDiners, setSelectedDiners, onClose, onAdd }: { target: { day: number; kind: MealKind }; recipes: Recipe[]; members: Member[]; selectedRecipe: string; setSelectedRecipe: (id: string) => void; selectedDiners: string[]; setSelectedDiners: (ids: string[]) => void; onClose: () => void; onAdd: () => void }) {
  const [search, setSearch] = useState('')
  const humans = members.filter(m => m.kind === 'human')
  const filtered = recipes.filter(r => r.title.toLowerCase().includes(search.toLowerCase()))
  return <div className="modal-backdrop"><div className="dialog add-dialog"><button className="close" onClick={onClose}><X /></button><p className="eyebrow">{days[target.day]} · {target.kind}</p><h2>What sounds good?</h2><label className="search-field"><Search size={18} /><input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search your recipe shelf" /></label><div className="picker-list">{filtered.map(recipe => <button className={selectedRecipe === recipe.id ? 'selected' : ''} onClick={() => setSelectedRecipe(recipe.id)} key={recipe.id}><i style={{ background: recipe.color }}>{selectedRecipe === recipe.id && <Check size={16} />}</i><span><b>{recipe.title}</b><small>{recipe.minutes} min · base recipe serves {recipe.servings}</small></span></button>)}</div><div className="diner-picker"><h3>Who’s eating?</h3><p>Quantities scale to {selectedDiners.length} {selectedDiners.length === 1 ? 'serving' : 'servings'}.</p><div>{humans.map(member => <button className={selectedDiners.includes(member.id) ? 'active' : ''} key={member.id} onClick={() => setSelectedDiners(selectedDiners.includes(member.id) ? selectedDiners.filter(id => id !== member.id) : [...selectedDiners, member.id])}><span style={{ background: member.color }}>{member.initials}</span>{member.name}</button>)}</div></div><button className="button gold full" disabled={!selectedRecipe || !selectedDiners.length} onClick={onAdd}><CalendarDays size={18} /> Add to {days[target.day]}</button></div></div>
}

function RecipeDetail({ recipe, onClose, onAdd, onUpdate, onCooked, onArtwork }: { recipe: Recipe; onClose: () => void; onAdd: () => void; onUpdate: (patch: Partial<Recipe>) => void; onCooked: () => void; onArtwork: () => Promise<void> }) {
  const [notes, setNotes] = useState(recipe.notes || '')
  const [cooking, setCooking] = useState(false)
  const [artBusy, setArtBusy] = useState(false)
  const makeArtwork = async () => { setArtBusy(true); try { await onArtwork() } catch (error) { window.alert(error instanceof Error ? error.message : 'Artwork generation failed') } finally { setArtBusy(false) } }
  if (cooking) return <CookingMode recipe={recipe} onClose={() => setCooking(false)} onFinished={() => { onCooked(); setCooking(false) }} />
  return <div className="modal-backdrop"><div className="dialog recipe-dialog"><button className="close" onClick={onClose}><X /></button><div className={`detail-art ${recipe.imageUrl ? 'has-photo' : ''}`} style={{ background: `linear-gradient(135deg, ${recipe.color}, #14231d)` }}>{recipe.imageUrl ? <img src={recipe.imageUrl} alt={recipe.title} /> : <><span>{recipe.title.split(' ').slice(0, 2).map(w => w[0]).join('')}</span><i /></>}</div><div className="detail-heading"><p className="eyebrow">{recipe.sourceType}</p><h2>{recipe.title}</h2><p>{recipe.description}</p><div><span><Clock3 size={15} /> {recipe.minutes} min</span><span><Users size={15} /> {recipe.servings} servings</span><span>{recipe.cost}</span>{Boolean(recipe.cookedCount) && <span><RotateCcw size={14} /> Cooked {recipe.cookedCount}</span>}</div></div><div className="rating-row"><span>Household rating</span><div>{[1, 2, 3, 4, 5].map(star => <button key={star} className={star <= (recipe.rating || 0) ? 'active' : ''} onClick={() => onUpdate({ rating: star })} aria-label={`${star} stars`}><Star size={21} fill={star <= (recipe.rating || 0) ? 'currentColor' : 'none'} /></button>)}</div></div><div className="recipe-columns"><section><h3>Ingredients</h3><ul>{recipe.ingredients.map(i => <li key={`${i.name}-${i.unit}`}><b>{formatAmount(i.amount)} {i.unit}</b> {i.name}</li>)}</ul></section><section><h3>Method</h3><ol>{recipe.instructions.map((s, i) => <li key={i}>{s}</li>)}</ol></section></div><label className="recipe-notes"><NotebookPen size={18} /> Household notes<textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} onBlur={() => onUpdate({ notes: notes.trim() })} placeholder="Double the sauce, less salt, everyone loved it…" /></label>{recipe.sourceUrl && <a className="source-link" href={recipe.sourceUrl} target="_blank" rel="noreferrer">View original source at {recipe.source} <ExternalLink size={15} /></a>}<div className="detail-actions"><button className="button" onClick={() => setCooking(true)}><ChefHat size={18} /> Start cooking</button>{recipe.sourceType === 'AI draft' && !recipe.imageUrl && <button className="button ai-button" disabled={artBusy} onClick={makeArtwork}><ImagePlus size={18} /> {artBusy ? 'Creating…' : 'Create artwork (~1¢)'}</button>}<button className="button gold" onClick={onAdd}><CalendarDays size={18} /> Add to calendar</button></div></div></div>
}

function CookingMode({ recipe, onClose, onFinished }: { recipe: Recipe; onClose: () => void; onFinished: () => void }) {
  const [step, setStep] = useState(0)
  const [checked, setChecked] = useState<Record<number, boolean>>({})
  useEffect(() => {
    let lock: { release: () => Promise<void> } | undefined
    const wakeLock = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
    wakeLock?.request('screen').then(value => { lock = value }).catch(() => undefined)
    return () => { void lock?.release() }
  }, [])
  const steps = recipe.instructions.length ? recipe.instructions : ['Follow your household notes and cook until safely done.']
  return <div className="modal-backdrop cooking-backdrop"><div className="cooking-mode"><header><div><p className="eyebrow">Cooking mode</p><h2>{recipe.title}</h2></div><button onClick={onClose} aria-label="Close cooking mode"><X /></button></header><div className="cooking-layout"><aside><h3>Ingredients</h3>{recipe.ingredients.map((ingredient, index) => <button className={checked[index] ? 'checked' : ''} key={`${ingredient.name}-${index}`} onClick={() => setChecked(current => ({ ...current, [index]: !current[index] }))}><span>{checked[index] && <Check size={16} />}</span><b>{formatAmount(ingredient.amount)} {ingredient.unit}</b> {ingredient.name}</button>)}</aside><main><span className="step-count">Step {step + 1} of {steps.length}</span><p>{steps[step]}</p><div><button className="button" disabled={step === 0} onClick={() => setStep(value => value - 1)}><ChevronLeft /> Back</button>{step < steps.length - 1 ? <button className="button gold" onClick={() => setStep(value => value + 1)}>Next <ChevronRight /></button> : <button className="button gold" onClick={onFinished}><Check /> Finished cooking</button>}</div></main></div></div></div>
}

function ManualRecipeDialog({ onClose, onSave }: { onClose: () => void; onSave: (r: Recipe) => void }) {
  const [title, setTitle] = useState('')
  const [ingredients, setIngredients] = useState('')
  const [instructions, setInstructions] = useState('')
  const save = () => {
    if (!title.trim() || !ingredients.trim()) return
    onSave({ id: crypto.randomUUID(), title: title.trim(), description: 'A recipe from our household.', cuisine: 'Family', minutes: 40, cost: '$$', servings: 4, color: '#765248', sourceType: 'Family recipe', ingredients: ingredients.split('\n').filter(Boolean).map(parseIngredientLine), instructions: instructions.split('\n').filter(Boolean).map(line => line.trim()) })
  }
  return <div className="modal-backdrop"><div className="dialog"><button className="close" onClick={onClose}><X /></button><p className="eyebrow">Household cookbook</p><h2>Add a family recipe</h2><label>Recipe name<input value={title} onChange={e => setTitle(e.target.value)} placeholder="Grandma’s tomato soup" /></label><label>Ingredients <small>One per line</small><textarea rows={5} value={ingredients} onChange={e => setIngredients(e.target.value)} placeholder={'2 cans tomatoes\n1 onion\n3 cups broth'} /></label><label>Instructions <small>One step per line</small><textarea rows={5} value={instructions} onChange={e => setInstructions(e.target.value)} /></label><button className="button gold full" onClick={save}>Save to recipe shelf</button></div></div>
}

export default App
