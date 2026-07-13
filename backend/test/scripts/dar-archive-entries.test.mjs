import test from 'node:test'
import assert from 'node:assert/strict'

import { findDebugDalfEntry } from '../../scripts/dar-archive-entries.mjs'

test('finds debug DALF entries from the SDK packageEntries collection', () => {
  const debugEntry = { path: 'debug/data/debug-locations.dalf', bytes: new Uint8Array([1, 2, 3]) }

  const result = findDebugDalfEntry({
    packageEntries: [
      { path: 'main.dalf', bytes: new Uint8Array([4]) },
      debugEntry,
    ],
  })

  assert.deepEqual(result, debugEntry)
})
