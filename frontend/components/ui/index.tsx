'use client';
import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2, X, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { CustomSelect, CustomSelectOption, CustomSelectProps } from './CustomSelect';
import { DropdownMenu, DropdownMenuItem, DropdownMenuProps } from './DropdownMenu';

// ── Badge ─────────────────────────────────────────────────────────────────────
interface BadgeProps {
  label?: string;
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'outline' | string;
  colorClass?: string;
  className?: string;
  colour?: 'green' | 'red' | 'amber' | 'blue' | 'purple' | 'gray' | string;
}
export function Badge({ label, children, variant, colorClass, className, colour }: BadgeProps) {
  const content = label ? label.replace('_', ' ') : children;
  let variantClass = variant === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : variant === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-200'
    : variant === 'danger' ? 'bg-rose-50 text-rose-700 border-rose-200'
    : variant === 'outline' ? 'bg-transparent text-slate-700 border-slate-300'
    : '';

  if (colour) {
    const colourMap: Record<string, string> = {
      green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      amber: 'bg-amber-50 text-amber-700 border-amber-200',
      red: 'bg-rose-50 text-rose-700 border-rose-200',
      blue: 'bg-blue-50 text-blue-700 border-blue-200',
      purple: 'bg-purple-50 text-purple-700 border-purple-200',
      gray: 'bg-slate-100 text-slate-700 border-slate-200',
    };
    variantClass = colourMap[colour] || colourMap.gray;
  }

  return (
    <span className={cn('badge inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border border-transparent', variantClass, colorClass, className)}>
      {content}
    </span>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}
export function Button({ variant = 'secondary', size = 'md', loading, icon, children, className, disabled, ...props }: ButtonProps) {
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'btn-danger',
    ghost: 'btn-ghost',
  };
  const sizes = {
    xs: 'px-2 py-0.5 text-[11px] font-semibold rounded-md h-7',
    sm: 'px-2.5 py-1 text-xs font-semibold rounded-lg h-8',
    md: 'px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-lg h-9',
    lg: 'px-4 py-2 text-sm font-semibold rounded-lg h-10',
  };
  return (
    <button
      className={cn('btn', variants[variant], sizes[size], (disabled || loading) && 'opacity-60 cursor-not-allowed', className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('animate-spin text-muted', className)} size={20} />;
}

export function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <Spinner className="w-8 h-8" />
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────
interface EmptyStateProps { title: string; description?: string; action?: React.ReactNode; icon?: any; }
export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    if (typeof icon === 'function' || typeof icon === 'object') {
      const IconComp = icon;
      return <IconComp size={36} />;
    }
    return icon;
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="text-muted/40 mb-4">{renderIcon()}</div>}
      <p className="text-sm font-medium text-navy">{title}</p>
      {description && <p className="text-xs text-muted mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────
interface PaginationProps { page: number; totalPages: number; onPage: (p: number) => void; }
export function Pagination({ page, totalPages, onPage }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <button
        onClick={() => onPage(page - 1)} disabled={page <= 1}
        className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-muted hover:text-navy disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronLeft size={13} />
      </button>
      <span className="text-xs text-muted px-1">Page {page} of {totalPages}</span>
      <button
        onClick={() => onPage(page + 1)} disabled={page >= totalPages}
        className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-muted hover:text-navy disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronRight size={13} />
      </button>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
interface ModalProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  subtitle?: string;
}
export function Modal({ open, isOpen, onClose, title, children, width, size, subtitle }: ModalProps) {
  const isVisible = open ?? isOpen ?? false;
  if (!isVisible) return null;

  const sizeClass = size === 'sm'
    ? 'max-w-md'
    : size === 'md'
    ? 'max-w-lg'
    : size === 'lg'
    ? 'max-w-2xl'
    : size === 'xl' || size === '2xl'
    ? 'max-w-4xl'
    : (width || 'max-w-lg');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Dynamic Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Popup Container */}
      <div
        className={cn(
          'relative bg-white rounded-2xl shadow-2xl shadow-slate-900/30 w-full overflow-hidden border border-slate-100 animate-in zoom-in-95 fade-in-0 duration-200 ease-out z-10 max-h-[90vh] flex flex-col',
          sizeClass
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-border/80 bg-gradient-to-r from-slate-50 via-white to-slate-50 shrink-0">
          <div>
            <h2 className="text-base font-bold text-navy tracking-tight">{title}</h2>
            {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-muted hover:text-navy hover:bg-slate-200/70 transition-all cursor-pointer shrink-0 ml-4"
          >
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[82vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string; error?: string; hint?: string;
}
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, name, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || (label ? label.toLowerCase().replace(/[^a-z0-9]/g, '_') : generatedId);
    const inputName = name || inputId;
    return (
      <div className="flex flex-col gap-0">
        {label && <label htmlFor={inputId} className="form-label">{label}</label>}
        <input ref={ref} id={inputId} name={inputName} className={cn('form-input', error && 'border-danger ring-danger/20', className)} {...props} />
        {error && <p className="text-xs text-danger mt-1 flex items-center gap-1"><AlertCircle size={11} />{error}</p>}
        {hint && !error && <p className="text-xs text-muted mt-1">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

// ── Textarea ──────────────────────────────────────────────────────────────────
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string; error?: string;
}
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, name, ...props }, ref) => {
    const generatedId = React.useId();
    const textareaId = id || (label ? label.toLowerCase().replace(/[^a-z0-9]/g, '_') : generatedId);
    const textareaName = name || textareaId;
    return (
      <div className="flex flex-col gap-0">
        {label && <label htmlFor={textareaId} className="form-label">{label}</label>}
        <textarea ref={ref} id={textareaId} name={textareaName} rows={3} className={cn('form-input resize-none', error && 'border-danger', className)} {...props} />
        {error && <p className="text-xs text-danger mt-1">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

// ── Select ────────────────────────────────────────────────────────────────────
export interface SelectProps {
  label?: string;
  error?: string;
  hint?: string;
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
  id?: string;
  name?: string;
  position?: 'auto' | 'bottom' | 'top';
  align?: 'left' | 'right';
  native?: boolean;
  showBadgeInTrigger?: boolean;
}

export const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  (
    {
      label,
      error,
      hint,
      options = [],
      value,
      defaultValue,
      onChange,
      className,
      triggerClassName,
      menuClassName,
      placeholder = 'Select an option',
      size = 'md',
      searchable,
      clearable,
      disabled,
      id,
      name,
      position = 'auto',
      align = 'left',
      native = false,
      ...restProps
    },
    ref
  ) => {
    return (
      <div ref={ref} className={cn(className?.includes('w-') ? className : 'w-full')}>
        <CustomSelect
          label={label}
          error={error}
          hint={hint}
          options={options}
          value={value}
          defaultValue={defaultValue}
          onChange={onChange}
          className={className}
          triggerClassName={triggerClassName}
          menuClassName={menuClassName}
          placeholder={placeholder}
          size={size}
          searchable={searchable}
          clearable={clearable}
          disabled={disabled}
          id={id}
          name={name}
          position={position}
          align={align}
          native={native}
          {...restProps}
        />
      </div>
    );
  }
);
Select.displayName = 'Select';

// ── KPI Card ──────────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: string | number;
  icon?: any;
  trend?: { value: number; label?: string };
  sub?: string;
  subtext?: string;
}
export function KpiCard({ label, value, icon, trend, sub, subtext }: KpiCardProps) {
  const subtitle = sub || subtext;
  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    if (typeof icon === 'function' || typeof icon === 'object') {
      const IconComponent = icon;
      return <IconComponent size={18} />;
    }
    return icon;
  };

  return (
    <div className="kpi-card">
      <div className="flex items-start justify-between">
        <p className="kpi-label">{label}</p>
        {icon && <div className="text-muted/50">{renderIcon()}</div>}
      </div>
      <p className="kpi-value mt-1">{value}</p>
      {(trend || subtitle) && (
        <div className="flex items-center gap-2 mt-1">
          {trend && (
            <span className={trend.value >= 0 ? 'kpi-trend-up' : 'kpi-trend-down'}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%
            </span>
          )}
          {subtitle && <span className="text-xs text-muted">{subtitle}</span>}
        </div>
      )}
    </div>
  );
}

// ── Confirm dialog ────────────────────────────────────────────────────────────
interface ConfirmProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  loading?: boolean;
  confirmText?: string;
  variant?: 'danger' | 'warning' | 'primary';
}
export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  message,
  loading,
  confirmText = 'Confirm',
  variant = 'danger',
}: ConfirmProps) {
  if (!open) return null;
  return (
    <Modal open={open} onClose={onCancel} title={title} width="max-w-md">
      <div className="space-y-4">
        <div className="flex items-start gap-3.5 p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl text-amber-900 text-xs sm:text-sm leading-relaxed">
          <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="font-medium">{message}</p>
        </div>
        <div className="flex gap-2.5 justify-end pt-2 border-t border-border/70">
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="sm"
            loading={loading}
            onClick={onConfirm}
            className="font-bold shadow-md"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export { CustomSelect } from './CustomSelect';
export type { CustomSelectOption, CustomSelectProps } from './CustomSelect';
export { DropdownMenu } from './DropdownMenu';
export type { DropdownMenuItem, DropdownMenuProps } from './DropdownMenu';
