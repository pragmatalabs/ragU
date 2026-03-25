import { Hono } from "hono";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import { signJwt, verifyJwt } from "../middleware/auth";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || "";

export const authRoutes = new Hono();

authRoutes.post("/login", async (c) => {
  const { username, password } = await c.req.json();

  if (!username || !password) {
    return c.json({ error: "Username and password required" }, 400);
  }

  if (username !== ADMIN_USERNAME) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  // Verify password with bcrypt (Bun built-in)
  let valid = false;
  if (ADMIN_PASSWORD_HASH) {
    valid = await Bun.password.verify(password, ADMIN_PASSWORD_HASH);
  } else {
    // Fallback for dev: plain text comparison against ADMIN_PASSWORD env
    const plainPassword = process.env.ADMIN_PASSWORD || "admin";
    valid = password === plainPassword;
  }

  if (!valid) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const token = await signJwt({
    sub: "admin",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400, // 24 hours
  });

  setCookie(c, "ragu_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    path: "/",
    maxAge: 86400,
  });

  return c.json({ ok: true });
});

authRoutes.post("/logout", async (c) => {
  deleteCookie(c, "ragu_session", { path: "/" });
  return c.json({ ok: true });
});

authRoutes.get("/me", async (c) => {
  const token = getCookie(c, "ragu_session");
  if (!token) return c.json({ error: "Not authenticated" }, 401);

  const payload = await verifyJwt(token);
  if (!payload || payload.sub !== "admin") {
    return c.json({ error: "Not authenticated" }, 401);
  }

  return c.json({ authenticated: true, username: ADMIN_USERNAME });
});
