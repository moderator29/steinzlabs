import { redirect } from 'next/navigation';

export default function LegacySecurityCenterRedirect() {
  redirect('/dashboard/security');
}
