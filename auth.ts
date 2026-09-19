import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password required');
        }

        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: credentials.email },
              { username: credentials.email },
            ],
          },
        });

        if (!user || !user.password) {
          throw new Error('Invalid credentials');
        }

        if (user.status === 'disabled') {
          throw new Error('Account is disabled');
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          throw new Error('Invalid credentials');
        }

        // Log activity
        await prisma.activityLog.create({
          data: {
            userId: user.id,
            action: 'login',
            details: 'User logged in',
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name || user.username,
          image: user.image,
          role: user.role,
          username: user.username,
          balance: user.balance,
        };
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const existing = await prisma.user.findUnique({
          where: { email: user.email! },
        });

        if (!existing) {
          // Create user from Google
          const username = user.email!.split('@')[0] + Math.floor(Math.random() * 1000);
          await prisma.user.create({
            data: {
              email: user.email!,
              username,
              name: user.name,
              image: user.image,
              role: 'user',
              status: 'active',
            },
          });
        }
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.username = (user as any).username;
        token.balance = (user as any).balance;
      }

      if (trigger === 'update' && session) {
        token.balance = session.balance;
        token.name = session.name;
      }

      // Refresh balance from DB
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { balance: true, role: true, status: true },
        });
        if (dbUser) {
          token.balance = Number(dbUser.balance);
          token.role = dbUser.role;
          if (dbUser.status === 'disabled') {
            throw new Error('Account disabled');
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).username = token.username;
        (session.user as any).balance = token.balance;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export async function getCurrentUser() {
  const { getServerSession } = await import('next-auth');
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user as any;
}
