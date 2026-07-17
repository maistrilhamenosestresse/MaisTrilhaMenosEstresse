import NextAuth, { NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      authorization: {
        params: {
          scope: "read:user user:email repo",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Permite e-mails que estão na lista fixa OU na variável de ambiente ADMIN_EMAILS (separados por vírgula)
      const envEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',').map(e => e.trim().toLowerCase()) : [];
      
      if (user.email && envEmails.includes(user.email.toLowerCase())) {
        return true;
      }
      
      console.warn(`Tentativa de login bloqueada para o e-mail não autorizado: ${user.email}`);
      return false; // Bloqueia o acesso
    },
    async jwt({ token, account }) {
      // Persist the OAuth access_token to the token right after signin
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token, user }) {
      // Send properties to the client, like an access_token from a provider.
      (session as any).accessToken = token.accessToken;
      return session;
    },
  },
  pages: {
    signIn: '/gerenciador', // Aponta para a própria página do gerenciador que já tem o botão
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
