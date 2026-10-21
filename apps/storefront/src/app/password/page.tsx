import { redirect } from 'next/navigation';

/** The root layout renders the password form while the store is locked; otherwise go home. */
export default function PasswordPage() {
  redirect('/');
}
