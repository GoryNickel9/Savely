import { useMemo } from 'react'
import { useFireCalculatorParams } from '@/hooks/useFireCalculatorParams'
import { useFireDefaultsFromDB } from '@/hooks/useFireDefaultsFromDB'
import { calculateBaristaFIRE, formatCurrency } from '@/lib/fire/calculations'
import { CurrencyInput, PercentageInput, AgeInput } from '@/components/fire/inputs'
import { ResultCard, ProgressToFIRE, Disclaimer } from '@/components/fire/ui'
import { ProjectionChart } from '@/components/fire/charts'
import MainLayout from '@/components/layout/MainLayout'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router'
import { ArrowLeft, RotateCcw } from 'lucide-react'

export default function BaristaFIRE() {
  const dbDefaults = useFireDefaultsFromDB()
  const { params, setParam, resetToDBDefaults } = useFireCalculatorParams(dbDefaults || undefined)

  const results = useMemo(() => {
    return calculateBaristaFIRE(
      params.currentAge,
      params.currentSavings,
      params.annualContribution,
      params.expectedReturn,
      params.inflationRate,
      params.annualExpenses,
      params.withdrawalRate,
      params.partTimeIncome
    )
  }, [params])

  const portfolioReduction = results.fullFireNumber - results.baristaNumber
  const reductionPercent = (portfolioReduction / results.fullFireNumber) * 100


  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Link to="/fire" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:scale-110 transition-all duration-200">
                <ArrowLeft className="w-4 h-4" />
                Torna ai calcolatori
              </Link>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
              <span className="text-3xl" role="img" aria-label="Coffee emoji">☕</span>
              Barista FIRE Calculator
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Combina il lavoro part-time con i redditi da portafoglio per andare in pensione prima.
            </p>
          </div>
      </div>

      {/* Progress Bar */}
      <ProgressToFIRE 
        currentSavings={params.currentSavings} 
        fireNumber={results.baristaNumber}
        yearsToFIRE={results.yearsToBaristaFIRE}
        label="Progressione al Barista FIRE"
        targetLabel="Barista Number"
      />

      {/* Barista FIRE Explanation Banner */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
        <div className="flex gap-3">
          <span className="text-2xl">☕</span>
          <div>
            <h3 className="font-semibold text-amber-900 dark:text-amber-100">Cosa è il Barista FIRE?</h3>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              Barista FIRE significa avere 
              investimenti sufficienti a coprire la maggior parte delle spese, mentre si svolge un lavoro part-time o poco stressante per coprire il divario.
            </p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Inputs */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Le tue informazioni</h2>
              {dbDefaults && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetToDBDefaults}
                  className="text-xs"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Reset ai valori dal database
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <AgeInput
              label="Età attuale"
              value={params.currentAge}
              onChange={(v) => setParam('currentAge', v)}
            />
            <CurrencyInput
              label="Risparmio attuale"
              value={params.currentSavings}
              onChange={(v) => setParam('currentSavings', v)}
            />
            <CurrencyInput
              label="Risparmi Annuali"
              value={params.annualContribution}
              onChange={(v) => setParam('annualContribution', v)}
            />
            <CurrencyInput
              label="Spese Annuali alla pensione"
              value={params.annualExpenses}
              onChange={(v) => setParam('annualExpenses', v)}
              tooltip="Total yearly spending needs"
            />
            
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                ☕ Lavoro Part-Time
              </h3>
              <CurrencyInput
                label="Part-Time RAN"
                value={params.partTimeIncome}
                onChange={(v) => setParam('partTimeIncome', v)}
                tooltip="Quanto ti aspetti di guadagnare annualmente da un lavoro part-time?"
              />
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
              </p>
            </div>

            <PercentageInput
              label="Ritorno Atteso"
              value={params.expectedReturn}
              onChange={(v) => setParam('expectedReturn', v)}
              tooltip="Ritorno medio annuale degli investimenti"
              min={0}
              max={0.20}
            />
            <PercentageInput
              label="Inflazione"
              value={params.inflationRate}
              onChange={(v) => setParam('inflationRate', v)}
              tooltip="Inflazione annuale prevista (la media storica è del 2%)"
              min={0}
              max={0.25}
            />
            <PercentageInput
              label="Safe Withdrawal Rate"
              value={params.withdrawalRate}
              onChange={(v) => setParam('withdrawalRate', v)}
              tooltip="SWR indica quanto puoi prelevare annualmente dal tuo portafoglio in pensione senza esaurirlo."
              min={0.01}
              max={0.06}
            />
          </CardContent>
        </Card>

        {/* Results */}
        <div className="lg:col-span-2 space-y-6">
          {/* Comparison Banner */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-sm text-amber-700 dark:text-amber-300">Barista Fire vs Standard FIRE</p>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                  {formatCurrency(portfolioReduction)} in meno
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-amber-700 dark:text-amber-300">Riduzione</p>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                  {reductionPercent.toFixed(0)}%
                </p>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ResultCard
              label="Barista FIRE Number"
              value={results.baristaNumber}
              format="currency"
              highlight
              subtext="Target portfolio value"
            />
            <ResultCard
              label="FIRE Number standard"
              value={results.fullFireNumber}
              format="currency"
              subtext="Senza lavoro part-time"
            />
            <ResultCard
              label="Anni al Barista FIRE"
              value={results.yearsToBaristaFIRE}
              format="anni"
              icon="⏱️"
              subtext={`All'età di ${Math.round(params.currentAge + results.yearsToBaristaFIRE)}`}
            />
          </div>

          {/* Income Breakdown */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Ripartizione del reddito in Barista FIRE</h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-400">Prelievi dal portafoglio</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {formatCurrency(params.annualExpenses - params.partTimeIncome)}/anno
                      </span>
                    </div>
                    <div className="h-3 bg-amber-100 dark:bg-amber-900/30 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-amber-500"
                        style={{ width: `${((params.annualExpenses - params.partTimeIncome) / params.annualExpenses) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-400">Reddito Part-Time</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {formatCurrency(params.partTimeIncome)}/anno
                      </span>
                    </div>
                    <div className="h-3 bg-green-100 dark:bg-green-900/30 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500"
                        style={{ width: `${(params.partTimeIncome / params.annualExpenses) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-900 dark:text-gray-100">Reddito Annuale</span>
                    <span className="font-bold text-gray-900 dark:text-gray-100">{formatCurrency(params.annualExpenses)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Chart */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Portfolio Projection</h2>
            </CardHeader>
            <CardContent>
              <ProjectionChart
                data={results.projections}
                fireNumber={results.baristaNumber}
                colorScheme="amber"
                height={350}
              />
            </CardContent>
          </Card>

          {/* Benefits of Barista FIRE */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Benefits of Barista FIRE</h2>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex gap-3">
                  <span className="text-xl">🏥</span>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">Health Insurance</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Many part-time jobs offer benefits, bridging to Medicare</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="text-xl">🤝</span>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">Social Connection</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Stay engaged with a community and routine</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="text-xl">⚡</span>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">Earlier Freedom</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Leave your corporate job years earlier</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="text-xl">🎯</span>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">Lower Target</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Need {reductionPercent.toFixed(0)}% less in your portfolio</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Disclaimer />
    </div>
    </MainLayout>
  )
}
