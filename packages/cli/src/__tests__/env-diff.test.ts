import { describe, it, expect } from 'vitest'
import { diffKeyValues } from '../core/secrets/diff'

describe('diffKeyValues', () => {
  it('detects added, removed, changed', () => {
    const local = { A: '1', B: 'x', C: '3' }
    const remote = { B: 'y', C: '3', D: '4' }
    const d = diffKeyValues(local, remote)
    expect(d.added.sort()).toEqual(['A'])
    expect(d.removed.sort()).toEqual(['D'])
    expect(d.changed).toEqual([{ key: 'B', local: 'x', remote: 'y' }])
  })
})
