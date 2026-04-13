import { redirect } from 'next/navigation';

// /whitepaper now redirects here — keeping this for old links
export default function DocsRedirectPage() {
  redirect('/docs');
}
