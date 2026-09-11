import { redirect } from 'next/navigation';

/** Thin alias — canonical sign-in is /login. */
export default function SignInPage() {
  redirect('/login');
}
