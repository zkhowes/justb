import { NextAuthOptions, getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/admin" },
};

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

/**
 * Returns true if the current session belongs to the admin user.
 */
export async function isAdmin(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return false;
  if (!ADMIN_EMAIL || session.user.email !== ADMIN_EMAIL) return false;
  return true;
}
