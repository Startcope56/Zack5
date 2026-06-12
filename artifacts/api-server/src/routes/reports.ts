import { Router, type IRouter } from "express";
import { db, usersTable, postsTable, reportsTable, notificationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, getUser, formatUser } from "../lib/auth";
import { io } from "../index";

const router: IRouter = Router();

// Report a post
router.post("/posts/:id/report", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const postId = parseInt(raw, 10);
  const me = getUser(req);
  const { reason } = req.body;
  if (!reason) { res.status(400).json({ error: "reason required" }); return; }

  await db.insert(reportsTable).values({ reporterId: me.id, reportedPostId: postId, reason });

  // Notify all admins
  const admins = await db.select().from(usersTable).where(eq(usersTable.isAdmin, true));
  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId)).limit(1);
  for (const admin of admins) {
    await db.insert(notificationsTable).values({
      userId: admin.id,
      type: "report_received",
      fromUserId: me.id,
      postId,
      message: JSON.stringify({
        text: `${me.name} is reporting this post as ${reason.replace(/_/g, " ")}`,
        reason,
        postId,
        postContent: post?.content?.substring(0, 80),
      }),
    });
    io.to(`user:${admin.id}`).emit("notification", { type: "report_received" });
  }
  res.status(201).json({ ok: true, message: "YOUR REPORT HAS BEEN RECEIVED BY THE ADMIN" });
});

// Admin: Get all reports
router.get("/admin/reports", requireAuth, async (req, res): Promise<void> => {
  const me = getUser(req);
  if (!me.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }

  const reports = await db.select().from(reportsTable).orderBy(desc(reportsTable.createdAt)).limit(100);
  const enriched = await Promise.all(reports.map(async r => {
    const [reporter] = await db.select().from(usersTable).where(eq(usersTable.id, r.reporterId)).limit(1);
    let reportedUser = null;
    let reportedPost = null;
    if (r.reportedUserId) {
      const [u] = await db.select().from(usersTable).where(eq(usersTable.id, r.reportedUserId)).limit(1);
      reportedUser = u ? formatUser(u) : null;
    }
    if (r.reportedPostId) {
      const [p] = await db.select().from(postsTable).where(eq(postsTable.id, r.reportedPostId)).limit(1);
      if (p) {
        const [postAuthor] = await db.select().from(usersTable).where(eq(usersTable.id, p.userId)).limit(1);
        reportedPost = {
          id: p.id, userId: p.userId, content: p.content, imageUrl: p.imageUrl,
          bgColor: p.bgColor, createdAt: p.createdAt.toISOString(),
          author: postAuthor ? formatUser(postAuthor) : null,
          reactions: [], commentCount: 0, myReaction: null,
        };
      }
    }
    return {
      id: r.id,
      reporterId: r.reporterId,
      reportedPostId: r.reportedPostId,
      reportedUserId: r.reportedUserId,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      reporter: reporter ? formatUser(reporter) : null,
      reportedUser,
      reportedPost,
    };
  }));
  res.json(enriched);
});

// Admin: Action on report
router.post("/admin/reports/:id/action", requireAuth, async (req, res): Promise<void> => {
  const me = getUser(req);
  if (!me.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const reportId = parseInt(raw, 10);
  const { action } = req.body;

  const [report] = await db.select().from(reportsTable).where(eq(reportsTable.id, reportId)).limit(1);
  if (!report) { res.status(404).json({ error: "Report not found" }); return; }

  if (action === "remove_post" && report.reportedPostId) {
    await db.delete(postsTable).where(eq(postsTable.id, report.reportedPostId));
  } else if (action === "restrict_account") {
    const userId = report.reportedUserId || (report.reportedPostId ? (await db.select().from(postsTable).where(eq(postsTable.id, report.reportedPostId)).limit(1))[0]?.userId : null);
    if (userId) await db.update(usersTable).set({ restricted: true }).where(eq(usersTable.id, userId));
  } else if (action === "remove_account" || action === "ban_account") {
    const userId = report.reportedUserId || (report.reportedPostId ? (await db.select().from(postsTable).where(eq(postsTable.id, report.reportedPostId)).limit(1))[0]?.userId : null);
    if (userId) {
      await db.update(usersTable).set({ banned: true, restricted: true }).where(eq(usersTable.id, userId));
      // Notify user
      await db.insert(notificationsTable).values({ userId, type: "report_received", message: JSON.stringify({ text: "Your account has been banned for violating community guidelines." }) });
    }
  }

  await db.update(reportsTable).set({ status: action === "dismiss_report" ? "dismissed" : "resolved" }).where(eq(reportsTable.id, reportId));
  res.json({ ok: true, message: "Action taken successfully" });
});

// Admin: Direct user action
router.post("/admin/users/:id/action", requireAuth, async (req, res): Promise<void> => {
  const me = getUser(req);
  if (!me.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const userId = parseInt(raw, 10);
  const { action } = req.body;

  if (action === "ban_account" || action === "remove_account") {
    await db.update(usersTable).set({ banned: true, restricted: true }).where(eq(usersTable.id, userId));
  } else if (action === "restrict_account") {
    await db.update(usersTable).set({ restricted: true }).where(eq(usersTable.id, userId));
  } else if (action === "restore_account") {
    await db.update(usersTable).set({ banned: false, restricted: false }).where(eq(usersTable.id, userId));
  }

  res.json({ ok: true });
});

export default router;
