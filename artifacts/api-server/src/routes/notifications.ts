import { Router, type IRouter } from "express";
import { db, usersTable, notificationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, getUser, formatUser } from "../lib/auth";

const router: IRouter = Router();

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const me = getUser(req);
  const notifications = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, me.id))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);
  const result = await Promise.all(notifications.map(async n => {
    let fromUser = null;
    if (n.fromUserId) {
      const [u] = await db.select().from(usersTable).where(eq(usersTable.id, n.fromUserId)).limit(1);
      fromUser = u ? formatUser(u) : null;
    }
    return {
      id: n.id,
      userId: n.userId,
      type: n.type,
      fromUserId: n.fromUserId,
      fromUser,
      postId: n.postId,
      conversationId: n.conversationId,
      message: n.message,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    };
  }));
  res.json(result);
});

router.get("/notifications/unread-count", requireAuth, async (req, res): Promise<void> => {
  const me = getUser(req);
  const notifications = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, me.id));
  const cnt = notifications.filter(n => !n.read).length;
  res.json({ count: cnt });
});

router.post("/notifications/read-all", requireAuth, async (req, res): Promise<void> => {
  const me = getUser(req);
  await db.update(notificationsTable).set({ read: true }).where(eq(notificationsTable.userId, me.id));
  res.json({ ok: true });
});

router.post("/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const me = getUser(req);
  await db.update(notificationsTable).set({ read: true })
    .where(eq(notificationsTable.id, id));
  res.json({ ok: true });
});

router.delete("/notifications/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const me = getUser(req);
  await db.delete(notificationsTable)
    .where(eq(notificationsTable.id, id));
  res.status(204).send();
});

export default router;
