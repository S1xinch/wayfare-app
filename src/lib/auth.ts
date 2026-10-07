import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET!);

export const hashPw = (p: string) => bcrypt.hash(p, 12);
export const checkPw = (p: string, h: string) => bcrypt.compare(p, h);
// compared when the email is unknown, so a miss costs the same as a wrong password
export const DUMMY_HASH = bcrypt.hashSync("wayfare-dummy-password", 12);

export async function setSession(uid: number) {
  const jwt = await new SignJWT({})
    .setSubject(String(uid))
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .sign(secret());
  (await cookies()).set("s", jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 86400,
  });
}

export const clearSession = async () => (await cookies()).delete("s");

/** Current user id from the session cookie, or null. */
export async function userId() {
  const t = (await cookies()).get("s")?.value;
  if (!t) return null;
  try {
    return Number((await jwtVerify(t, secret())).payload.sub);
  } catch {
    return null;
  }
}
