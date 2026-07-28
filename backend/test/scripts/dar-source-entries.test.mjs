import test from 'node:test'
import assert from 'node:assert/strict'

import { findDamlSourceEntries } from '../../scripts/dar-source-entries.mjs'

test('finds embedded DAML source entries without including compiler metadata', () => {
  const sourceEntry = { path: 'splice-amulet/Splice/Amulet.daml', content: 'module Splice.Amulet where' }

  const result = findDamlSourceEntries({
    sourceFiles: [sourceEntry],
    packageEntries: [
      { path: 'splice-amulet/main.dalf', bytes: new Uint8Array([3]) },
    ],
  })

  assert.deepEqual(result, [sourceEntry])
})
