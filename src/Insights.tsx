import { useMemo } from 'react'
import { Archive, ChefHat, PiggyBank, TrendingUp } from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { insightCategoryOrder, type HistoryEvent, type Recipe } from './model'

// Chart color roles live as CSS custom properties (see styles.css) so every chart on
// this page draws from one validated, documented palette instead of hand-picked hex.
// Each chart below is a single series (the axis labels already name the category,
// store, or recipe), so it stays one hue - color is never spent re-encoding what
// position already shows. Only the two-slice donuts carry real per-slice identity.
const MONEY_HUE = 'var(--series-1)'
const COOKING_HUE = 'var(--series-3)'
const WASTE_HUE = 'var(--status-critical)'
const FRESH_HUE = 'var(--series-1)'
const LEFTOVER_HUE = 'var(--series-2)'
const USED_HUE = 'var(--status-good)'
const EXPIRED_HUE = 'var(--status-critical)'

const tooltipStyle = { contentStyle: { background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--ink)', fontSize: '.8rem' }, labelStyle: { color: 'var(--muted)' }, itemStyle: { color: 'var(--ink)' } }
const axisStyle = { stroke: 'var(--line)', tick: { fill: 'var(--muted)', fontSize: 11 } }

function money(value: number) { return `$${value.toFixed(2)}` }

function weekStart(iso: string) {
  const date = new Date(iso)
  const mondayOffset = (date.getDay() + 6) % 7
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - mondayOffset)
  return date
}
function weekKey(iso: string) { return weekStart(iso).toISOString().slice(0, 10) }
function weekLabel(key: string) { return new Date(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }

function sumByWeek(events: HistoryEvent[], valueOf: (payload: Record<string, unknown>) => number | null) {
  const map = new Map<string, number>()
  for (const event of events) {
    const value = valueOf(event.payload)
    if (value === null) continue
    const key = weekKey(event.occurredAt)
    map.set(key, (map.get(key) || 0) + value)
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, total]) => ({ label: weekLabel(key), total: Math.round(total * 100) / 100 }))
}

function countBy(events: HistoryEvent[], keyOf: (payload: Record<string, unknown>) => string, order?: readonly string[]) {
  const map = new Map<string, number>()
  for (const event of events) {
    const key = keyOf(event.payload)
    map.set(key, (map.get(key) || 0) + 1)
  }
  const keys = order ? order.filter(key => map.has(key)) : [...map.keys()]
  return keys.map(key => ({ label: key, total: map.get(key) || 0 }))
}

function sumBy(events: HistoryEvent[], keyOf: (payload: Record<string, unknown>) => string, valueOf: (payload: Record<string, unknown>) => number | null, order?: readonly string[]) {
  const map = new Map<string, number>()
  for (const event of events) {
    const value = valueOf(event.payload)
    if (value === null) continue
    const key = keyOf(event.payload)
    map.set(key, (map.get(key) || 0) + value)
  }
  const keys = order ? order.filter(key => map.has(key)) : [...map.keys()]
  return keys.map(key => ({ label: key, total: Math.round((map.get(key) || 0) * 100) / 100 }))
}

function ChartCard({ title, sub, empty, children }: { title: string; sub: string; empty?: string; children: React.ReactNode }) {
  return <section className="chart-card card">
    <p className="eyebrow">{sub}</p>
    <h3>{title}</h3>
    {empty ? <p className="muted chart-empty">{empty}</p> : <div className="chart-body">{children}</div>}
  </section>
}

function BarRow({ data, color, valueFormat = String }: { data: { label: string; total: number }[]; color: string; valueFormat?: (n: number) => string }) {
  return <ResponsiveContainer width="100%" height={Math.max(180, data.length * 38)}>
    <BarChart data={data} layout="vertical" margin={{ top: 4, right: 18, bottom: 4, left: 4 }}>
      <CartesianGrid horizontal={false} stroke="var(--line)" />
      <XAxis type="number" {...axisStyle} tickFormatter={valueFormat} />
      <YAxis type="category" dataKey="label" width={96} {...axisStyle} />
      <Tooltip {...tooltipStyle} formatter={(value: number) => valueFormat(value)} />
      <Bar dataKey="total" fill={color} radius={[0, 4, 4, 0]} maxBarSize={22} />
    </BarChart>
  </ResponsiveContainer>
}

export function Insights({ history, recipes }: { history: HistoryEvent[]; recipes: Recipe[] }) {
  const cooked = useMemo(() => history.filter(e => e.type === 'meal_cooked'), [history])
  const purchased = useMemo(() => history.filter(e => e.type === 'grocery_purchased'), [history])
  const expired = useMemo(() => history.filter(e => e.type === 'pantry_expired'), [history])
  const used = useMemo(() => history.filter(e => e.type === 'pantry_used'), [history])

  const priceOf = (payload: Record<string, unknown>) => typeof payload.price === 'number' ? payload.price : null
  const pricedPurchases = useMemo(() => purchased.filter(e => typeof e.payload.price === 'number'), [purchased])

  const spendByWeek = useMemo(() => sumByWeek(purchased, priceOf), [purchased])
  const spendByCategory = useMemo(() => sumBy(purchased, p => String(p.category || 'Other'), priceOf, insightCategoryOrder), [purchased])
  const spendByStore = useMemo(() => sumBy(purchased, p => String(p.store || 'Walmart'), priceOf), [purchased])
  const cookedByWeek = useMemo(() => {
    const map = new Map<string, number>()
    for (const event of cooked) map.set(weekKey(event.occurredAt), (map.get(weekKey(event.occurredAt)) || 0) + 1)
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, total]) => ({ label: weekLabel(key), total }))
  }, [cooked])
  const topRecipes = useMemo(() => recipes.filter(r => (r.cookedCount || 0) > 0).sort((a, b) => (b.cookedCount || 0) - (a.cookedCount || 0)).slice(0, 6).map(r => ({ label: r.title, total: r.cookedCount || 0 })), [recipes])
  const wasteByCategory = useMemo(() => countBy(expired, p => String(p.category || 'Other'), insightCategoryOrder), [expired])

  const leftoverSplit = useMemo(() => {
    const leftover = cooked.filter(e => e.payload.leftover).length
    return [{ name: 'Fresh-cooked', value: cooked.length - leftover, color: FRESH_HUE }, { name: 'Leftovers', value: leftover, color: LEFTOVER_HUE }].filter(d => d.value > 0)
  }, [cooked])

  const pantryOutcome = useMemo(() => [
    { name: 'Used', value: used.length, color: USED_HUE },
    { name: 'Expired', value: expired.length, color: EXPIRED_HUE },
  ].filter(d => d.value > 0), [used, expired])

  const totalSpend = spendByWeek.reduce((sum, w) => sum + w.total, 0)
  const wasteRate = used.length + expired.length ? Math.round(expired.length / (used.length + expired.length) * 100) : null

  if (!history.length) {
    return <div className="insights-empty card">
      <TrendingUp size={32} />
      <h2>No trends yet</h2>
      <p>Cook a meal, check off a grocery item, or confirm a pantry snapshot, and this page starts filling in. Tracking only looks forward from today — it can't see anything from before this page existed.</p>
    </div>
  }

  return <>
    <div className="insights-stats">
      <div className="stat-tile"><PiggyBank size={20} /><div><b>{money(totalSpend)}</b><span>Tracked grocery spend{pricedPurchases.length < purchased.length ? ' · partial' : ''}</span></div></div>
      <div className="stat-tile"><ChefHat size={20} /><div><b>{cooked.length}</b><span>Meals marked cooked</span></div></div>
      <div className="stat-tile"><Archive size={20} /><div><b>{wasteRate === null ? '—' : `${wasteRate}%`}</b><span>Pantry items expired, not used</span></div></div>
    </div>

    <div className="insights-grid">
      <ChartCard title="Weekly grocery spend" sub="Trend" empty={!pricedPurchases.length ? 'Nothing to chart yet — add a price when you check an item off to start tracking spending.' : undefined}>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={spendByWeek} margin={{ top: 8, right: 18, bottom: 4, left: 4 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="label" {...axisStyle} />
            <YAxis {...axisStyle} tickFormatter={money} width={54} />
            <Tooltip {...tooltipStyle} formatter={(value: number) => money(value)} />
            <Line type="monotone" dataKey="total" stroke={MONEY_HUE} strokeWidth={2} dot={{ r: 3, fill: MONEY_HUE }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Spend by category" sub="Where it goes" empty={!spendByCategory.length ? 'No priced purchases yet.' : undefined}>
        <BarRow data={spendByCategory} color={MONEY_HUE} valueFormat={money} />
      </ChartCard>

      <ChartCard title="Spend by store" sub="Where it goes" empty={!spendByStore.length ? 'No priced purchases yet.' : undefined}>
        <BarRow data={spendByStore} color={MONEY_HUE} valueFormat={money} />
      </ChartCard>

      <ChartCard title="Meals cooked per week" sub="Cooking activity" empty={!cookedByWeek.length ? 'Mark a meal cooked to start this chart.' : undefined}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={cookedByWeek} margin={{ top: 8, right: 18, bottom: 4, left: 4 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="label" {...axisStyle} />
            <YAxis allowDecimals={false} {...axisStyle} width={28} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="total" fill={COOKING_HUE} radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Most-cooked recipes" sub="All-time favorites" empty={!topRecipes.length ? 'Mark a few meals cooked to see your favorites.' : undefined}>
        <BarRow data={topRecipes} color={COOKING_HUE} />
      </ChartCard>

      <ChartCard title="Fresh-cooked vs. leftovers" sub="Cooking activity" empty={!leftoverSplit.length ? 'Mark a meal cooked to start this chart.' : undefined}>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={leftoverSplit} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="var(--panel)" strokeWidth={2}>
              {leftoverSplit.map(slice => <Cell key={slice.name} fill={slice.color} />)}
            </Pie>
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: '.78rem', color: 'var(--muted)' }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Pantry outcomes" sub="Used vs. wasted" empty={!pantryOutcome.length ? 'Confirm a pantry snapshot to start this chart.' : undefined}>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={pantryOutcome} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="var(--panel)" strokeWidth={2}>
              {pantryOutcome.map(slice => <Cell key={slice.name} fill={slice.color} />)}
            </Pie>
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: '.78rem', color: 'var(--muted)' }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="What goes bad most" sub="Pantry waste by category" empty={!wasteByCategory.length ? 'Nothing expired and cleared yet — good sign.' : undefined}>
        <BarRow data={wasteByCategory} color={WASTE_HUE} />
      </ChartCard>
    </div>
  </>
}
