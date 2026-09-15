'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface FilterDropdownOption {
  value: string;
  label: string;
  colorDot?: string;
}

interface SmoothFilterDropdownProps {
  value: string;
  onChange: (val: string) => void;
  options: FilterDropdownOption[];
  placeholder?: string;
  className?: string;
  widthClass?: string;
}

export default function SmoothFilterDropdown({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  className = '',
  widthClass = 'w-44',
}: SmoothFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
    placement: 'bottom' | 'top';
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownId = useRef(`filter-${Math.random().toString(36).slice(2, 9)}`).current;

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePlacement = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Minimum menu width: at least trigger width or 180px, capped to viewport
    const width = Math.min(Math.max(rect.width, 180), viewportWidth - 20);

    let left = rect.left;
    if (left + width > viewportWidth - 10) {
      left = viewportWidth - width - 10;
    }
    if (left < 10) {
      left = 10;
    }

    const spaceBelow = viewportHeight - rect.bottom - 10;
    const spaceAbove = rect.top - 10;
    const estimatedHeight = Math.min(options.length * 36 + 16, 260);

    let placement: 'bottom' | 'top' = 'bottom';
    let top: number | undefined = rect.bottom + 6;
    let bottom: number | undefined = undefined;
    let maxHeight = Math.min(260, spaceBelow);

    if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
      placement = 'top';
      top = undefined;
      bottom = viewportHeight - rect.top + 6;
      maxHeight = Math.min(260, spaceAbove);
    }

    setCoords({
      top,
      bottom,
      left,
      width,
      maxHeight: Math.max(120, maxHeight),
      placement,
    });
  }, [options.length]);

  const handleOpen = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('crm:dropdown-open', { detail: { id: dropdownId } }));
    }
    updatePlacement();
    setIsOpen(true);
  };

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePlacement();

    const handleScrollOrResize = () => {
      updatePlacement();
    };

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current?.contains(target) ||
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      handleClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    const handleOtherOpen = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.id !== dropdownId) {
        handleClose();
      }
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('crm:dropdown-open', handleOtherOpen);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('crm:dropdown-open', handleOtherOpen);
    };
  }, [isOpen, updatePlacement, handleClose, dropdownId]);

  const selectedOption = options.find((opt) => opt.value === value);
  const isFiltered = Boolean(value);

  const menuPortalContent = coords ? (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        ...(coords.placement === 'top' ? { bottom: coords.bottom } : { top: coords.top }),
        left: coords.left,
        width: coords.width,
        maxHeight: coords.maxHeight,
        zIndex: 99999,
      }}
      className={`rounded-2xl border border-slate-200/90 bg-white/98 backdrop-blur-xl shadow-2xl shadow-slate-950/20 p-1.5 space-y-0.5 ring-1 ring-slate-900/5 select-none overflow-y-auto custom-scrollbar transition-all duration-200 ${
        coords.placement === 'top' ? 'origin-bottom animate-dropdown-top' : 'origin-top animate-dropdown'
      }`}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value || 'all'}
            type="button"
            onClick={() => {
              onChange(opt.value);
              handleClose();
            }}
            className={`w-full text-left px-3 py-2 text-xs rounded-xl flex items-center justify-between gap-2.5 font-medium transition-all duration-150 ease-out cursor-pointer select-none hover:translate-x-0.5 ${
              isSelected
                ? 'bg-amber-500/10 text-amber-700 font-semibold ring-1 ring-amber-500/20'
                : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2 truncate min-w-0">
              {opt.colorDot && (
                <span className={`w-2 h-2 rounded-full shrink-0 ${opt.colorDot}`} />
              )}
              <span className="truncate">{opt.label}</span>
            </span>
            {isSelected && (
              <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            )}
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <div ref={containerRef} className={`relative ${widthClass} ${className}`}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (isOpen ? handleClose() : handleOpen())}
        className={`w-full h-[38px] flex items-center justify-between gap-2 px-3 text-xs rounded-xl border transition-all duration-200 ease-out cursor-pointer select-none shadow-2xs hover:scale-[1.01] active:scale-95 ${
          isOpen
            ? 'border-amber ring-2 ring-amber/25 bg-amber-500/5 text-navy font-semibold shadow-sm'
            : isFiltered
            ? 'border-amber/60 bg-amber-500/10 text-amber-900 font-semibold'
            : 'border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 hover:border-amber/60 font-medium'
        }`}
      >
        <span className="truncate flex items-center gap-1.5 min-w-0">
          {selectedOption?.colorDot && (
            <span className={`w-2 h-2 rounded-full shrink-0 ${selectedOption.colorDot}`} />
          )}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform duration-200 ease-out ${
            isOpen ? 'rotate-180 text-amber' : ''
          }`}
        />
      </button>

      {/* Floating Portal Menu */}
      {isOpen && mounted && menuPortalContent && typeof document !== 'undefined' && createPortal(menuPortalContent, document.body)}
    </div>
  );
}
