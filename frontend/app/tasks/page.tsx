'use client';

import AppShell from '@/components/layout/AppShell';
import Topbar from '@/components/layout/Topbar';
import CombinedWorkspaceView from '@/components/tasks/CombinedWorkspaceView';

export default function TasksPage() {
  return (
    <AppShell>
      <Topbar
        title="Tasks Workspace"
        subtitle="Unified single-window operational management — Standard tickets and daily directives"
      />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/50">
        <CombinedWorkspaceView />
      </main>
    </AppShell>
  );
}
