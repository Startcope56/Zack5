import { Router, type IRouter } from "express";
import { db, usersTable, friendshipsTable, notificationsTable } from "@workspace/db";
import { eq, or, and } from "drizzle-orm";
import { requireAuth, getUser, formatUser } from "../lib/auth";
import { io } from "../index";

const router: IRouter = Router();

router.get("/friends", requireAuth, async (req, res): Promise<void> => {
  const me = getUser(req);
  const userIdParam = req.query.userId ? parseInt(req.query.userId as string, 10) : me.id;
  const userId = isNaN(userIdParam) ? me.id : userIdParam;
  const friendships = await db
    .select()
    .from(friendshipsTable)
    .where(and(
      or(eq(friendshipsTable.requesterId, userId), eq(friendshipsTable.addresseeId, userId)),
      eq(friendshipsTable.status, "accepted")
    ));
  const friendIds = friendships.map(f => f.requesterId === userId ? f.addresseeId : f.requesterId);
  if (!friendIds.length) { res.json([]); return; }
  const friends = await Promise.all(friendIds.map(async id => {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    return u ? formatUser(u) : null;
  }));
  res.json(friends.filter(Boolean));
});

router.get("/friends/requests", requireAuth, async (req, res): Promise<void> => {
  const me = getUser(req);
  const requests = await db
    .select()
    .from(friendshipsTable)
    .where(and(eq(friendshipsTable.addresseeId, me.id), eq(friendshipsTable.status, "pending")));
  const result = await Promise.all(requests.map(async r => {
    const [requester] = await db.select().from(usersTable).where(eq(usersTable.id, r.requesterId)).limit(1);
    const [addressee] = await db.select().from(usersTable).where(eq(usersTable.id, r.addresseeId)).limit(1);
    return {
      id: r.id,
      requesterId: r.requesterId,
      addresseeId: r.addresseeId,
      status: r.status,
      requester: requester ? formatUser(requester) : null,
      addressee: addressee ? formatUser(addressee) : null,
      createdAt: r.createdAt.toISOString(),
    };
  }));
  res.json(result);
});

router.post("/friends/requests", requireAuth, async (req, res): Promise<void> => {
  const me = getUser(req);
  const { addresseeId } = req.body;
  if (!addresseeId || addresseeId === me.id) { res.status(400).json({ error: "Invalid addresseeId" }); return; }
  const existing = await db
    .select()
    .from(friendshipsTable)
    .where(or(
      and(eq(friendshipsTable.requesterId, me.id), eq(friendshipsTable.addresseeId, addresseeId)),
      and(eq(friendshipsTable.requesterId, addresseeId), eq(friendshipsTable.addresseeId, me.id))
    ))
    .limit(1);
  if (existing.length) { res.status(400).json({ error: "Request already exists" }); return; }
  const [friendship] = await db.insert(friendshipsTable).values({ requesterId: me.id, addresseeId, status: "pending" }).returning();
  const [requester] = await db.select().from(usersTable).where(eq(usersTable.id, me.id)).limit(1);
  const [addressee] = await db.select().from(usersTable).where(eq(usersTable.id, addresseeId)).limit(1);
  await db.insert(notificationsTable).values({ userId: addresseeId, type: "friend_request", fromUserId: me.id });
  io.to(`user:${addresseeId}`).emit("notification", { type: "friend_request", fromUser: formatUser(requester!) });
  res.status(201).json({
    id: friendship.id,
    requesterId: friendship.requesterId,
    addresseeId: friendship.addresseeId,
    status: friendship.status,
    requester: requester ? formatUser(requester) : null,
    addressee: addressee ? formatUser(addressee) : null,
    createdAt: friendship.createdAt.toISOString(),
  });
});

router.post("/friends/requests/:id/accept", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const me = getUser(req);
  const [friendship] = await db.select().from(friendshipsTable).where(eq(friendshipsTable.id, id)).limit(1);
  if (!friendship || friendship.addresseeId !== me.id) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.update(friendshipsTable).set({ status: "accepted" }).where(eq(friendshipsTable.id, id));
  await db.insert(notificationsTable).values({ userId: friendship.requesterId, type: "friend_accepted", fromUserId: me.id });
  io.to(`user:${friendship.requesterId}`).emit("notification", { type: "friend_accepted" });
  res.json({ ok: true });
});

router.post("/friends/requests/:id/reject", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const me = getUser(req);
  const [friendship] = await db.select().from(friendshipsTable).where(eq(friendshipsTable.id, id)).limit(1);
  if (!friendship || friendship.addresseeId !== me.id) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.update(friendshipsTable).set({ status: "rejected" }).where(eq(friendshipsTable.id, id));
  res.json({ ok: true });
});

router.delete("/friends/:friendId", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.friendId) ? req.params.friendId[0] : req.params.friendId;
  const friendId = parseInt(raw, 10);
  const me = getUser(req);
  await db.delete(friendshipsTable).where(or(
    and(eq(friendshipsTable.requesterId, me.id), eq(friendshipsTable.addresseeId, friendId)),
    and(eq(friendshipsTable.requesterId, friendId), eq(friendshipsTable.addresseeId, me.id))
  ));
  res.status(204).send();
});

router.get("/friends/status/:userId", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const targetId = parseInt(raw, 10);
  const me = getUser(req);
  const [friendship] = await db
    .select()
    .from(friendshipsTable)
    .where(or(
      and(eq(friendshipsTable.requesterId, me.id), eq(friendshipsTable.addresseeId, targetId)),
      and(eq(friendshipsTable.requesterId, targetId), eq(friendshipsTable.addresseeId, me.id))
    ))
    .limit(1);
  if (!friendship) { res.json({ status: "none", requestId: null }); return; }
  if (friendship.status === "accepted") { res.json({ status: "friends", requestId: friendship.id }); return; }
  if (friendship.status === "pending" && friendship.requesterId === me.id) {
    res.json({ status: "pending_sent", requestId: friendship.id }); return;
  }
  if (friendship.status === "pending" && friendship.addresseeId === me.id) {
    res.json({ status: "pending_received", requestId: friendship.id }); return;
  }
  res.json({ status: "none", requestId: null });
});

export default router;
