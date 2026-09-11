'use server';

import bcrypt from 'bcryptjs';
import { getPrisma } from '@/lib/prisma';
import { PARENT_ROLE } from '@/auth';
import {
  validateRegisterParentInput,
  type RegisterParentInput,
} from '@/lib/auth-register';

export type RegisterParentResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Create a parent User with hashed password.
 * Does not create ParentStudent or grant class access.
 */
export async function registerParent(
  input: RegisterParentInput,
): Promise<RegisterParentResult> {
  const validated = validateRegisterParentInput(input);
  if (!validated.ok) {
    return { ok: false, error: validated.error };
  }

  const passwordHash = await bcrypt.hash(validated.password, 12);
  const prisma = getPrisma();

  try {
    await prisma.user.create({
      data: {
        email: validated.email,
        name: validated.name,
        role: PARENT_ROLE,
        passwordHash,
      },
    });
    return { ok: true };
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code?: unknown }).code)
        : '';
    if (code === 'P2002') {
      return { ok: false, error: 'An account with this email already exists' };
    }
    console.error('[registerParent]', err);
    return { ok: false, error: 'Could not create account. Please try again.' };
  }
}
