import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { and, eq, isNull } from 'drizzle-orm';
import { user } from '@/db/schema';
import { db } from '@/lib/db';
import { companyAllowsAuthentication } from '@/lib/company-lifecycle';
import { recordAuthAuditEvent } from '@/lib/audit-security';

class LoginRateLimiter {
  private requests = new Map<string, { count: number; resetTime: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

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

const loginRateLimiter = new LoginRateLimiter(5, 15 * 60 * 1000);

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  cookies: {
    sessionToken: {
      name: 'zigzag.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            await recordAuthAuditEvent({
              action: 'sign_in_failed',
              result: 'failed',
              reason: 'missing_credentials',
            });
            return null;
          }

          const email = String(credentials.email).trim().toLowerCase();
          const password = String(credentials.password);

          if (!loginRateLimiter.isAllowed(email)) {
            console.warn('[auth][authorize] login throttled', { email });
            await recordAuthAuditEvent({
              action: 'sign_in_failed',
              result: 'failed',
              email,
              reason: 'throttled',
            });
            return null;
          }

          const row = await db.query.user.findFirst({
            where: and(eq(user.email, email), isNull(user.deleted_at)),
            with: {
              company: true,
            },
          });

          if (!row?.password) {
            await recordAuthAuditEvent({
              action: 'sign_in_failed',
              result: 'failed',
              email,
              reason: 'invalid_credentials',
            });
            return null;
          }

          if (
            !row.company ||
            row.company.deleted_at ||
            !companyAllowsAuthentication(row.company.status)
          ) {
            await recordAuthAuditEvent({
              action: 'sign_in_failed',
              result: 'failed',
              email,
              reason: 'inactive_company',
            });
            return null;
          }

          const isPasswordValid = await compare(password, row.password);
          if (!isPasswordValid) {
            await recordAuthAuditEvent({
              action: 'sign_in_failed',
              result: 'failed',
              email,
              reason: 'invalid_credentials',
            });
            return null;
          }

          loginRateLimiter.reset(email);

          return {
            id: String(row.id),
            email: row.email,
            name: row.name,
            company_id: row.company_id ?? undefined,
            company_name: row.company?.name ?? undefined,
            company_is_system: row.company?.is_system ?? false,
          };
        } catch (error) {
          console.error('[auth][authorize] unexpected error', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.company_id = user.company_id;
        token.company_name = user.company_name;
        token.company_is_system = user.company_is_system;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.company_id = token.company_id as number;
        session.user.company_name = token.company_name as string;
        session.user.company_is_system = token.company_is_system as boolean;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (!user?.id) {
        return;
      }
      await recordAuthAuditEvent({
        action: 'signed_in',
        result: 'success',
        actor: {
          userId: user.id,
          companyId: user.company_id ?? null,
          companyIsSystem: Boolean(user.company_is_system),
        },
        targetCompanyId: user.company_id ?? null,
        resourceId: user.id,
        email: user.email ?? null,
      });
    },
    async signOut(message) {
      const token = 'token' in message ? message.token : null;
      const userId = token?.id ?? token?.sub;
      if (!userId) {
        return;
      }
      await recordAuthAuditEvent({
        action: 'signed_out',
        result: 'success',
        actor: {
          userId: String(userId),
          companyId: (token?.company_id as number | undefined) ?? null,
          companyIsSystem: Boolean(token?.company_is_system),
        },
        resourceId: String(userId),
      });
    },
  },
});
