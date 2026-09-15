'use client';

import React from 'react';
import Image from 'next/image';
import { Calendar, Shield, Briefcase, Mail, Phone } from 'lucide-react';

interface EmployeeProfileHeaderProps {
  employee: {
    id: string;
    employee_code: string;
    full_name: string;
    department: string;
    designation: string;
    status: string;
    date_of_joining?: string;
    reporting_manager?: string;
    email?: string;
    phone?: string;
    avatar_url?: string;
  };
  template: 'sales_executive' | 'technician';
}

export default function EmployeeProfileHeader({ employee, template }: EmployeeProfileHeaderProps) {
  const isInactive = employee.status !== 'active';

  return (
    <div className="w-full bg-white border border-border rounded-xl p-5 shadow-xs mb-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Left Side: Avatar + Details */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="relative">
            {employee.avatar_url ? (
              <Image
                src={employee.avatar_url}
                alt={employee.full_name}
                width={64}
                height={64}
                className="w-16 h-16 rounded-full object-cover border-2 border-amber/40 shadow-xs"
                unoptimized
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-navy text-amber font-bold text-xl flex items-center justify-center shadow-xs">
                {employee.full_name?.charAt(0) || 'E'}
              </div>
            )}
            <span
              className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white ${
                isInactive ? 'bg-red-500' : 'bg-emerald-500'
              }`}
              title={isInactive ? 'Inactive' : 'Active'}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-bold text-navy truncate">
                {employee.full_name}
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                  template === 'technician'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {template === 'technician' ? 'Technician Audit' : 'Sales Executive Audit'}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isInactive
                    ? 'bg-gray-100 text-muted'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {employee.status || 'Active'}
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted mt-1 flex-wrap">
              <span className="flex items-center gap-1 font-medium text-navy">
                <Briefcase size={14} className="text-amber" />
                {employee.designation} ({employee.department})
              </span>
              <span className="flex items-center gap-1">
                <Shield size={14} className="text-muted" />
                ID: <code className="font-mono text-navy font-semibold">{employee.employee_code}</code>
              </span>
              {employee.date_of_joining && (
                <span className="flex items-center gap-1">
                  <Calendar size={14} className="text-muted" />
                  Joined: {new Date(employee.date_of_joining).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Manager & Contact */}
        <div className="flex items-center gap-6 text-xs border-t md:border-t-0 md:border-l border-border pt-3 md:pt-0 md:pl-6 text-navy flex-wrap">
          <div>
            <p className="text-[10px] uppercase font-bold text-muted">Reporting Manager</p>
            <p className="font-semibold text-navy mt-0.5">
              {employee.reporting_manager || 'Management'}
            </p>
          </div>
          {employee.email && (
            <div>
              <p className="text-[10px] uppercase font-bold text-muted">Email</p>
              <p className="font-semibold text-navy mt-0.5 flex items-center gap-1">
                <Mail size={12} className="text-muted" />
                {employee.email}
              </p>
            </div>
          )}
          {employee.phone && (
            <div>
              <p className="text-[10px] uppercase font-bold text-muted">Phone</p>
              <p className="font-semibold text-navy mt-0.5 flex items-center gap-1">
                <Phone size={12} className="text-muted" />
                {employee.phone}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
