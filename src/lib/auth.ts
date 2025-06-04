import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
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

        const user = await db.user.findUnique({
          where: {
            email: credentials.email as string,
          },
          include: {
            company: true,
          },
        });

        if (!user) {
          return null;
        }

        const isPasswordValid = await compare(
          credentials.password as string,
          user.password,
        );

        if (!isPasswordValid) {
          return null;
        }

        console.log('Authorized user:', {
          id: String(user.id),
          email: user.email,
          name: user.name,
          company_id: user.company_id,
          company: user.company,
        });

        return {
          id: String(user.id),
          email: user.email,
          name: user.name,
          company_id: user.company_id ?? undefined,
          company_name: user.company?.name ?? undefined,
          company_is_system: user.company?.is_system ?? false,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        console.log('JWT Callback - User:', user);
        token.id = user.id;
        token.company_id = user.company_id;
        token.company_name = user.company_name;
        token.company_is_system = user.company_is_system;
      }
      console.log('JWT Callback - Token:', token);
      return token;
    },
    async session({ session, token }) {
      if (token) {
        console.log('Session Callback - Token:', token);
        session.user.id = token.id as string;
        session.user.company_id = token.company_id as number;
        session.user.company_name = token.company_name as string;
        session.user.company_is_system = token.company_is_system as boolean;
      }
      console.log('Session Callback - Session:', session);
      return session;
    },
  },
});
