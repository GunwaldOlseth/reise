/**
 * Evidence: JSON.stringify drops undefined allAboardTime (key missing on PUT).
 * persistPackageDay always emits a string so Go decode + Firestore Set keep it.
 */
import assert from 'node:assert/strict'

function persistLike(day) {
  return {
    ...day,
    offset: Math.floor(Number(day.offset)) || 0,
    arriveTime: (day.arriveTime || '').trim(),
    leaveTime: (day.leaveTime || '').trim(),
    allAboardTime: (day.allAboardTime || '').trim(),
  }
}

const missingKey = JSON.stringify({ id: 'd0', offset: 0, city: 'Bergen' })
assert.equal(missingKey.includes('allAboardTime'), false, 'undefined field is omitted from PUT JSON')

const persisted = persistLike({
  id: 'd0',
  offset: '0',
  city: 'Bergen',
  allAboardTime: '16:30',
  leaveTime: '17:00',
})
const body = JSON.stringify({
  tripId: 't1',
  stops: [
    {
      kind: 'cruise',
      pack: { nights: 2, days: [persisted] },
    },
  ],
  legs: [],
})
assert.match(body, /"allAboardTime":"16:30"/)
assert.match(body, /"offset":0/)
assert.equal(JSON.parse(body).stops[0].pack.days[0].allAboardTime, '16:30')
console.log('ok PUT JSON includes allAboardTime and numeric offset')
