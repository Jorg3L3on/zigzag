import { z } from 'zod';
import { AuthorizationError } from './errors';
import { auth } from './auth';

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
): Promise<boolean> {
  try {
    const user = await auth();
    if (!user?.user) {
      throw new AuthorizationError('User not authenticated');
    }

    // For system company users, allow all permissions
    if (user.user.company_is_system) {
      return true;
    }

    // Check if user belongs to the company
    if (user.user.company_id !== companyId) {
      return false;
    }

    // TODO: Implement role-based permission checking
    // This would involve checking the user's role and its associated permissions
    return true;
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
