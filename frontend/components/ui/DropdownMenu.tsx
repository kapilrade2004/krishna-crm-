'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, MoreHorizontal, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DropdownMenuItem {
  key?: string;
  label?: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'default' | 'danger' | 'warning' | 'success';
  badge?: string;
  divider?: boolean;
  className?: string;
}

export interface DropdownMenuProps {
  trigger?: React.ReactNode;
  triggerType?: 'button' | 'icon' | 'dots' | 'vertical-dots' | 'custom';
  triggerLabel?: string;
  triggerClassName?: string;
  items: DropdownMenuItem[];
  align?: 'left' | 'right';
  className?: string;
  menuClassName?: string;
  size?: 'sm' | 'md' | 'lg';
  width?: number;
}

export function DropdownMenu({
  trigger,
  triggerType = 'dots',
  triggerLabel,
  triggerClassName,
  items,
  align = 'right',
  className,
  menuClassName,
  size = 'md',
  width: customWidth,
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    placement: 'bottom' | 'top';
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useRef(`dd-${Math.random().toString(36).slice(2, 9)}`).current;

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePlacement = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const width = customWidth || 200;
    let left = align === 'right' ? rect.right - width : rect.left;
    if (left + width > viewportWidth - 10) {
      left = viewportWidth - width - 10;
    }
    if (left < 10) {
      left = 10;
    }

    const spaceBelow = viewportHeight - rect.bottom - 10;
    const spaceAbove = rect.top - 10;
    const estimatedHeight = Math.min(items.length * 38 + 24, 340);

    let placement: 'bottom' | 'top' = 'bottom';
    let top: number | undefined = rect.bottom + 6;
    let bottom: number | undefined = undefined;

    if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
      placement = 'top';
      top = undefined;
      bottom = viewportHeight - rect.top + 6;
    }

    setCoords({
      top,
      bottom,
      left,
      width,
      placement,
    });
  }, [align, customWidth, items.length]);

  const handleOpen = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('crm:dropdown-open', { detail: { id: menuId } }));
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

    const handleOtherOpen = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.id !== menuId) {
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
  }, [isOpen, updatePlacement, handleClose, menuId]);

  const defaultTriggers = {
    dots: (
      <button
        ref={triggerRef as React.RefObject<HTMLButtonElement>}
        type="button"
        onClick={() => (isOpen ? handleClose() : handleOpen())}
        className={cn(
          'w-8 h-8 rounded-lg border border-border/80 bg-white flex items-center justify-center text-muted hover:text-navy hover:border-amber/80 hover:bg-slate-50/80 shadow-2xs transition-all duration-200 ease-out hover:scale-[1.03] active:scale-95 cursor-pointer',
          isOpen && 'border-amber ring-2 ring-amber/25 bg-amber/5 text-navy scale-[1.03]',
          triggerClassName
        )}
        title="More options"
      >
        <MoreHorizontal size={15} />
      </button>
    ),
    'vertical-dots': (
      <button
        ref={triggerRef as React.RefObject<HTMLButtonElement>}
        type="button"
        onClick={() => (isOpen ? handleClose() : handleOpen())}
        className={cn(
          'w-8 h-8 rounded-lg border border-border/80 bg-white flex items-center justify-center text-muted hover:text-navy hover:border-amber/80 hover:bg-slate-50/80 shadow-2xs transition-all duration-200 ease-out hover:scale-[1.03] active:scale-95 cursor-pointer',
          isOpen && 'border-amber ring-2 ring-amber/25 bg-amber/5 text-navy scale-[1.03]',
          triggerClassName
        )}
        title="More options"
      >
        <MoreVertical size={15} />
      </button>
    ),
    button: (
      <button
        ref={triggerRef as React.RefObject<HTMLButtonElement>}
        type="button"
        onClick={() => (isOpen ? handleClose() : handleOpen())}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/80 bg-white text-xs font-semibold text-navy hover:border-amber/80 hover:bg-slate-50/80 shadow-2xs transition-all duration-200 ease-out hover:scale-[1.02] active:scale-95 cursor-pointer',
          isOpen && 'border-amber ring-2 ring-amber/25 bg-amber/5 scale-[1.02]',
          triggerClassName
        )}
      >
        <span>{triggerLabel || 'Options'}</span>
        <ChevronDown size={13} className={cn('text-muted transition-transform duration-200 ease-out', isOpen && 'rotate-180 text-amber')} />
      </button>
    ),
    icon: trigger,
    custom: trigger,
  };

  const renderTrigger = () => {
    if (trigger && triggerType === 'custom') {
      return (
        <div
          ref={triggerRef as React.RefObject<HTMLDivElement>}
          onClick={(e) => {
            e.stopPropagation();
            isOpen ? handleClose() : handleOpen();
          }}
          className="cursor-pointer transition-transform duration-150 active:scale-95"
        >
          {trigger}
        </div>
      );
    }
    return defaultTriggers[triggerType] || defaultTriggers.dots;
  };

  const menuPortalContent = coords ? (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        ...(coords.placement === 'top' ? { bottom: coords.bottom } : { top: coords.top }),
        left: coords.left,
        width: coords.width,
        zIndex: 99999,
      }}
      className={cn(
        'rounded-2xl border border-slate-200/90 bg-white/98 backdrop-blur-xl shadow-2xl shadow-slate-950/20 p-1.5 space-y-0.5 ring-1 ring-slate-900/5 select-none transition-all duration-200 max-h-[min(380px,calc(100vh-24px))] overflow-y-auto',
        coords.placement === 'top' ? 'origin-bottom animate-dropdown-top' : 'origin-top animate-dropdown',
        menuClassName
      )}
    >
      {items.map((item, index) => {
        if (item.divider) {
          return <div key={`div-${index}`} className="h-px bg-slate-100 my-1 mx-1" />;
        }

        const variantClasses = {
          default: 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900',
          danger: 'text-rose-600 hover:bg-rose-50/90 hover:text-rose-700',
          warning: 'text-amber-700 hover:bg-amber-50/90 hover:text-amber-800',
          success: 'text-emerald-700 hover:bg-emerald-50/90 hover:text-emerald-800',
        };

        return (
          <button
            key={item.key || index}
            type="button"
            disabled={item.disabled}
            onClick={(e) => {
              e.stopPropagation();
              if (!item.disabled && item.onClick) {
                item.onClick();
                setIsOpen(false);
              }
            }}
            className={cn(
              'w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-150 ease-out select-none text-left hover:translate-x-0.5',
              variantClasses[item.variant || 'default'],
              item.disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
              item.className
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              {item.icon && <span className="shrink-0 text-current">{item.icon}</span>}
              <span className="truncate">{item.label}</span>
            </div>

            {item.badge && (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 shrink-0">
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <div className={cn('relative inline-block text-left', className)} ref={containerRef}>
      {renderTrigger()}
      {isOpen && mounted && menuPortalContent && typeof document !== 'undefined' && createPortal(menuPortalContent, document.body)}
    </div>
  );
}

export default DropdownMenu;
