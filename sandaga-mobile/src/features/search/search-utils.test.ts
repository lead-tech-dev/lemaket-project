import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isValidSuggestionQuery,
  normalizeSearchTerm,
  normalizeSuggestionKey,
  resolveDidYouMeanCandidate,
  scoreQuerySuggestion
} from './search-utils'

test('normalizeSearchTerm trims and collapses spaces', () => {
  assert.equal(normalizeSearchTerm('  coloc   douala  '), 'coloc douala')
})

test('normalizeSuggestionKey removes accents and punctuation', () => {
  assert.equal(normalizeSuggestionKey('TélÉphone, Douala!'), 'telephonedouala')
})

test('isValidSuggestionQuery rejects numeric-only and too-short terms', () => {
  assert.equal(isValidSuggestionQuery('1'), false)
  assert.equal(isValidSuggestionQuery('12'), false)
  assert.equal(isValidSuggestionQuery('te'), true)
})

test('resolveDidYouMeanCandidate returns nearest typo correction', () => {
  const result = resolveDidYouMeanCandidate('telephne', [
    { label: 'Téléphone', query: 'telephone' },
    { label: 'Télévision', query: 'television' }
  ])

  assert.deepEqual(result, { label: 'Téléphone', query: 'telephone' })
})

test('resolveDidYouMeanCandidate ignores very short input', () => {
  const result = resolveDidYouMeanCandidate('tv', [{ label: 'TV', query: 'tv' }])
  assert.equal(result, null)
})

test('scoreQuerySuggestion prioritizes history prefix over trending infix', () => {
  const historyScore = scoreQuerySuggestion(
    {
      label: 'Colocation Douala',
      query: 'colocation douala',
      resultCount: 20,
      hits: 12,
      source: 'history'
    },
    'colo'
  )

  const trendingScore = scoreQuerySuggestion(
    {
      label: 'Meilleure colocation',
      query: 'meilleure colocation',
      resultCount: 100,
      hits: 80,
      source: 'trending'
    },
    'colo'
  )

  assert.equal(historyScore > trendingScore, true)
})
