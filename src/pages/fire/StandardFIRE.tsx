import { useMemo } from 'react'
import { useFireCalculatorParams } from '@/hooks/useFireCalculatorParams'
import { useFireDefaultsFromDB } from '@/hooks/useFireDefaultsFromDB'
import { calculateStandardFIRE, formatCurrency } from '@/lib/fire/calculations'
import { CurrencyInput, PercentageInput, AgeInput } from '@/components/fire/inputs'
import { ResultCard, ProgressToFIRE, Disclaimer } from '@/components/fire/ui'
import { ProjectionChart } from '@/components/fire/charts'
import MainLayout from '@/components/layout/MainLayout'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router'
import { ArrowLeft, RotateCcw } from 'lucide-react'

export default function StandardFIRE() {
  const dbDefaults = useFireDefaultsFromDB()
  const { params, setParam, resetToDBDefaults } = useFireCalculatorParams(dbDefaults || undefined)

  const results = useMemo(() => {
    return calculateStandardFIRE({
      currentAge: params.currentAge,
      retirementAge: params.retirementAge,
      currentSavings: params.currentSavings,
      annualContribution: params.annualContribution,
      annualIncome: params.annualIncome,
      expectedReturn: params.expectedReturn,
      inflationRate: params.inflationRate,
      withdrawalRate: params.withdrawalRate,
      annualExpenses: params.annualExpenses,
    })
  }, [params])

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
              <span className="text-3xl" role="img" aria-label="Target emoji">🎯</span>
              FIRE Calculator
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Calcola il tuo percorso verso l'indipendenza finanziaria.
            </p>
          </div>
      </div>

      {/* Progress Bar */}
      <ProgressToFIRE 
        currentSavings={params.currentSavings} 
        fireNumber={results.fireNumber}
        yearsToFIRE={results.yearsToFIRE}
      />

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
            <AgeInput
              label="Target pensione"
              value={params.retirementAge}
              onChange={(v) => setParam('retirementAge', v)}
            />
            <CurrencyInput
              label="Risparmio attuale"
              value={params.currentSavings}
              onChange={(v) => setParam('currentSavings', v)}
              tooltip="Totale asset investiti (Fondi pensione, TFR)"
            />
            <CurrencyInput
              label="Risparmi Annuali"
              value={params.annualContribution}
              onChange={(v) => setParam('annualContribution', v)}
              allowMonthlyToggle
            />
            <CurrencyInput
              label="RAN"
              value={params.annualIncome}
              onChange={(v) => setParam('annualIncome', v)}
              tooltip="Reddito annuo netto"
              allowMonthlyToggle
            />
            <CurrencyInput
              label="Spese Annuali alla pensione"
              value={params.annualExpenses}
              onChange={(v) => setParam('annualExpenses', v)}
              tooltip="Le tue spese annuali previste in pensione"
              allowMonthlyToggle
            />
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
          {/* Key Metrics */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ResultCard
              label="FIRE Number"
              value={results.fireNumber}
              format="currency"
              highlight
              subtext="Target portfolio"
            />
            <ResultCard
              label="Anni al FIRE"
              value={results.yearsToFIRE}
              format="anni"
              subtext={`All'età di ${Math.round(results.fireAge)}`}
            />
            <ResultCard
              label="Savings Rate"
              value={results.savingsRate}
              format="percent"
              subtext={`${formatCurrency(results.monthlyContribution)}/mese`}
            />
          </div>

          {/* Chart */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Proiezione Portfolio</h2>
            </CardHeader>
            <CardContent>
              <ProjectionChart
                data={results.projections}
                fireNumber={results.fireNumber}
                colorScheme="orange"
                height={350}
              />
            </CardContent>
          </Card>

          {/* Additional Info */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Capire questi risultati</h2>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none text-sm">
              <p>
                Il tuo <strong>FIRE Number</strong> ({formatCurrency(results.fireNumber)}) viene calcolato come le tue 
                spese annuali ({formatCurrency(params.annualExpenses)}) diviso per il tasso di prelievo. 
                ({(params.withdrawalRate * 100).toFixed(1)}%).
              </p>
              <p>
                Al tuo attuale tasso di risparmio, raggiungerai l'indipendenza finanziaria in circa{' '}
                <strong>{results.yearsToFIRE.toFixed(1)} anni</strong> (all'età di {Math.round(results.fireAge)}).
              </p>
              <p className="text-gray-500 dark:text-gray-400">
                Il grafico mostra la crescita del tuo portafoglio nel tempo. La linea tratteggiata rappresenta i valori corretti per l'inflazione 
                (potere d'acquisto). La linea rossa è il tuo obiettivo FIRE.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Disclaimer />
    </div>
    </MainLayout>
  )
}
