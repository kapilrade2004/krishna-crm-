'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';
import DailyTasksView from '@/components/tasks/DailyTasksView';

export default function DailyTasksPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/tasks');
  }, [router]);

  return (
    <AppShell>
      <Topbar title="Tasks Workspace" subtitle="Redirecting to unified Tasks workspace..." />
      <main className="flex-1 overflow-y-auto p-6">
        <DailyTasksView />
      </main>
    </AppShell>
  );
}
