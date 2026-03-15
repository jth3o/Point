import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import { getAuthMongoClient } from "@/lib/mongodb-auth";

const fromEmail = process.env.AUTH_FROM_EMAIL ?? "onboarding@resend.dev";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  adapter: MongoDBAdapter(getAuthMongoClient()),
  providers: [
    Resend({
      from: fromEmail,
    }),
  ],
  session: { strategy: "database", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/" },
  callbacks: {
    session: async ({ session, user }) => {
      if (session?.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});
