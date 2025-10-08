import { describe, it, expect } from 'vitest'
import { toPatterns, matchPattern, allowKey } from '../commands/env'

describe('patterns', () => {
  it('parses lists', () => {
    expect(toPatterns('A,B , C')).toEqual(['A','B','C'])
    expect(toPatterns(undefined)).toEqual([])
  })
  it('matches simple * glob', () => {
    expect(matchPattern('NEXT_PUBLIC_FOO', 'NEXT_PUBLIC_*')).toBe(true)
    expect(matchPattern('DATABASE_URL', 'NEXT_PUBLIC_*')).toBe(false)
    expect(matchPattern('REDIS_URL', 'REDIS_*')).toBe(true)
  })
  it('allowKey enforces only/ignore', () => {
    expect(allowKey('DATABASE_URL', ['DATABASE_*'], [])).toBe(true)
    expect(allowKey('REDIS_URL', ['DATABASE_*'], [])).toBe(false)
    expect(allowKey('NEXT_PUBLIC_X', [], ['NEXT_PUBLIC_*'])).toBe(false)
  })
})
