import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { db, usersTable, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, getUser, formatUser } from "../lib/auth";

const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const { email, name, pin } = req.body;
  if (!email || !name || !pin || pin.length !== 4) {
    res.status(400).json({ error: "email, name, and 4-digit pin are required" });
    return;
  }
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }
  const pinHash = await bcrypt.hash(pin, 10);
  const isAdmin = email === "startcopediwznaga@gmail.com";
  const [user] = await db.insert(usersTable).values({ email, name, pinHash, privacy: "public", isAdmin }).returning();
  const token = crypto.randomBytes(32).toString("hex");
  await db.insert(sessionsTable).values({ userId: user.id, token });
  res.status(201).json({ user: formatUser(user), token });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, pin } = req.body;
  if (!email || !pin) {
    res.status(400).json({ error: "email and pin are required" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Invalid email or PIN" });
    return;
  }
  const valid = await bcrypt.compare(pin, user.pinHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or PIN" });
    return;
  }
  const token = crypto.randomBytes(32).toString("hex");
  await db.insert(sessionsTable).values({ userId: user.id, token });
  res.json({ user: formatUser(user), token });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const user = getUser(req);
  res.json(formatUser(user));
});

router.post("/auth/logout", requireAuth, async (req, res): Promise<void> => {
  const header = req.headers.authorization ?? "";
  const token = header.slice(7);
  await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
  res.json({ ok: true });
});

router.post("/auth/change-password", requireAuth, async (req, res): Promise<void> => {
  const user = getUser(req);
  const { currentPin, newPin } = req.body;
  if (!currentPin || !newPin || newPin.length !== 4) {
    res.status(400).json({ error: "currentPin and newPin (4 digits) required" });
    return;
  }
  const valid = await bcrypt.compare(currentPin, user.pinHash);
  if (!valid) {
    res.status(401).json({ error: "Current PIN is incorrect" });
    return;
  }
  const pinHash = await bcrypt.hash(newPin, 10);
  await db.update(usersTable).set({ pinHash }).where(eq(usersTable.id, user.id));
  res.json({ ok: true });
});

export default router;
