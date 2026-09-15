'use client';

import React from 'react';
import { Activity, Clock, ShoppingCart, PhoneCall, CheckSquare, UserCheck } from 'lucide-react';

interface ActivityItem {
  id: string;
  event_type: string;
  title: string;
  module: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: any;
  timestamp: string;
}

interface ActivityTimelineProps {
  timeline: ActivityItem[];
}

export default function ActivityTimeline({ timeline }: ActivityTimelineProps) {
  const getIcon = (type: string) => {
    if (type.includes('ORDER')) return <ShoppingCart size={14} className="text-amber-600" />;
    if (type.includes('CALL') || type.includes('FOLLOWUP')) return <PhoneCall size={14} className="text-blue-500" />;
    if (type.includes('TASK')) return <CheckSquare size={14} className="text-purple-500" />;
    if (type.includes('ATTENDANCE')) return <UserCheck size={14} className="text-emerald-500" />;
    return <Activity size={14} className="text-muted" />;
  };

  return (
    <div className="bg-white border border-border rounded-xl p-5 shadow-xs mb-6">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Activity className="text-amber" size={18} />
          <h3 className="text-sm font-bold text-navy">Recent Activity Timeline</h3>
        </div>
        <span className="text-xs text-muted">Chronological Events</span>
      </div>

      <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
        {timeline.length === 0 ? (
          <p className="text-xs text-muted italic">No recent activities logged.</p>
        ) : (
          timeline.map((item) => (
            <div key={item.id} className="relative flex items-start gap-3 text-xs">
              <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-white border border-border flex items-center justify-center shadow-xs">
                {getIcon(item.event_type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-navy truncate">{item.title}</p>
                  <span className="text-[10px] text-muted flex items-center gap-1 flex-shrink-0">
                    <Clock size={11} />
                    {new Date(item.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {item.metadata && Object.keys(item.metadata).length > 0 && (
                  <p className="text-[11px] text-muted mt-0.5 truncate">
                    {item.metadata.customer_name && `Customer: ${item.metadata.customer_name} • `}
                    {item.metadata.amount && `Amount: ₹${item.metadata.amount} • `}
                    {item.metadata.status && `Status: ${item.metadata.status} • `}
                    {item.metadata.outcome && `Outcome: ${item.metadata.outcome}`}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
