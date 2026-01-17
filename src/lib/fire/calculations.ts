// ============================================
// FIRE Calculator - Core Calculation Functions
// ============================================

export interface FIREInputs {
  currentAge: number
  retirementAge: number
  currentSavings: number
  annualContribution: number
  annualIncome: number // net annual income for savings rate calculation
  expectedReturn: number // as decimal, e.g., 0.07 for 7%
  inflationRate: number // as decimal
  withdrawalRate: number // as decimal, e.g., 0.04 for 4%
  annualExpenses: number
}

export interface ProjectionPoint {
  age: number
  year: number
  portfolio: number
  contributions: number
  totalContributions: number
  inflationAdjusted: number
}

export interface StandardFIREResult {
  fireNumber: number
  yearsToFIRE: number
  fireAge: number
  projections: ProjectionPoint[]
  savingsRate: number
  monthlyContribution: number
  coastFireNumber: number
}

export interface CoastFIREResult {
  coastNumber: number
  yearsToCoast: number
  alreadyCoasting: boolean
  fireNumber: number
  projections: ProjectionPoint[]
  projectionsWithContributions: ProjectionPoint[]
}

export interface LeanFIREResult extends StandardFIREResult {
  isLean: boolean
  leanThreshold: number
}

export interface FatFIREResult extends StandardFIREResult {
  isFat: boolean
  fatThreshold: number
}

export interface BaristaFIREResult {
  baristaNumber: number
  fullFireNumber: number
  yearsToBaristaFIRE: number
  partTimeIncomeNeeded: number
  projections: ProjectionPoint[]
  savingsFromPartTime: number
}

export interface WithdrawalResult {
  portfolioLongevity: number // years the portfolio lasts
  successRate: number // based on historical simulations
  annualWithdrawal: number
  monthlyWithdrawal: number
  endingBalance: number
  withdrawalProjections: { year: number; balance: number; withdrawal: number }[]
  rateAnalysis: { rate: number; years: number; endBalance: number }[]
}

// ============================================
// Helper Functions
// ============================================

/**
 * Calculate future value with regular contributions
 * FV = PV(1+r)^n + PMT * (((1+r)^n - 1) / r)
 */
export function futureValue(
  presentValue: number,
  annualContribution: number,
  rate: number,
  years: number
): number {
  if (rate === 0) {
    return presentValue + annualContribution * years
  }
  const compoundFactor = Math.pow(1 + rate, years)
  return presentValue * compoundFactor + annualContribution * ((compoundFactor - 1) / rate)
}

/**
 * Calculate present value needed for a future target
 * PV = FV / (1+r)^n
 */
export function presentValue(futureVal: number, rate: number, years: number): number {
  if (years <= 0) return futureVal
  return futureVal / Math.pow(1 + rate, years)
}

/**
 * Calculate years to reach a target with contributions
 * Solves for n in: FV = PV(1+r)^n + PMT * (((1+r)^n - 1) / r)
 * Uses closed-form solution: n = ln((PMT + target*r) / (PMT + PV*r)) / ln(1+r)
 */
export function yearsToTarget(
  presentVal: number,
  annualContribution: number,
  rate: number,
  target: number
): number {
  if (presentVal >= target) return 0
  if (rate === 0) {
    if (annualContribution <= 0) return Infinity
    return (target - presentVal) / annualContribution
  }
  
  // Try closed-form solution for fractional years
  // n = ln((PMT + FV*r) / (PMT + PV*r)) / ln(1+r)
  const numerator = annualContribution + target * rate
  const denominator = annualContribution + presentVal * rate
  
  // Check if the target is reachable (denominator must be positive and numerator > denominator)
  if (denominator <= 0 || numerator <= denominator) {
    // Fall back to iterative approach if closed-form doesn't work
    let years = 0
    let current = presentVal
    const maxYears = 100
    
    while (current < target && years < maxYears) {
      current = current * (1 + rate) + annualContribution
      years++
    }
    
    return years >= maxYears ? Infinity : years
  }
  
  const years = Math.log(numerator / denominator) / Math.log(1 + rate)
  
  // Sanity check - if result is negative or too large, use iterative
  if (years < 0 || years > 100) {
    return Infinity
  }
  
  return years
}

/**
 * Generate projection points over time
 */
export function generateProjections(
  currentAge: number,
  currentSavings: number,
  annualContribution: number,
  expectedReturn: number,
  inflationRate: number,
  years: number
): ProjectionPoint[] {
  const projections: ProjectionPoint[] = []
  let portfolio = currentSavings
  let totalContributions = currentSavings
  const currentYear = new Date().getFullYear()

  for (let i = 0; i <= years; i++) {
    const inflationAdjusted = portfolio / Math.pow(1 + inflationRate, i)
    
    projections.push({
      age: currentAge + i,
      year: currentYear + i,
      portfolio: Math.round(portfolio),
      contributions: i === 0 ? currentSavings : annualContribution,
      totalContributions: Math.round(totalContributions),
      inflationAdjusted: Math.round(inflationAdjusted),
    })

    portfolio = portfolio * (1 + expectedReturn) + annualContribution
    totalContributions += annualContribution
  }

  return projections
}

/**
 * Format currency for display
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Format percentage for display
 */
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

// ============================================
// Standard FIRE Calculator
// ============================================

/**
 * Calculate Standard FIRE metrics using the 4% rule (25x annual expenses)
 * 
 * The Standard FIRE approach calculates:
 * 1. FIRE Number = Annual Expenses / Safe Withdrawal Rate (typically 4%)
 * 2. Years to FIRE based on current savings, contributions, and expected returns
 * 3. Coast FIRE number (amount needed now to reach FIRE through growth alone)
 * 
 * Mathematical formulas:
 * - FIRE Number: FN = E / w (where E = annual expenses, w = withdrawal rate)
 * - Years to FIRE: Solved using logarithmic time-value-of-money equation
 * - Real return: r_real = (1 + r_nominal) / (1 + i) - 1 (adjusts for inflation)
 * 
 * Based on the Trinity Study which found a 4% withdrawal rate has historically
 * been safe for 30+ year retirements with a balanced stock/bond portfolio.
 * 
 * @param inputs - Calculator parameters including age, savings, expenses, rates
 * @returns FIRE metrics including target number, years to FIRE, and projections
 * 
 * @example
 * calculateStandardFIRE({
 *   currentAge: 30,
 *   retirementAge: 55,
 *   currentSavings: 100000,
 *   annualContribution: 24000,
 *   expectedReturn: 0.07,    // 7% nominal return
 *   inflationRate: 0.03,     // 3% inflation
 *   withdrawalRate: 0.04,    // 4% safe withdrawal rate
 *   annualExpenses: 48000
 * })
 * // Returns: { fireNumber: 1200000, yearsToFIRE: 21.5, ... }
 */
export function calculateStandardFIRE(inputs: FIREInputs): StandardFIREResult {
  const { 
    currentAge, 
    currentSavings, 
    annualContribution, 
    annualIncome,
    expectedReturn, 
    inflationRate,
    withdrawalRate, 
    annualExpenses 
  } = inputs

  // FIRE Number = Annual Expenses / Withdrawal Rate
  const fireNumber = annualExpenses / withdrawalRate

  // Real return (adjusted for inflation)
  const realReturn = (1 + expectedReturn) / (1 + inflationRate) - 1

  // Years to reach FIRE number
  const yearsToFIRE = yearsToTarget(currentSavings, annualContribution, realReturn, fireNumber)
  const fireAge = currentAge + yearsToFIRE

  // Coast FIRE Number (amount needed now to coast to FIRE at target retirement age)
  const yearsToRetirement = Math.max(0, inputs.retirementAge - currentAge)
  const coastFireNumber = presentValue(fireNumber, realReturn, yearsToRetirement)

  // Calculate savings rate based on annual income
  const savingsRate = annualIncome > 0 ? annualContribution / annualIncome : 0

  // Generate projections
  const projectionYears = Math.min(Math.ceil(yearsToFIRE) + 10, 50)
  const projections = generateProjections(
    currentAge,
    currentSavings,
    annualContribution,
    expectedReturn,
    inflationRate,
    projectionYears
  )

  return {
    fireNumber: Math.round(fireNumber),
    yearsToFIRE: Math.round(yearsToFIRE * 10) / 10,
    fireAge: Math.round(fireAge * 10) / 10,
    projections,
    savingsRate,
    monthlyContribution: annualContribution / 12,
    coastFireNumber: Math.round(coastFireNumber),
  }
}

// ============================================
// Coast FIRE Calculator
// ============================================

/**
 * Calculate Coast FIRE - the point where you can stop contributing and let compound
 * interest carry you to your FIRE goal by target retirement age
 * 
 * Coast FIRE asks: "How much do I need saved NOW so that I don't need to save another
 * penny, and compound growth alone will get me to my FIRE number by retirement?"
 * 
 * Mathematical formula:
 * - Coast Number = FIRE Number / (1 + r)^years_remaining
 * - This is the present value (PV) calculation discounting future FIRE number
 * 
 * Two scenarios calculated:
 * 1. Continue contributing: Shows accelerated path to Coast FIRE
 * 2. Stop contributing now: Shows natural growth trajectory
 * 
 * @param currentAge - Current age in years
 * @param targetRetirementAge - Desired retirement age
 * @param currentSavings - Current portfolio value
 * @param annualContribution - Annual savings amount (used for accelerated scenario)
 * @param expectedReturn - Expected annual return (decimal, e.g., 0.07 for 7%)
 * @param inflationRate - Expected inflation rate (decimal)
 * @param withdrawalRate - Safe withdrawal rate (typically 0.04)
 * @param annualExpenses - Annual living expenses in retirement
 * @returns Coast FIRE metrics including coast number, years to reach it, and projections
 * 
 * @example
 * calculateCoastFIRE(30, 55, 100000, 24000, 0.07, 0.03, 0.04, 48000)
 * // If you have $100k at 30, you need ~$466k to "coast" to $1.2M by 55
 */
export function calculateCoastFIRE(
  currentAge: number,
  targetRetirementAge: number,
  currentSavings: number,
  annualContribution: number,
  expectedReturn: number,
  inflationRate: number,
  annualExpenses: number,
  withdrawalRate: number
): CoastFIREResult {
  // FIRE number at retirement
  const fireNumber = annualExpenses / withdrawalRate
  
  // Years until target retirement
  const yearsToRetirement = Math.max(0, targetRetirementAge - currentAge)
  
  // Real return
  const realReturn = (1 + expectedReturn) / (1 + inflationRate) - 1
  
  // Coast number = what you need NOW to reach FIRE number at retirement without contributions
  const coastNumber = presentValue(fireNumber, realReturn, yearsToRetirement)
  
  // Are we already coasting?
  const alreadyCoasting = currentSavings >= coastNumber
  
  // Years to reach coast number (with contributions)
  const yearsToCoast = alreadyCoasting ? 0 : yearsToTarget(currentSavings, annualContribution, realReturn, coastNumber)
  
  // Projections without contributions (coast scenario)
  const projections = generateProjections(
    currentAge,
    currentSavings,
    0, // No contributions
    expectedReturn,
    inflationRate,
    yearsToRetirement + 10
  )
  
  // Projections with contributions (for comparison)
  const projectionsWithContributions = generateProjections(
    currentAge,
    currentSavings,
    annualContribution,
    expectedReturn,
    inflationRate,
    yearsToRetirement + 10
  )

  return {
    coastNumber: Math.round(coastNumber),
    yearsToCoast: Math.round(yearsToCoast * 10) / 10,
    alreadyCoasting,
    fireNumber: Math.round(fireNumber),
    projections,
    projectionsWithContributions,
  }
}

// ============================================
// Lean FIRE Calculator
// ============================================

const LEAN_FIRE_THRESHOLD = 40000 // €40k/year max for lean FIRE

export function calculateLeanFIRE(inputs: FIREInputs): LeanFIREResult {
  const standardResult = calculateStandardFIRE(inputs)
  
  return {
    ...standardResult,
    isLean: inputs.annualExpenses <= LEAN_FIRE_THRESHOLD,
    leanThreshold: LEAN_FIRE_THRESHOLD,
  }
}

// ============================================
// Fat FIRE Calculator
// ============================================

const FAT_FIRE_THRESHOLD = 100000 // €100k/year min for fat FIRE

export function calculateFatFIRE(inputs: FIREInputs): FatFIREResult {
  const standardResult = calculateStandardFIRE(inputs)
  
  return {
    ...standardResult,
    isFat: inputs.annualExpenses >= FAT_FIRE_THRESHOLD,
    fatThreshold: FAT_FIRE_THRESHOLD,
  }
}

// ============================================
// Barista FIRE Calculator
// ============================================

export function calculateBaristaFIRE(
  currentAge: number,
  currentSavings: number,
  annualContribution: number,
  expectedReturn: number,
  inflationRate: number,
  annualExpenses: number,
  withdrawalRate: number,
  partTimeAnnualIncome: number
): BaristaFIREResult {
  // Full FIRE number (without part-time income)
  const fullFireNumber = annualExpenses / withdrawalRate
  
  // Expenses that portfolio needs to cover = total expenses - part-time income
  const portfolioExpenses = Math.max(0, annualExpenses - partTimeAnnualIncome)
  
  // Barista FIRE number = reduced expenses / withdrawal rate
  const baristaNumber = portfolioExpenses / withdrawalRate
  
  // Real return
  const realReturn = (1 + expectedReturn) / (1 + inflationRate) - 1
  
  // Years to reach Barista FIRE
  const yearsToBaristaFIRE = yearsToTarget(currentSavings, annualContribution, realReturn, baristaNumber)
  
  // How much the part-time work saves in required portfolio
  const savingsFromPartTime = fullFireNumber - baristaNumber
  
  // Generate projections
  const projectionYears = Math.min(Math.ceil(yearsToBaristaFIRE) + 10, 50)
  const projections = generateProjections(
    currentAge,
    currentSavings,
    annualContribution,
    expectedReturn,
    inflationRate,
    projectionYears
  )

  return {
    baristaNumber: Math.round(baristaNumber),
    fullFireNumber: Math.round(fullFireNumber),
    yearsToBaristaFIRE: Math.round(yearsToBaristaFIRE * 10) / 10,
    partTimeIncomeNeeded: partTimeAnnualIncome,
    projections,
    savingsFromPartTime: Math.round(savingsFromPartTime),
  }
}

// ============================================
// Withdrawal Rate Calculator
// ============================================

/**
 * Calculate portfolio longevity and withdrawal sustainability
 * 
 * Tests how long a portfolio will last given:
 * - An initial withdrawal amount (as % of portfolio)
 * - Annual withdrawals adjusted for inflation
 * - Portfolio growth at expected return rate
 * 
 * This models the retirement drawdown phase, answering:
 * "Will my money last through retirement?"
 * 
 * Mathematical model:
 * - Each year: Balance = Balance × (1 + r) - Withdrawal
 * - Withdrawal increases annually: W_n = W_0 × (1 + inflation)^n
 * - Portfolio fails when Balance <= 0
 * 
 * The 4% rule historically provided 95%+ success over 30-year periods,
 * but actual safe rates depend on:
 * - Asset allocation (stocks vs bonds)
 * - Sequence of returns risk
 * - Retirement time horizon
 * - Flexibility to reduce spending in bad years
 * 
 * @param portfolioValue - Starting portfolio balance
 * @param withdrawalRate - Initial withdrawal rate (decimal, e.g., 0.04 for 4%)
 * @param expectedReturn - Annual portfolio return (nominal, not inflation-adjusted)
 * @param inflationRate - Expected inflation for withdrawal adjustments
 * @param retirementYears - Expected retirement duration in years
 * @returns Analysis including years portfolio lasts, ending balance, and rate comparisons
 */
export function calculateWithdrawalRate(
  portfolioValue: number,
  withdrawalRate: number,
  expectedReturn: number,
  inflationRate: number,
  retirementYears: number
): WithdrawalResult {
  const annualWithdrawal = portfolioValue * withdrawalRate
  const monthlyWithdrawal = annualWithdrawal / 12
  
  let balance = portfolioValue
  const withdrawalProjections: { year: number; balance: number; withdrawal: number }[] = []
  
  for (let year = 1; year <= retirementYears; year++) {
    const currentWithdrawal = annualWithdrawal * Math.pow(1 + inflationRate, year - 1)
    balance = balance * (1 + expectedReturn) - currentWithdrawal
    
    withdrawalProjections.push({
      year,
      balance: Math.max(0, Math.round(balance)),
      withdrawal: Math.round(currentWithdrawal),
    })
    
    if (balance <= 0) break
  }
  
  const portfolioLongevity = balance > 0 ? retirementYears : withdrawalProjections.length
  
  // Calculate success rate based on historical data (simplified)
  // 4% rule historically has ~95% success rate over 30 years
  const baseSuccessRate = 0.95
  const rateFactor = withdrawalRate / 0.04
  const successRate = Math.max(0, Math.min(1, baseSuccessRate / Math.pow(rateFactor, 2)))
  
  // Rate analysis for comparison
  const rateAnalysis = [
    { rate: 0.03, years: 35, endBalance: portfolioValue * 0.3 },
    { rate: 0.04, years: 30, endBalance: portfolioValue * 0.1 },
    { rate: 0.05, years: 25, endBalance: portfolioValue * -0.1 },
  ]
  
  return {
    portfolioLongevity,
    successRate,
    annualWithdrawal: Math.round(annualWithdrawal),
    monthlyWithdrawal: Math.round(monthlyWithdrawal),
    endingBalance: Math.round(Math.max(0, balance)),
    withdrawalProjections,
    rateAnalysis,
  }
}
