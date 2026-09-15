'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Search, ChevronDown, User, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmployeeItem {
  id: string;
  user_id?: string;
  employee_code: string;
  full_name: string;
  department: string;
  designation: string;
  role: string;
  status: string;
  avatar_url?: string;
}

interface EmployeeSelectorProps {
  employees: EmployeeItem[];
  selectedEmployee: EmployeeItem | null;
  onSelectEmployee: (emp: EmployeeItem) => void;
  includeInactive: boolean;
  onToggleIncludeInactive: (val: boolean) => void;
  isLoading?: boolean;
}

export default function EmployeeSelector({
  employees,
  selectedEmployee,
  onSelectEmployee,
  includeInactive,
  onToggleIncludeInactive,
  isLoading = false,
}: EmployeeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = employees.filter((emp) => {
    const query = search.toLowerCase();
    return (
      emp.full_name.toLowerCase().includes(query) ||
      emp.employee_code.toLowerCase().includes(query) ||
      emp.department.toLowerCase().includes(query) ||
      emp.designation.toLowerCase().includes(query)
    );
  });

  const grouped = filtered.reduce((acc, emp) => {
    const dept = emp.department || 'Other';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(emp);
    return acc;
  }, {} as Record<string, EmployeeItem[]>);

  return (
    <div className="relative w-full max-w-md" ref={dropdownRef}>
      <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">
        Select Employee to Audit
      </label>

      {/* Selector Box */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={cn(
          'w-full flex items-center justify-between px-3.5 py-2 bg-white border border-border rounded-lg shadow-xs hover:border-amber focus:outline-none focus:ring-2 focus:ring-amber/30 transition-all text-left',
          isLoading && 'opacity-60 cursor-not-allowed'
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {selectedEmployee?.avatar_url ? (
            <Image
              src={selectedEmployee.avatar_url}
              alt={selectedEmployee.full_name}
              width={28}
              height={28}
              className="w-7 h-7 rounded-full object-cover border border-amber/30 flex-shrink-0"
              unoptimized
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-navy/10 text-navy font-bold flex items-center justify-center flex-shrink-0 text-xs">
              {selectedEmployee?.full_name?.charAt(0) || <User size={14} />}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-semibold text-navy truncate">
              {selectedEmployee ? selectedEmployee.full_name : 'Select Employee...'}
            </p>
            {selectedEmployee && (
              <p className="text-[11px] text-muted truncate">
                {selectedEmployee.designation} • {selectedEmployee.employee_code}
              </p>
            )}
          </div>
        </div>
        <ChevronDown size={16} className="text-muted flex-shrink-0 ml-2" />
      </button>

      {/* Dropdown List */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 z-50 bg-white border border-border rounded-xl shadow-card overflow-hidden max-h-96 flex flex-col animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="p-3 border-b border-border bg-surface/50 space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-muted" />
              <input
                type="text"
                placeholder="Search name, ID, department..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-amber text-navy"
                autoFocus
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-muted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => onToggleIncludeInactive(e.target.checked)}
                className="rounded text-amber focus:ring-amber h-3.5 w-3.5"
              />
              <span>Include inactive employees</span>
            </label>
          </div>

          <div className="flex-1 overflow-y-auto p-1 divide-y divide-border">
            {Object.keys(grouped).length === 0 ? (
              <div className="p-4 text-center text-xs text-muted">No employees found.</div>
            ) : (
              Object.entries(grouped).map(([dept, list]) => (
                <div key={dept} className="py-1">
                  <div className="px-3 py-1 text-[10px] font-bold text-amber tracking-wider uppercase bg-amber/10 rounded-xs">
                    {dept} ({list.length})
                  </div>
                  {list.map((emp) => {
                    const isSelected = selectedEmployee?.id === emp.id;
                    const isInactive = emp.status !== 'active';
                    return (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => {
                          onSelectEmployee(emp);
                          setIsOpen(false);
                        }}
                        className={cn(
                          'w-full flex items-center justify-between px-3 py-2 text-left rounded-md transition-colors text-xs',
                          isSelected
                            ? 'bg-amber/15 text-navy font-semibold'
                            : 'hover:bg-surface text-navy',
                          isInactive && 'opacity-60'
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-navy/10 text-navy font-bold flex items-center justify-center text-[10px] flex-shrink-0">
                            {emp.full_name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{emp.full_name}</p>
                            <p className="text-[10px] text-muted truncate">
                              {emp.designation} • {emp.employee_code}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {isInactive && (
                            <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-gray-200 text-muted rounded">
                              Inactive
                            </span>
                          )}
                          {isSelected && <Check size={14} className="text-amber" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
