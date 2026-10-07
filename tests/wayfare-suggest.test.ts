// Run: npm test
import assert from 'node:assert/strict'
import { dailyBudget, estimate, rank } from '../src/wayfare/suggest.ts'

const spent = (amount: number) => [{ id: '', date: '', category: '', description: '', amount, currency: 'USD' }]
const trip = { budget: 900, expenses: [], startDate: '2026-05-01', endDate: '2026-05-03' }
assert.equal(dailyBudget(trip, '2026-04-01'), 300) // before the trip: all 3 days
assert.equal(dailyBudget({ ...trip, expenses: spent(300) }, '2026-05-02'), 300) // 600 left / 2 days
assert.equal(dailyBudget(trip, '2026-06-01'), 900) // trip over: never divide by <1
assert.equal(dailyBudget({ ...trip, budget: 100, expenses: spent(500) }, '2026-05-01'), 0) // overspent

assert.deepEqual(estimate({ tourism: 'museum', fee: 'no' }), { kind: 'museum', cost: 0, known: true })
assert.equal(estimate({ tourism: 'museum' }).known, false)

const el = (id: number, name: string | undefined, tags: Record<string, string>) => ({ type: 'node', id, lat: 1, lon: 2, tags: name ? { name, ...tags } : tags })
const ranked = rank([
  el(1, 'Zoo', { tourism: 'zoo' }), el(2, 'Park', { leisure: 'park' }), el(3, 'Museum', { tourism: 'museum' }),
  el(4, 'park', { leisure: 'park' }), el(5, undefined, { tourism: 'museum' }),
], 20)
assert.deepEqual(ranked.map((i) => i.name), ['Park', 'Museum']) // zoo too pricey, dup + unnamed dropped, cheapest first
console.log('suggest checks passed')
