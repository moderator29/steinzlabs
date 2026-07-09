import Link from 'next/link';

export default function AdminNotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center space-y-3">
        <h2 className="text-base font-semibold text-white">Admin route not found</h2>
        <Link href="/admin/dashboard" className="naka-button-primary">
          Back to admin
        </Link>
      </div>
    </div>
  );
}
