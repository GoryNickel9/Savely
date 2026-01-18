import { useMemo } from 'react'
import { usePortfolio } from './usePortfolio'
import { useTransactions } from './useTransactions'

interface FireDefaults {
  currentSavings: number
  annualIncome: number
  annualExpenses: number
  annualContribution: number
}

/**
 * Hook per calcolare i valori predefiniti dei calcolatori FIRE dai dati del database
 * 
 * Calcola i valori come media degli ultimi 24 mesi per rendere i dati più stabili
 * e sempre aggiornati.
 * 
 * @returns Oggetto con i valori predefiniti o null se non ci sono dati sufficienti
 */
export function useFireDefaultsFromDB(): FireDefaults | null {
  const { totalValue } = usePortfolio()
  const { transactions } = useTransactions()
  
  return useMemo(() => {
    // Calcola la data di 24 mesi fa
    const twentyFourMonthsAgo = new Date()
    twentyFourMonthsAgo.setMonth(twentyFourMonthsAgo.getMonth() - 24)
    
    // Filtra le transazioni degli ultimi 24 mesi
    const recentTransactions = transactions.filter(t => {
      const txDate = new Date(t.date)
      return txDate >= twentyFourMonthsAgo
    })
    
    // Se non ci sono dati sufficienti, ritorna null
    if (recentTransactions.length === 0) {
      return null
    }
    
    // Calcola il totale mensile medio per reddito e spese
    let totalIncome = 0
    let totalExpenses = 0
    
    recentTransactions.forEach(t => {
      const amount = Number(t.amount)
      if (t.type === 'income') {
        totalIncome += amount
      } else if (t.type === 'expense') {
        totalExpenses += amount
      }
    })
    
    // Calcola la media mensile e poi annualizza (×12)
    const monthlyAvgIncome = totalIncome / 24
    const monthlyAvgExpenses = totalExpenses / 24
    
    const annualIncome = monthlyAvgIncome * 12
    const annualExpenses = monthlyAvgExpenses * 12
    
    // Calcola i risparmi annuali come reddito - spese (valore diverso dalla RAN)
    const annualContribution = Math.max(0, annualIncome - annualExpenses)
    
    return {
      currentSavings: totalValue,
      annualIncome,
      annualExpenses,
      annualContribution,
    }
  }, [totalValue, transactions])
}

export type { FireDefaults }
