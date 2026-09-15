'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global App Error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center bg-slate-100 p-4 font-sans">
        <div className="max-w-md w-full p-6 text-center shadow-lg border border-slate-200 bg-white rounded-2xl">
          <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={28} />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Application Error</h2>
          <p className="text-xs text-slate-500 mb-5">
            {error?.message || 'A critical error occurred. Please refresh or restart the server.'}
          </p>

          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold shadow hover:bg-slate-800 transition-all flex items-center justify-center gap-2 mx-auto"
          >
            <RefreshCw size={14} />
            <span>Reload Application</span>
          </button>
        </div>
      </body>
    </html>
  );
}
