import { useSearchParams } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useFireDefaultsFromDB } from './useFireDefaultsFromDB'
import type { FireDefaults } from './useFireDefaultsFromDB'

const STORAGE_KEY = 'fire-calc-params'

interface CalculatorParams {
  currentAge: number
  retirementAge: number
  currentSavings: number
  annualContribution: number
  annualIncome: number
  expectedReturn: number
  inflationRate: number
  withdrawalRate: number
  annualExpenses: number
  partTimeIncome: number
  portfolioValue: number
  retirementYears: number
}

const DEFAULTS: CalculatorParams = {
  currentAge: 30,
  retirementAge: 55,
  currentSavings: 100000,
  annualContribution: 24000,
  annualIncome: 72000,
  expectedReturn: 0.07,
  inflationRate: 0.03,
  withdrawalRate: 0.04,
  annualExpenses: 48000,
  partTimeIncome: 20000,
  portfolioValue: 1000000,
  retirementYears: 30,
}

const PARAM_KEYS: Record<keyof CalculatorParams, string> = {
  currentAge: 'age',
  retirementAge: 'retire',
  currentSavings: 'savings',
  annualContribution: 'contrib',
  annualIncome: 'income',
  expectedReturn: 'return',
  inflationRate: 'inflation',
  withdrawalRate: 'swr',
  annualExpenses: 'expenses',
  partTimeIncome: 'parttime',
  portfolioValue: 'portfolio',
  retirementYears: 'years',
}

// localStorage utilities
function loadFromStorage(): Partial<CalculatorParams> | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    return JSON.parse(stored)
  } catch {
    return null
  }
}

function saveToStorage(params: Partial<CalculatorParams>): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(params))
  } catch {
    // Silently fail if storage is unavailable
  }
}

function clearStorage(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Silently fail if storage is unavailable
  }
}

export function useFireCalculatorParams(dbDefaults?: FireDefaults) {
  const [searchParams, setSearchParams] = useSearchParams()
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Load stored params immediately (synchronously) during initialization
  const storedParamsRef = useRef<Partial<CalculatorParams> | null>(loadFromStorage())

  // Cleanup del timer debounce allo smontaggio (evita setState su componente smontato)
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  const params = useMemo((): CalculatorParams => {
    const getParam = (key: keyof CalculatorParams): number => {
      const urlKey = PARAM_KEYS[key]
      const urlValue = searchParams.get(urlKey)
      
      // Priority: URL params > localStorage > DB defaults > hardcoded defaults
      // If URL has a value, use it
      if (urlValue !== null) {
        const parsed = parseFloat(urlValue)
        return isNaN(parsed) ? DEFAULTS[key] : parsed
      }
      
      // If no URL value, try localStorage
      if (storedParamsRef.current && key in storedParamsRef.current) {
        const storedValue = storedParamsRef.current[key]
        // Only use stored value if it's not undefined or null
        if (storedValue !== undefined && storedValue !== null) {
          return storedValue
        }
      }
      
      // If no localStorage value, try DB defaults (if available)
      if (dbDefaults && key in dbDefaults) {
        const dbValue = dbDefaults[key as keyof FireDefaults]
        if (dbValue !== undefined && dbValue !== null) {
          return dbValue
        }
      }
      
      // Fall back to hardcoded defaults
      return DEFAULTS[key]
    }

    return {
      currentAge: getParam('currentAge'),
      retirementAge: getParam('retirementAge'),
      currentSavings: getParam('currentSavings'),
      annualContribution: getParam('annualContribution'),
      annualIncome: getParam('annualIncome'),
      expectedReturn: getParam('expectedReturn'),
      inflationRate: getParam('inflationRate'),
      withdrawalRate: getParam('withdrawalRate'),
      annualExpenses: getParam('annualExpenses'),
      partTimeIncome: getParam('partTimeIncome'),
      portfolioValue: getParam('portfolioValue'),
      retirementYears: getParam('retirementYears'),
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const setParam = useCallback((key: keyof CalculatorParams, value: number) => {
    const urlKey = PARAM_KEYS[key]
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev)
      const defaultValue = DEFAULTS[key]
      
      // Compare with defaults
      const isDefault = value === defaultValue
      
      if (isDefault) {
        newParams.delete(urlKey)
      } else {
        newParams.set(urlKey, value.toString())
      }
      return newParams
    }, { replace: true })
    
    // Also save to localStorage
    const currentStored = loadFromStorage() || {}
    const updatedStored = { ...currentStored, [key]: value }
    saveToStorage(updatedStored)
    storedParamsRef.current = updatedStored
  }, [setSearchParams])

  // Debounced version of setParam for high-frequency updates (like slider inputs)
  const setParamDebounced = useCallback((key: keyof CalculatorParams, value: number, delay = 300) => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      setParam(key, value)
    }, delay)
  }, [setParam])

  const setParams = useCallback((updates: Partial<CalculatorParams>) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev)
      Object.entries(updates).forEach(([key, value]) => {
        const typedKey = key as keyof CalculatorParams
        const urlKey = PARAM_KEYS[typedKey]
        const defaultValue = DEFAULTS[typedKey]
        
        const isDefault = value === defaultValue
        
        if (isDefault) {
          newParams.delete(urlKey)
        } else {
          newParams.set(urlKey, value.toString())
        }
      })
      return newParams
    }, { replace: true })
    
    // Also save all updates to localStorage
    const currentStored = loadFromStorage() || {}
    const updatedStored = { ...currentStored, ...updates }
    saveToStorage(updatedStored)
    storedParamsRef.current = updatedStored
  }, [setSearchParams])

  const resetParams = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true })
    clearStorage()
    storedParamsRef.current = null
  }, [setSearchParams])

  const resetToDBDefaults = useCallback(() => {
    // Clear only URL params that are calculated from database
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev)
      // Remove only params that come from database
      newParams.delete('savings')
      newParams.delete('income')
      newParams.delete('contrib')
      return newParams
    }, { replace: true })
    
    // Remove only DB-calculated values from localStorage
    const currentStored = loadFromStorage() || {}
    const updatedStored = { ...currentStored }
    delete updatedStored.currentSavings
    delete updatedStored.annualIncome
    delete updatedStored.annualContribution
    saveToStorage(updatedStored)
    storedParamsRef.current = updatedStored
    
    // If DB defaults are available, set them as new defaults
    if (dbDefaults) {
      const updates: Partial<CalculatorParams> = {}
      
      // Only set values that exist in dbDefaults
      if (dbDefaults.currentSavings !== undefined) {
        updates.currentSavings = dbDefaults.currentSavings
      }
      if (dbDefaults.annualIncome !== undefined) {
        updates.annualIncome = dbDefaults.annualIncome
      }
      if (dbDefaults.annualContribution !== undefined) {
        updates.annualContribution = dbDefaults.annualContribution
      }
      
      // Save to localStorage
      if (Object.keys(updates).length > 0) {
        const finalStored = { ...updatedStored, ...updates }
        saveToStorage(finalStored)
        storedParamsRef.current = finalStored
      }
    }
  }, [setSearchParams, dbDefaults])

  const copyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      return true
    } catch {
      return false
    }
  }, [])

  const hasCustomParams = searchParams.toString().length > 0

  return {
    params,
    setParam,
    setParamDebounced,
    setParams,
    resetParams,
    resetToDBDefaults,
    copyUrl,
    hasCustomParams,
  }
}

export type { CalculatorParams }
