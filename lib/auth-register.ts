/**
 * Parent registration validation (pure — unit-testable).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RegisterParentInput = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export type RegisterValidation =
  | { ok: true; name: string; email: string; password: string }
  | { ok: false; error: string };

export function validateRegisterParentInput(
  input: RegisterParentInput,
): RegisterValidation {
  const name = (input.name || '').trim();
  const email = (input.email || '').trim().toLowerCase();
  const password = input.password || '';
  const confirmPassword = input.confirmPassword || '';

  if (!name) {
    return { ok: false, error: 'Name is required' };
  }
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, error: 'Enter a valid email address' };
  }
  if (password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters' };
  }
  if (password !== confirmPassword) {
    return { ok: false, error: 'Passwords do not match' };
  }

  return { ok: true, name, email, password };
}
