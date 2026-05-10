import { z } from 'zod';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { permission, rolePermission, user } from '@/db/schema';
import { db } from './db';
import { AuthorizationError } from './errors';
import { auth } from './auth';
import {
  resolveWritableCompanyId,
  requireSystemUser,
  type ActionAuthContext,
} from './authz-context';
export {
  resolveWritableCompanyId,
  requireSystemUser,
  type ActionAuthContext,
} from './authz-context';

// Input sanitization
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers
}

// Rate limiting helper
export class RateLimiter {
  private requests: Map<string, { count: number; resetTime: number }> =
    new Map();
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(limit: number = 100, windowMs: number = 15 * 60 * 1000) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const record = this.requests.get(identifier);

    if (!record || now > record.resetTime) {
      this.requests.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    if (record.count >= this.limit) {
      return false;
    }

    record.count++;
    return true;
  }

  reset(identifier: string): void {
    this.requests.delete(identifier);
  }
}

// Permission checking
export async function checkPermission(
  userId: string,
  companyId: number,
  permissionName?: string,
): Promise<boolean> {
  try {
    const session = await auth();
    if (!session?.user) {
      throw new AuthorizationError('User not authenticated');
    }

    // For system company users, allow all permissions
    if (session.user.company_is_system) {
      return true;
    }

    // Check if user belongs to the company
    if (session.user.company_id !== companyId) {
      return false;
    }

    const userIdAsBigInt = BigInt(userId);
    const userRow = await db.query.user.findFirst({
      where: and(eq(user.id, userIdAsBigInt), isNull(user.deleted_at)),
    });

    if (!userRow?.role_id) {
      return false;
    }

    if (!permissionName) {
      return true;
    }

    const permissionRows = await db
      .select({ id: permission.id })
      .from(permission)
      .where(
        and(
          eq(permission.name, permissionName),
          isNull(permission.deleted_at),
          or(eq(permission.company_id, companyId), isNull(permission.company_id)),
        ),
      );

    // Backward compatibility while permissions are being seeded/migrated.
    if (permissionRows.length === 0) {
      return true;
    }

    const permitted = await db
      .select({ role_id: rolePermission.role_id })
      .from(rolePermission)
      .where(
        and(
          eq(rolePermission.role_id, userRow.role_id),
          inArray(
            rolePermission.permission_id,
            permissionRows.map((row) => row.id),
          ),
        ),
      )
      .limit(1);

    return permitted.length > 0;
  } catch (error) {
    console.error('Permission check failed:', error);
    return false;
  }
}

// Company access validation
export async function validateCompanyAccess(companyId: number): Promise<void> {
  const session = await auth();

  if (!session?.user) {
    throw new AuthorizationError('Authentication required');
  }

  // System company users can access all companies
  if (session.user.company_is_system) {
    return;
  }

  // Regular users can only access their own company
  if (session.user.company_id !== companyId) {
    throw new AuthorizationError('Access denied to this company');
  }
}

export async function requireActionAuth(): Promise<ActionAuthContext> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new AuthorizationError('Authentication required');
  }

  return {
    userId: session.user.id,
    companyId: session.user.company_id ?? null,
    companyIsSystem: Boolean(session.user.company_is_system),
  };
}

export async function requireActionPermission(
  permissionName: string,
  requestedCompanyId?: number | null,
): Promise<{ context: ActionAuthContext; companyId: number }> {
  const context = await requireActionAuth();
  const companyId = resolveWritableCompanyId(context, requestedCompanyId);
  const allowed = await checkPermission(context.userId, companyId, permissionName);

  if (!allowed) {
    throw new AuthorizationError(`Missing permission: ${permissionName}`);
  }

  return { context, companyId };
}

// Input validation schemas
export const commonSchemas = {
  id: z.number().positive('ID must be a positive number'),
  email: z.string().email('Invalid email format'),
  phone: z.string().regex(/^[\+]?[1-9][\d]{0,15}$/, 'Invalid phone number'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  price: z.number().min(0, 'Price must be non-negative'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
} as const;

// CSRF protection helper
export function generateCSRFToken(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

// SQL injection prevention (basic)
export function sanitizeSQLInput(input: string): string {
  return input.replace(/['";\\]/g, '');
}
