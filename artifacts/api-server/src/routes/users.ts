import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db, usersTable, postsTable, friendshipsTable, followsTable, notificationsTable } from "@workspace/db";
import { eq, or, and, count, ilike, desc } from "drizzle-orm";
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
    const users = await db.select().from(usersTable).where(eq(usersTable.isBlueAI, false)).limit(50);
    res.json(users.map(formatUser));
    return;
  }
  const users = await db.select().from(usersTable).where(and(ilike(usersTable.name, `%${q}%`), eq(usersTable.isBlueAI, false))).limit(20);
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
  const [updated] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  res.json(formatUser(updated));
});

router.post("/users/:id/upload-cover", requireAuth, upload.single("file"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const me = getUser(req);
  if (me.id !== id && !me.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  if (!req.file) { res.status(400).json({ error: "No file" }); return; }
  const url = `/api/uploads/${req.file.filename}`;
  await db.update(usersTable).set({ coverPicture: url }).where(eq(usersTable.id, id));
  const [updated] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  res.json(formatUser(updated));
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
  const [followerCount] = await db.select({ c: count() }).from(followsTable).where(eq(followsTable.followingId, id));
  const [followingCount] = await db.select({ c: count() }).from(followsTable).where(eq(followsTable.followerId, id));
  res.json({
    friendCount: Number(friendCountRow[0]?.c ?? 0),
    postCount: Number(postCountRow?.c ?? 0),
    followerCount: Number(followerCount?.c ?? 0),
    followingCount: Number(followingCount?.c ?? 0),
  });
});

// --- FOLLOW SYSTEM ---
router.post("/users/:id/follow", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const targetId = parseInt(raw, 10);
  const me = getUser(req);
  if (me.id === targetId) { res.status(400).json({ error: "Cannot follow yourself" }); return; }
  try {
    await db.insert(followsTable).values({ followerId: me.id, followingId: targetId }).onConflictDoNothing();
    // Notify the followed user
    await db.insert(notificationsTable).values({
      userId: targetId,
      type: "follow",
      fromUserId: me.id,
      message: "started following you",
    });
    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
});

router.delete("/users/:id/follow", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const targetId = parseInt(raw, 10);
  const me = getUser(req);
  await db.delete(followsTable).where(and(eq(followsTable.followerId, me.id), eq(followsTable.followingId, targetId)));
  res.json({ ok: true });
});

router.get("/users/:id/follow-status", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const targetId = parseInt(raw, 10);
  const me = getUser(req);
  const [existing] = await db.select().from(followsTable)
    .where(and(eq(followsTable.followerId, me.id), eq(followsTable.followingId, targetId))).limit(1);
  const [followerCount] = await db.select({ c: count() }).from(followsTable).where(eq(followsTable.followingId, targetId));
  const [followingCount] = await db.select({ c: count() }).from(followsTable).where(eq(followsTable.followerId, targetId));
  res.json({
    isFollowing: !!existing,
    followerCount: Number(followerCount?.c ?? 0),
    followingCount: Number(followingCount?.c ?? 0),
  });
});

router.get("/users/:id/followers", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const targetId = parseInt(raw, 10);
  const follows = await db.select().from(followsTable).where(eq(followsTable.followingId, targetId)).orderBy(desc(followsTable.createdAt));
  const users = await Promise.all(follows.map(async f => {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, f.followerId)).limit(1);
    return u ? formatUser(u) : null;
  }));
  res.json(users.filter(Boolean));
});

router.get("/users/:id/following", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const targetId = parseInt(raw, 10);
  const follows = await db.select().from(followsTable).where(eq(followsTable.followerId, targetId)).orderBy(desc(followsTable.createdAt));
  const users = await Promise.all(follows.map(async f => {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, f.followingId)).limit(1);
    return u ? formatUser(u) : null;
  }));
  res.json(users.filter(Boolean));
});

// --- BLUE BADGE ---
router.post("/users/claim-badge", requireAuth, async (req, res): Promise<void> => {
  const me = getUser(req);
  if (me.blueBadge) {
    res.json({ ok: true, blueBadge: true, message: "Badge already claimed!" });
    return;
  }
  const expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000); // 3 hours from now
  await db.update(usersTable).set({ blueBadge: true, blueBadgeClaimedAt: new Date() }).where(eq(usersTable.id, me.id));
  // Create a notification for the claimed badge
  await db.insert(notificationsTable).values({
    userId: me.id,
    type: "blue_badge",
    message: JSON.stringify({ text: "You have successfully claimed your Blue Badge! 💙✓", claimedAt: new Date().toISOString() }),
  });
  res.json({ ok: true, blueBadge: true, expiresAt: null, message: "Blue Badge claimed! It will stay on your profile forever. 💙✓" });
});

// --- REPORT USER ---
router.post("/users/:id/report", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const reportedUserId = parseInt(raw, 10);
  const me = getUser(req);
  const { reason } = req.body;
  if (!reason) { res.status(400).json({ error: "reason required" }); return; }
  const { reportsTable } = await import("@workspace/db");
  await db.insert(reportsTable).values({ reporterId: me.id, reportedUserId, reason });
  // Notify admins
  const admins = await db.select().from(usersTable).where(eq(usersTable.isAdmin, true));
  const [reportedUser] = await db.select().from(usersTable).where(eq(usersTable.id, reportedUserId)).limit(1);
  for (const admin of admins) {
    await db.insert(notificationsTable).values({
      userId: admin.id,
      type: "report_received",
      fromUserId: me.id,
      message: JSON.stringify({
        text: `${me.name} is reporting this ${reason.replace("_", " ")} account`,
        reportedUserId,
        reportedUserName: reportedUser?.name,
        reason,
      }),
    });
  }
  res.status(201).json({ ok: true, message: "YOUR REPORT HAS BEEN RECEIVED BY THE ADMIN" });
});

export default router;
