const SCORE_UNIT_DENOMINATOR = 200
const QUALITY_QUARTERS_PER_POINT = 4

const componentOrder = ['main', 'evidence', 'followup'] as const

type ComponentName = (typeof componentOrder)[number]

type DimensionValues = Readonly<Record<string, number>>

export interface ScoreDecisionInput {
  readonly weights: DimensionValues
  readonly ratings: DimensionValues
  readonly evidencePoints: number
  readonly followupQuality: number
  readonly caps: readonly number[]
}

export interface ScoreDecisionResult {
  readonly qualityQuarterUnits: number
  readonly exactTotalUnits: number
  readonly total: number
  readonly components: Readonly<Record<ComponentName, number>>
}

function isIntegerInRange(value: number, minimum: number, maximum: number) {
  return Number.isInteger(value) && value >= minimum && value <= maximum
}

function validateInput(input: ScoreDecisionInput) {
  const weightEntries = Object.entries(input.weights)
  const ratingKeys = Object.keys(input.ratings)
  const weightKeys = weightEntries.map(([key]) => key)
  const weightTotal = weightEntries.reduce((total, [, value]) => total + value, 0)
  const hasMatchingKeys =
    weightKeys.length === ratingKeys.length &&
    weightKeys.every((key) => Object.hasOwn(input.ratings, key))
  const hasValidWeights = weightEntries.every(([, value]) =>
    isIntegerInRange(value, 0, 100),
  )
  const hasValidRatings = Object.values(input.ratings).every((value) =>
    isIntegerInRange(value, 0, 4),
  )
  const hasValidCaps = input.caps.every((value) =>
    isIntegerInRange(value, 0, 100),
  )

  if (
    weightTotal !== 100 ||
    !hasMatchingKeys ||
    !hasValidWeights ||
    !hasValidRatings ||
    !isIntegerInRange(input.evidencePoints, 0, 20) ||
    !isIntegerInRange(input.followupQuality, 0, 100) ||
    !hasValidCaps
  ) {
    throw new Error('Invalid scoring input')
  }
}

function calculateQualityQuarterUnits(input: ScoreDecisionInput) {
  const rawQualityQuarterUnits = Object.entries(input.weights).reduce(
    (total, [dimension, weight]) =>
      total + weight * (input.ratings[dimension] ?? 0),
    0,
  )
  const lowestCap = input.caps.length === 0 ? 100 : Math.min(...input.caps)
  const capQuarterUnits = lowestCap * QUALITY_QUARTERS_PER_POINT

  return Math.min(rawQualityQuarterUnits, capQuarterUnits)
}

function apportionComponents(
  exactUnits: Readonly<Record<ComponentName, number>>,
  total: number,
) {
  const baseComponents = Object.fromEntries(
    componentOrder.map((component) => [
      component,
      Math.floor(exactUnits[component] / SCORE_UNIT_DENOMINATOR),
    ]),
  ) as Record<ComponentName, number>
  const baseTotal = componentOrder.reduce(
    (sum, component) => sum + baseComponents[component],
    0,
  )
  const unitsToDistribute = total - baseTotal
  const rankedComponents = componentOrder
    .map((component, tieBreakIndex) => ({
      component,
      remainder: exactUnits[component] % SCORE_UNIT_DENOMINATOR,
      tieBreakIndex,
    }))
    .sort(
      (left, right) =>
        right.remainder - left.remainder ||
        left.tieBreakIndex - right.tieBreakIndex,
    )

  return rankedComponents
    .slice(0, unitsToDistribute)
    .reduce<Record<ComponentName, number>>(
      (components, { component }) => ({
        ...components,
        [component]: components[component] + 1,
      }),
      baseComponents,
    )
}

export function scoreDecision(
  input: ScoreDecisionInput,
): ScoreDecisionResult {
  validateInput(input)

  const qualityQuarterUnits = calculateQualityQuarterUnits(input)
  const exactComponents = {
    main: 25 * qualityQuarterUnits,
    evidence: SCORE_UNIT_DENOMINATOR * input.evidencePoints,
    followup: 60 * input.followupQuality,
  } as const
  const exactTotalUnits = componentOrder.reduce(
    (total, component) => total + exactComponents[component],
    0,
  )
  const total = Math.floor(
    (exactTotalUnits + SCORE_UNIT_DENOMINATOR / 2) /
      SCORE_UNIT_DENOMINATOR,
  )

  return {
    qualityQuarterUnits,
    exactTotalUnits,
    total,
    components: apportionComponents(exactComponents, total),
  }
}
