import { Link } from 'react-router'
import MainLayout from '@/components/layout/MainLayout'

const calculators = [
  {
    path: '/fire/standard',
    icon: '🎯',
    name: 'Standard FIRE',
    label: 'Standard FIRE',
    description: 'Pianifica il pensionamento anticipato basato su risparmi e investimenti.',
    color: 'text-orange-500',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    borderColor: 'border-orange-200 dark:border-orange-800',
  },
  {
    path: '/fire/barista',
    icon: '☕',
    name: 'Barista FIRE',
    label: 'Barista FIRE',
    description: 'Combina il lavoro part-time con i redditi da portafoglio per andare in pensione prima.',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
]

export default function FIREIndex() {
  return (
    <MainLayout>
      <div className="space-y-12">
        <div>
          <h1 className="text-3xl font-display font-bold">Calcolatori FIRE</h1>
          <p className="text-muted-foreground mt-1">
            Calcola il tuo percorso verso l'indipendenza finanziaria
          </p>
        </div>

        {/* Calculator Grid */}
        <div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {calculators.map((calc) => (
              <Link key={calc.path} to={calc.path} className="group">
                <div className={`h-full transition-all duration-200 hover:shadow-lg hover:scale-[1.02] ${calc.borderColor} border-2 bg-card rounded-xl p-6`}>
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${calc.bgColor}`}>
                      <span className="text-3xl">{calc.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-lg font-semibold text-gray-900 dark:text-gray-100 group-hover:text-fire-600 dark:group-hover:text-fire-400 transition-colors`}>
                        {calc.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {calc.description}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-sm font-medium text-fire-600 dark:text-fire-400 group-hover:translate-x-1 transition-transform">
                    Inizia a calcolare
                    <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Info Section */}
        <div className="bg-card border-border rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Cos'è FIRE?</h2>
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>
              Il <strong>FIRE?</strong> sta per Financial Independence, Retire Early (Indipendenza Finanziaria, Pensionamento Anticipato). 
              È un movimento finanziario focalizzato sul risparmio estremo e sull'investimento per andare in pensione molto prima dell'età tradizionale.
            </p>
            <p>
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
