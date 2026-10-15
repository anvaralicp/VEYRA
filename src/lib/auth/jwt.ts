import { SignJWT, jwtVerify } from "jose";

// Ensure SESSION_SECRET is set in .env
function getSecretKey() {
  let secretKey = process.env.SESSION_SECRET;

  if (!secretKey) {
    if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
      secretKey = "default_super_secret_key_for_development_only";
    } else {
      throw new Error("SESSION_SECRET is not defined in production environment.");
    }
  }

  return new TextEncoder().encode(secretKey);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getSecretKey());
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function decrypt(input: string): Promise<any> {
  const { payload } = await jwtVerify(input, getSecretKey(), {
    algorithms: ["HS256"],
  });
  return payload;
}
