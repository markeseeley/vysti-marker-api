import { describe, it, expect } from 'vitest'
import {
  getScoreCeiling,
  CONCISION_LABELS,
  CLARITY_LABELS,
  DEVELOPMENT_LABELS,
  CONVENTIONS_LABELS,
  COHESION_CRITICAL_LABELS,
  COHESION_MODERATE_LABELS,
  OVERALL_CRITICAL_LABELS,
  OVERALL_MODERATE_LABELS,
  WEAK_VERBS,
  METRIC_INFO,
} from '../lib/studentMetrics'

// ── Label category integrity ────────────────────────────────────────

describe('label categories', () => {
  it('CONCISION_LABELS has expected entries', () => {
    expect(CONCISION_LABELS.length).toBeGreaterThanOrEqual(5)
    expect(CONCISION_LABELS).toContain("No contractions in academic writing")
  })

  it('CLARITY_LABELS includes pronoun rule', () => {
    expect(CLARITY_LABELS).toContain("Clarify pronouns and antecedents")
  })

  it('DEVELOPMENT_LABELS includes floating quotation', () => {
    expect(DEVELOPMENT_LABELS).toContain("Floating quotation")
  })

  it('CONVENTIONS_LABELS includes spelling and grammar', () => {
    expect(CONVENTIONS_LABELS).toContain("Spelling error")
    expect(CONVENTIONS_LABELS).toContain("Check subject-verb agreement")
  })

  it('COHESION_CRITICAL_LABELS includes off-topic', () => {
    expect(COHESION_CRITICAL_LABELS).toContain("Off-topic")
    expect(COHESION_CRITICAL_LABELS).toContain("Use a closed thesis statement")
  })

  it('all label arrays contain only strings', () => {
    const allLabels = [
      ...CONCISION_LABELS, ...CLARITY_LABELS, ...DEVELOPMENT_LABELS,
      ...CONVENTIONS_LABELS, ...COHESION_CRITICAL_LABELS, ...COHESION_MODERATE_LABELS,
    ]
    allLabels.forEach((label) => {
      expect(typeof label).toBe('string')
      expect(label.trim().length).toBeGreaterThan(0)
    })
  })

  it('no duplicate labels within a category', () => {
    const categories = [
      CONCISION_LABELS, CLARITY_LABELS, DEVELOPMENT_LABELS,
      CONVENTIONS_LABELS, COHESION_CRITICAL_LABELS, COHESION_MODERATE_LABELS,
    ]
    categories.forEach((cat) => {
      expect(new Set(cat).size).toBe(cat.length)
    })
  })
})

// ── getScoreCeiling ─────────────────────────────────────────────────

describe('getScoreCeiling', () => {
  it('returns 100 when no issues present', () => {
    expect(getScoreCeiling({})).toBe(100)
    expect(getScoreCeiling(null)).toBe(100)
  })

  it('returns 69 when a critical label is present', () => {
    expect(getScoreCeiling({ 'Off-topic': 1 })).toBe(69)
    expect(getScoreCeiling({ 'Use a closed thesis statement': 2 })).toBe(69)
  })

  it('returns 79 when a moderate label is present (but no critical)', () => {
    expect(getScoreCeiling({ 'Floating quotation': 1 })).toBe(79)
    expect(getScoreCeiling({ 'Incomplete conclusion': 1 })).toBe(79)
  })

  it('critical takes priority over moderate', () => {
    expect(getScoreCeiling({ 'Off-topic': 1, 'Floating quotation': 3 })).toBe(69)
  })

  it('returns 100 when labels have zero counts', () => {
    expect(getScoreCeiling({ 'Off-topic': 0 })).toBe(100)
  })

  it('OVERALL_CRITICAL_LABELS all trigger 69 ceiling', () => {
    OVERALL_CRITICAL_LABELS.forEach((label) => {
      expect(getScoreCeiling({ [label]: 1 })).toBe(69)
    })
  })

  it('OVERALL_MODERATE_LABELS all trigger 79 ceiling', () => {
    OVERALL_MODERATE_LABELS.forEach((label) => {
      expect(getScoreCeiling({ [label]: 1 })).toBe(79)
    })
  })
})

// ── WEAK_VERBS ──────────────────────────────────────────────────────

describe('WEAK_VERBS', () => {
  it('contains all forms of "show"', () => {
    ['show', 'shows', 'showed', 'shown', 'showing'].forEach((v) => {
      expect(WEAK_VERBS.has(v)).toBe(true)
    })
  })

  it('contains all forms of "use"', () => {
    ['use', 'uses', 'used', 'using'].forEach((v) => {
      expect(WEAK_VERBS.has(v)).toBe(true)
    })
  })

  it('does NOT contain strong verbs', () => {
    expect(WEAK_VERBS.has('illustrate')).toBe(false)
    expect(WEAK_VERBS.has('reveal')).toBe(false)
  })
})

// ── METRIC_INFO ─────────────────────────────────────────────────────

describe('METRIC_INFO', () => {
  it('has all four metrics', () => {
    expect(METRIC_INFO).toHaveProperty('power')
    expect(METRIC_INFO).toHaveProperty('variety')
    expect(METRIC_INFO).toHaveProperty('cohesion')
    expect(METRIC_INFO).toHaveProperty('precision')
  })

  it('each metric has title, body, and tips', () => {
    for (const [key, info] of Object.entries(METRIC_INFO)) {
      expect(info.title).toBeTruthy()
      expect(info.body).toBeTruthy()
      expect(Array.isArray(info.tips)).toBe(true)
      expect(info.tips.length).toBeGreaterThan(0)
    }
  })
})
