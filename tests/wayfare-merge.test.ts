// Run: npm test
import assert from 'node:assert/strict'
import { mergeDeleted, mergeTrips } from '../src/wayfare/merge.ts'

const trip = (id: string, updatedAt: string, name = id) => ({ id, name, updatedAt, createdAt: '2026-01-0' + id.length + 'T00:00:00.000Z' }) as never

// newest copy wins, from either side
assert.equal(mergeTrips([trip('a', '2026-02-01T00:00:00.000Z', 'old')], [trip('a', '2026-03-01T00:00:00.000Z', 'new')], {})[0].name, 'new')
assert.equal(mergeTrips([trip('a', '2026-04-01T00:00:00.000Z', 'new')], [trip('a', '2026-03-01T00:00:00.000Z', 'old')], {})[0].name, 'new')
// trips only on one side are kept (union)
assert.deepEqual(mergeTrips([trip('a', '2026-02-01T00:00:00.000Z')], [trip('bb', '2026-02-01T00:00:00.000Z')], {}).map((t) => t.id).sort(), ['a', 'bb'])
// a deletion beats an older copy but not a later edit
assert.equal(mergeTrips([], [trip('a', '2026-02-01T00:00:00.000Z')], { a: '2026-02-02T00:00:00.000Z' }).length, 0)
assert.equal(mergeTrips([], [trip('a', '2026-02-03T00:00:00.000Z')], { a: '2026-02-02T00:00:00.000Z' }).length, 1)
// tombstones keep the latest time
assert.deepEqual(mergeDeleted({ a: '2026-01-01', b: '2026-05-01' }, { a: '2026-02-01', b: '2026-04-01' }), { a: '2026-02-01', b: '2026-05-01' })
console.log('merge checks passed')
