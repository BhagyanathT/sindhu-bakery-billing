// src/app/(auth)/register/page.tsx
// Public registration is DISABLED. Only admins can create users via Settings → Users.
import { redirect } from 'next/navigation';

export default function RegisterPage() {
  redirect('/login');
}
