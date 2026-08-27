import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

const handler = NextAuth({
  providers: [
    // 1-Click Instant Demo Login (Zero configuration required)
    CredentialsProvider({
      id: "demo",
      name: "Demo Account",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "demo@example.com" },
      },
      async authorize(credentials) {
        return {
          id: "demo_user_google_id_123",
          name: "Demo User",
          email: credentials?.email || "demo@example.com",
          image: "https://api.dicebear.com/7.x/avataaars/svg?seed=DemoUser",
        };
      },
    }),
    // Real Google OAuth Provider (used when GOOGLE_CLIENT_ID is configured in Google Cloud Console)
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "dummy_google_client_id_dev",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "dummy_google_client_secret_dev",
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET || "super_secret_nextauth_jwt_key_change_me_12345",
  callbacks: {
    async jwt({ token, account, user }) {
      if (account?.id_token) {
        token.idToken = account.id_token;
      } else if (user) {
        // Fallback token for demo authentication incorporating email
        token.idToken = `demo_token_${user.email || "demo@example.com"}`;
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).idToken = token.idToken || "demo_token_demo@example.com";
      return session;
    },
  },
});

export { handler as GET, handler as POST };
