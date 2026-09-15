'use client';

import React from 'react';
import { useAuthStore } from '@/lib/auth';

interface PermissionGateProps {
  permission?: string;
  permissions?: string[];
  matchAll?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Declarative component-level permission gate.
 * Renders child elements only if the authenticated user possesses the required permission(s).
 */
export default function PermissionGate({
  permission,
  permissions,
  matchAll = false,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { user } = useAuthStore();

  if (!user) return <>{fallback}</>;

  const role = (user.role || '').toLowerCase().trim();
  const isSuperAdmin =
    role === 'admin' ||
    role === 'super_admin' ||
    role === 'super admin' ||
    user.permissions?.includes('*');

  if (isSuperAdmin) {
    return <>{children}</>;
  }

  const userPerms = user.permissions || [];

  if (permission) {
    const hasPerm = userPerms.includes(permission) || userPerms.some(p => p.startsWith(permission.split(':')[0] + ':*'));
    return hasPerm ? <>{children}</> : <>{fallback}</>;
  }

  if (permissions && permissions.length > 0) {
    const hasPerms = matchAll
      ? permissions.every(p => userPerms.includes(p))
      : permissions.some(p => userPerms.includes(p));
    return hasPerms ? <>{children}</> : <>{fallback}</>;
  }

  return <>{children}</>;
}
