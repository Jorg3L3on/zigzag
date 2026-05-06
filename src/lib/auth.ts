import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { and, eq, isNull } from 'drizzle-orm';
import { company, user } from '@/db/schema';
import { db } from '@/lib/db';

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
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
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;

        const row = await db.query.user.findFirst({
          where: and(eq(user.email, email), isNull(user.deleted_at)),
          with: {
            company: true,
          },
        });

        if (!row) {
          return null;
        }

        const isPasswordValid = await compare(
          credentials.password as string,
          row.password,
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: String(row.id),
          email: row.email,
          name: row.name,
          company_id: row.company_id ?? undefined,
          company_name: row.company?.name ?? undefined,
          company_is_system: row.company?.is_system ?? false,
        };
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
});
