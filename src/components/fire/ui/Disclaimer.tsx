export default function Disclaimer() {
  return (
    <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 text-xs text-gray-500 dark:text-gray-400">
        <p className="font-semibold text-gray-600 dark:text-gray-300 mb-2">⚠️ Disclaimer</p>
        <p className="mb-2">
          Questi calcolatori sono forniti <strong>esclusivamente a scopo educativo e informativo</strong>. 
          Non è intesa come, né deve essere interpretata come, consulenza finanziaria, di investimento, fiscale o legale.
        </p>
        <p className="mb-2">
          I risultati mostrati sono <strong>proiezioni ipotetiche</strong> basate sugli input forniti e sulle assunzioni riguardo 
          rendimenti futuri, inflazione e altri fattori. <strong>I risultati effettivi possono variare</strong> — la performance passata 
          non garantisce risultati futuri.
        </p>
        <p>
          Prima di prendere qualsiasi decisione finanziaria, consulta un <strong>consulente finanziario qualificato</strong>, 
          <strong>professionista fiscale</strong> o un altro professionista idoneo che possa valutare la tua situazione personale.
        </p>
      </div>
    </div>
  )
}
