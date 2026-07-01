import { describe, expect, it } from 'vitest';
import {
  checkPasswordRequirements,
  confirmPasswordSchema,
  isPasswordValid,
  passwordSchema,
} from './passwordValidation';

describe('password validation', () => {
  it('accepts a password that satisfies every requirement', () => {
    const password = 'PasswordSicura1!';

    expect(isPasswordValid(password)).toBe(true);
    expect(passwordSchema.safeParse(password).success).toBe(true);
  });

  it('reports every missing requirement for a weak password', () => {
    expect(checkPasswordRequirements('abc')).toEqual({
      minLength: false,
      hasUpperCase: false,
      hasLowerCase: true,
      hasNumber: false,
      hasSymbol: false,
    });
  });

  it('rejects mismatched password confirmation', () => {
    const result = confirmPasswordSchema.safeParse({
      password: 'PasswordSicura1!',
      confirmPassword: 'PasswordDiversa1!',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['confirmPassword']);
    }
  });
});
