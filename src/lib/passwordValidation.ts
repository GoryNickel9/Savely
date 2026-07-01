import { z } from 'zod';

// Regex pattern per validare i requisiti della password
const passwordPatterns = {
  minLength: /.{12,}/, // Almeno 12 caratteri
  hasUpperCase: /[A-Z]/, // Almeno una maiuscola
  hasLowerCase: /[a-z]/, // Almeno una minuscola
  hasNumber: /[0-9]/, // Almeno un numero
  hasSymbol: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/, // Almeno un simbolo
};

// Schema Zod per la validazione della password
export const passwordSchema = z.string()
  .min(12, 'La password deve essere di almeno 12 caratteri')
  .regex(passwordPatterns.hasUpperCase, 'La password deve contenere almeno una lettera maiuscola')
  .regex(passwordPatterns.hasLowerCase, 'La password deve contenere almeno una lettera minuscola')
  .regex(passwordPatterns.hasNumber, 'La password deve contenere almeno un numero')
  .regex(passwordPatterns.hasSymbol, 'La password deve contenere almeno un simbolo (!@#$%^&*()_+-=[]{}|;:,.<>?)');

// Schema per conferma password
export const confirmPasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Le password non corrispondono',
  path: ['confirmPassword'],
});

// Funzione per verificare i requisiti della password
export interface PasswordRequirements {
  minLength: boolean;
  hasUpperCase: boolean;
  hasLowerCase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
}

export function checkPasswordRequirements(password: string): PasswordRequirements {
  return {
    minLength: passwordPatterns.minLength.test(password),
    hasUpperCase: passwordPatterns.hasUpperCase.test(password),
    hasLowerCase: passwordPatterns.hasLowerCase.test(password),
    hasNumber: passwordPatterns.hasNumber.test(password),
    hasSymbol: passwordPatterns.hasSymbol.test(password),
  };
}

// Funzione per verificare se la password soddisfa tutti i requisiti
export function isPasswordValid(password: string): boolean {
  const requirements = checkPasswordRequirements(password);
  return Object.values(requirements).every(req => req);
}

// Oggetto con i requisiti da mostrare nell'interfaccia utente
export const passwordRequirementsList = [
  { key: 'minLength' as const, label: 'Almeno 12 caratteri' },
  { key: 'hasUpperCase' as const, label: 'Almeno una lettera maiuscola' },
  { key: 'hasLowerCase' as const, label: 'Almeno una lettera minuscola' },
  { key: 'hasNumber' as const, label: 'Almeno un numero' },
  { key: 'hasSymbol' as const, label: 'Almeno un simbolo (!@#$%^&*()_+-=[]{}|;:,.<>?)' },
];
