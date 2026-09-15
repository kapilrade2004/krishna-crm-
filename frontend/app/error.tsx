'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App Router Uncaught Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="card max-w-md w-full p-6 text-center shadow-lg border border-border bg-white rounded-2xl">
        <div className="w-14 h-14 rounded-2xl bg-danger/10 text-danger flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={28} />
        </div>
        <h2 className="text-lg font-bold text-navy mb-2">Something went wrong</h2>
        <p className="text-xs text-muted mb-5">
          {error?.message || 'An unexpected error occurred while rendering this page.'}
        </p>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="btn btn-primary text-xs px-4 py-2 flex items-center gap-2"
          >
            <RefreshCw size={14} />
            <span>Try Again</span>
          </button>
          <Link
            href="/dashboard"
            className="btn btn-secondary text-xs px-4 py-2 flex items-center gap-2"
          >
            <Home size={14} />
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
