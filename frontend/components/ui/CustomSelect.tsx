'use client';
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CustomSelectOption {
  value: string;
  label: string;
  group?: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: string;
  badgeColor?: string;
  disabled?: boolean;
}

export interface CustomSelectProps {
  label?: string;
  options: (CustomSelectOption | { value: string; label: string; [key: string]: any })[];
  value?: string;
  defaultValue?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
  searchable?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  error?: string;
  hint?: string;
  name?: string;
  id?: string;
  position?: 'auto' | 'bottom' | 'top';
  align?: 'left' | 'right';
  native?: boolean;
  showBadgeInTrigger?: boolean;
}

export function CustomSelect({
  label,
  options = [],
  value: controlledValue,
  defaultValue = '',
  onChange,
  className,
  triggerClassName,
  menuClassName,
  placeholder = 'Select an option',
  size = 'md',
  searchable = false,
  clearable = false,
  disabled = false,
  error,
  hint,
  name,
  id,
  position = 'auto',
  align = 'left',
  native = false,
  showBadgeInTrigger = false,
}: CustomSelectProps) {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selectedValue = isControlled ? controlledValue : internalValue;

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const generatedId = React.useId();
  const selectId = id || (label ? label.toLowerCase().replace(/[^a-z0-9]/g, '_') : generatedId);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Global listener: ensure only one dropdown is open at any time
  useEffect(() => {
    const handleOtherOpen = () => {
      setIsOpen(false);
    };
    window.addEventListener('crm:dropdown-open', handleOtherOpen);
    return () => {
      window.removeEventListener('crm:dropdown-open', handleOtherOpen);
    };
  }, []);

  // Normalize options
  const normalizedOptions: CustomSelectOption[] = useMemo(() => {
    return options.map((opt) => ({
      value: String(opt.value),
      label: opt.label !== undefined ? String(opt.label) : String(opt.value),
      group: opt.group,
      description: opt.description,
      icon: opt.icon,
      badge: opt.badge,
      badgeColor: opt.badgeColor,
      disabled: opt.disabled,
    }));
  }, [options]);

  const selectedOption = useMemo(() => {
    return normalizedOptions.find((opt) => opt.value === selectedValue) || null;
  }, [normalizedOptions, selectedValue]);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return normalizedOptions;
    const q = searchQuery.toLowerCase().trim();
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.description && opt.description.toLowerCase().includes(q)) ||
        (opt.group && opt.group.toLowerCase().includes(q))
    );
  }, [normalizedOptions, searchQuery]);

  // Precise fixed coordinate calculation relative to viewport
  const updatePlacement = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Adaptive width: compact for sm, standard for md/lg, never smaller than trigger
    const defaultMinWidth = size === 'sm' ? 140 : 180;
    const minMenuWidth = Math.max(rect.width, defaultMinWidth);
    const width = Math.min(minMenuWidth, viewportWidth - 20);

    // Horizontal positioning
    let left = align === 'right' ? rect.right - width : rect.left;
    if (left + width > viewportWidth - 10) {
      left = viewportWidth - width - 10;
    }
    if (left < 10) {
      left = 10;
    }

    const spaceBelow = viewportHeight - rect.bottom - 10;
    const spaceAbove = rect.top - 10;

    let placement: 'bottom' | 'top' = 'bottom';
    let top: number | undefined = rect.bottom + 6;
    let bottom: number | undefined = undefined;
    let maxHeight = Math.min(290, spaceBelow);

    if (position === 'top' || (position === 'auto' && spaceBelow < 200 && spaceAbove > spaceBelow)) {
      placement = 'top';
      maxHeight = Math.min(290, spaceAbove);
      top = undefined;
      bottom = viewportHeight - rect.top + 6;
    }

    setCoords({
      top,
      bottom,
      left,
      width,
      maxHeight: Math.max(120, maxHeight),
      placement,
    });
  }, [align, position, size]);

  // Handle open / close transitions
  const handleOpen = () => {
    if (disabled) return;
    // Broadcast close event to any other open dropdown
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('crm:dropdown-open', { detail: { id: selectId } }));
    }
    updatePlacement();
    setIsOpen(true);
    setSearchQuery('');
    const idx = filteredOptions.findIndex((opt) => opt.value === selectedValue);
    setHighlightedIndex(idx >= 0 ? idx : 0);
  };

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
    setHighlightedIndex(-1);
  }, []);

  // Update placement and attach listeners for scroll, resize, click outside, and mutual exclusion
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
        listRef.current?.contains(target)
      ) {
        return;
      }
      handleClose();
    };

    const handleOtherOpen = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.id !== selectId) {
        handleClose();
      }
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('crm:dropdown-open', handleOtherOpen);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('crm:dropdown-open', handleOtherOpen);
    };
  }, [isOpen, updatePlacement, handleClose, selectId]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && (searchable || normalizedOptions.length > 7)) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, searchable, normalizedOptions.length]);

  // Auto-scroll highlighted option into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`) as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Fire change handler
  const handleSelect = (val: string) => {
    if (!isControlled) {
      setInternalValue(val);
    }
    if (onChange) {
      try {
        (onChange as any)({ target: { value: val, name: name || selectId } });
      } catch {
        (onChange as any)(val);
      }
    }
    handleClose();
    triggerRef.current?.focus();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleSelect('');
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleOpen();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const next = prev < filteredOptions.length - 1 ? prev + 1 : 0;
          return next;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : filteredOptions.length - 1;
          return next;
        });
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          const opt = filteredOptions[highlightedIndex];
          if (!opt.disabled) {
            handleSelect(opt.value);
          }
        }
        break;
      case 'Escape':
        e.preventDefault();
        handleClose();
        triggerRef.current?.focus();
        break;
      case 'Tab':
        handleClose();
        break;
      case 'Home':
        e.preventDefault();
        setHighlightedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setHighlightedIndex(filteredOptions.length - 1);
        break;
    }
  };

  // If native is requested, render styled native select
  if (native) {
    return (
      <div className={cn('flex flex-col gap-1 w-full', className)}>
        {label && (
          <label htmlFor={selectId} className="form-label text-xs font-semibold text-navy">
            {label}
          </label>
        )}
        <select
          id={selectId}
          name={name || selectId}
          disabled={disabled}
          value={selectedValue}
          onChange={(e) => {
            if (!isControlled) setInternalValue(e.target.value);
            if (onChange) (onChange as any)(e);
          }}
          className={cn(
            'form-select w-full border border-border rounded-xl bg-white text-navy font-medium transition-all duration-200 ease-out focus:outline-none focus:border-amber focus:ring-3 focus:ring-amber/20 cursor-pointer shadow-2xs',
            size === 'sm' && 'py-1.5 px-3 text-xs min-h-[34px]',
            size === 'md' && 'py-2 px-3.5 text-xs sm:text-sm min-h-[38px]',
            size === 'lg' && 'py-2.5 px-4 text-sm min-h-[44px]',
            error && 'border-danger focus:border-danger focus:ring-danger/20',
            disabled && 'opacity-50 cursor-not-allowed bg-slate-50',
            triggerClassName
          )}
        >
          {placeholder && !selectedValue && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {normalizedOptions.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="text-xs text-danger mt-1 flex items-center gap-1">
            <AlertCircle size={11} />
            {error}
          </p>
        )}
        {hint && !error && <p className="text-xs text-muted mt-1">{hint}</p>}
      </div>
    );
  }

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs rounded-xl min-h-[36px]',
    md: 'px-3.5 py-2 text-xs sm:text-sm rounded-xl min-h-[38px]',
    lg: 'px-4 py-2.5 text-sm rounded-xl min-h-[44px]',
  };

  const showSearch = searchable || normalizedOptions.length > 7;

  // Dropdown Floating Menu Portal Element
  const menuPortalContent = coords ? (
    <div
      ref={listRef}
      role="listbox"
      id={`${selectId}-listbox`}
      aria-label={label || placeholder}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        ...(coords.placement === 'top' ? { bottom: coords.bottom } : { top: coords.top }),
        left: coords.left,
        width: coords.width,
        maxHeight: coords.maxHeight,
        zIndex: 99999,
      }}
      className={cn(
        'rounded-2xl border border-slate-200/90 bg-white/98 backdrop-blur-xl shadow-2xl shadow-slate-950/20 p-1.5 space-y-1 overflow-y-auto ring-1 ring-slate-900/5 select-none custom-scrollbar transition-all duration-200',
        coords.placement === 'top' ? 'origin-bottom animate-dropdown-top' : 'origin-top animate-dropdown',
        menuClassName
      )}
    >
      {/* Search Header */}
      {showSearch && (
        <div className="p-1 sticky top-0 bg-white/95 backdrop-blur-md z-10 border-b border-border/70 pb-1.5 mb-1">
          <div className="relative flex items-center">
            <Search size={13} className="absolute left-2.5 text-muted pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Type to filter..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-border bg-slate-50/80 text-navy placeholder:text-muted focus:outline-none focus:border-amber focus:ring-2 focus:ring-amber/20 transition-all font-normal"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2 text-muted hover:text-navy p-0.5"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Options List */}
      <div className="space-y-0.5">
        {filteredOptions.length === 0 ? (
          <div className="py-6 px-3 text-center text-xs text-muted">
            <p className="font-semibold text-slate-700">No options found</p>
            <p className="text-[11px] text-muted mt-0.5">Try searching with a different term</p>
          </div>
        ) : (
          filteredOptions.map((opt, idx) => {
            const isSelected = opt.value === selectedValue;
            const isHighlighted = idx === highlightedIndex;

            return (
              <div
                key={`${opt.value}-${idx}`}
                data-index={idx}
                role="option"
                aria-selected={isSelected}
                aria-disabled={opt.disabled}
                onClick={() => {
                  if (!opt.disabled) handleSelect(opt.value);
                }}
                onMouseEnter={() => {
                  if (!opt.disabled) setHighlightedIndex(idx);
                }}
                className={cn(
                  'w-full flex items-center justify-between gap-2.5 px-3 py-2 text-xs rounded-xl transition-all duration-150 select-none cursor-pointer',
                  opt.disabled && 'opacity-40 cursor-not-allowed bg-transparent text-muted',
                  !opt.disabled && (
                    isSelected
                      ? 'bg-gradient-to-r from-amber-50 to-amber-100/50 font-bold text-navy shadow-xs border border-amber-200/80 translate-x-0.5'
                      : isHighlighted
                      ? 'bg-slate-100/90 text-navy font-semibold translate-x-0.5'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-navy hover:translate-x-0.5'
                  )
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {opt.icon && (
                    <div
                      className={cn(
                        'w-5 h-5 rounded-md flex items-center justify-center shrink-0 shadow-2xs',
                        opt.badgeColor || 'bg-amber-100 text-amber-800'
                      )}
                    >
                      {opt.icon}
                    </div>
                  )}

                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="truncate leading-tight">{opt.label}</span>
                    {opt.description && (
                      <span className="text-[10px] text-muted truncate font-normal leading-tight">
                        {opt.description}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {opt.badge && (
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded-md text-[10px] font-bold',
                        opt.badgeColor || 'bg-slate-100 text-slate-700'
                      )}
                    >
                      {opt.badge}
                    </span>
                  )}
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-amber text-navy flex items-center justify-center shadow-xs shrink-0 ring-2 ring-amber/30">
                      <Check size={11} strokeWidth={3} />
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className={cn('relative flex flex-col gap-1 w-full text-left', className)} ref={containerRef}>
      {/* Hidden input for standard form compliance */}
      {name && <input type="hidden" name={name} value={selectedValue || ''} />}

      {/* Label */}
      {label && (
        <label
          htmlFor={selectId}
          onClick={() => triggerRef.current?.focus()}
          className="form-label text-xs font-semibold text-navy cursor-pointer select-none mb-0.5"
        >
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        id={selectId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => (isOpen ? handleClose() : handleOpen())}
        onKeyDown={handleKeyDown}
        className={cn(
          'w-full flex items-center justify-between gap-2 border text-left transition-all duration-220 ease-out cursor-pointer select-none bg-white shadow-2xs group',
          sizeClasses[size],
          disabled && 'opacity-50 cursor-not-allowed bg-slate-50 hover:border-border',
          error && 'border-danger focus:border-danger focus:ring-danger/20',
          !error && (
            isOpen
              ? 'border-amber ring-3 ring-amber/25 shadow-md shadow-amber-500/15 bg-white scale-[1.005]'
              : 'border-border hover:border-amber/80 hover:bg-slate-50/70 hover:shadow-xs hover:scale-[1.002] focus-visible:outline-none focus-visible:border-amber focus-visible:ring-3 focus-visible:ring-amber/20'
          ),
          triggerClassName
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {selectedOption?.icon && (
            <div
              className={cn(
                'w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors shadow-2xs',
                selectedOption.badgeColor || 'bg-amber-100 text-amber-800'
              )}
            >
              {selectedOption.icon}
            </div>
          )}

          <div className="flex flex-col min-w-0 flex-1">
            {selectedOption ? (
              <span className="font-semibold text-navy truncate tracking-tight text-xs sm:text-sm">
                {selectedOption.label}
              </span>
            ) : (
              <span className="text-muted font-normal truncate text-xs sm:text-sm">{placeholder}</span>
            )}
            {selectedOption?.description && (
              <span className="text-[10px] text-muted truncate font-normal leading-tight">
                {selectedOption.description}
              </span>
            )}
          </div>

          {showBadgeInTrigger && selectedOption?.badge && (
            <span
              className={cn(
                'px-1.5 py-0.5 rounded-md text-[10px] font-bold shrink-0',
                selectedOption.badgeColor || 'bg-slate-100 text-slate-700'
              )}
            >
              {selectedOption.badge}
            </span>
          )}
        </div>

        {/* Right Action Icons */}
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {clearable && selectedValue && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={handleClear}
              className="p-1 rounded-full text-muted hover:text-navy hover:bg-slate-200/80 transition-colors"
              title="Clear selection"
            >
              <X size={12} strokeWidth={2.5} />
            </span>
          )}

          <div
            className={cn(
              'w-5 h-5 rounded-md flex items-center justify-center text-muted group-hover:text-amber transition-transform duration-200 ease-out',
              isOpen && 'rotate-180 text-amber'
            )}
          >
            <ChevronDown size={14} strokeWidth={2.2} />
          </div>
        </div>
      </button>

      {/* Error and Hint Messages */}
      {error && (
        <p className="text-xs text-danger mt-1 flex items-center gap-1 font-medium">
          <AlertCircle size={11} className="shrink-0" />
          {error}
        </p>
      )}
      {hint && !error && <p className="text-xs text-muted mt-1 font-normal">{hint}</p>}

      {/* Render Portal directly to document.body so it is NEVER clipped by tables, cards, or overflow containers */}
      {isOpen && mounted && menuPortalContent && typeof document !== 'undefined' && createPortal(menuPortalContent, document.body)}
    </div>
  );
}

export default CustomSelect;
