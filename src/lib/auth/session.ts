import { cache } from "react";
import { cookies } from "next/headers";
import { decrypt } from "./jwt";

export interface UserSession {
  userId: string;
  email: string;
}

export const getSession = cache(async (): Promise<UserSession | null> => {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    return null;
  }

  try {
    const payload = await decrypt(sessionCookie);
    if (!payload || !payload.userId) {
      return null;
    }

    return {
      userId: payload.userId as string,
      email: payload.email as string,
    };
  } catch {
    // Token is invalid or expired
    return null;
  }
});
