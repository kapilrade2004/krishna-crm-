import React from 'react';
import Link from 'next/link';
import { FileQuestion, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="card max-w-md w-full p-6 text-center shadow-lg border border-border bg-white rounded-2xl">
        <div className="w-14 h-14 rounded-2xl bg-amber/15 text-amber-700 flex items-center justify-center mx-auto mb-4">
          <FileQuestion size={28} />
        </div>
        <h2 className="text-lg font-bold text-navy mb-1">Page Not Found</h2>
        <p className="text-xs text-muted mb-5">
          The page or workspace view you requested does not exist or has been moved.
        </p>

        <Link
          href="/dashboard"
          className="btn btn-primary text-xs px-4 py-2 inline-flex items-center gap-2"
        >
          <Home size={14} />
          <span>Go to Dashboard</span>
        </Link>
      </div>
    </div>
  );
}
