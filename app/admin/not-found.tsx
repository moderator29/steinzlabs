import Link from 'next/link';

export default function AdminNotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center space-y-3">
        <h2 className="text-base font-semibold text-white">Admin route not found</h2>
        <Link href="/admin/dashboard" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--nl-blue,#0066FF)] text-white text-sm font-semibold">
          Back to admin
        </Link>
      </div>
    </div>
  );
}
