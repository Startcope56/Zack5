import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db, usersTable, postsTable, friendshipsTable } from "@workspace/db";
import { eq, or, and, count, ilike } from "drizzle-orm";
import { requireAuth, getUser, formatUser } from "../lib/auth";
import { uploadsDir } from "../app";

const router: IRouter = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(uploadsDir, { recursive: true });
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.get("/users", requireAuth, async (req, res): Promise<void> => {
  const q = req.query.q as string | undefined;
  if (!q) {
    res.json([]);
    return;
  }
  const users = await db.select().from(usersTable).where(ilike(usersTable.name, `%${q}%`)).limit(20);
  res.json(users.map(formatUser));
});

router.get("/users/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(formatUser(user));
});

router.patch("/users/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const me = getUser(req);
  if (me.id !== id && !me.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  const { name, bio, location, website, privacy } = req.body;
  const update: Record<string, string | null> = {};
  if (name != null) update.name = name;
  if (bio !== undefined) update.bio = bio;
  if (location !== undefined) update.location = location;
  if (website !== undefined) update.website = website;
  if (privacy != null) update.privacy = privacy;
  const [user] = await db.update(usersTable).set(update).where(eq(usersTable.id, id)).returning();
  res.json(formatUser(user));
});

router.post("/users/:id/upload-avatar", requireAuth, upload.single("file"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const me = getUser(req);
  if (me.id !== id && !me.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  if (!req.file) { res.status(400).json({ error: "No file" }); return; }
  const url = `/api/uploads/${req.file.filename}`;
  await db.update(usersTable).set({ profilePicture: url }).where(eq(usersTable.id, id));
  res.json({ url });
});

router.post("/users/:id/upload-cover", requireAuth, upload.single("file"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const me = getUser(req);
  if (me.id !== id && !me.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  if (!req.file) { res.status(400).json({ error: "No file" }); return; }
  const url = `/api/uploads/${req.file.filename}`;
  await db.update(usersTable).set({ coverPicture: url }).where(eq(usersTable.id, id));
  res.json({ url });
});

router.get("/users/:id/stats", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [postCountRow] = await db.select({ c: count() }).from(postsTable).where(eq(postsTable.userId, id));
  const friendCountRow = await db
    .select({ c: count() })
    .from(friendshipsTable)
    .where(and(
      or(eq(friendshipsTable.requesterId, id), eq(friendshipsTable.addresseeId, id)),
      eq(friendshipsTable.status, "accepted")
    ));
  res.json({ friendCount: Number(friendCountRow[0]?.c ?? 0), postCount: Number(postCountRow?.c ?? 0) });
});

export default router;
