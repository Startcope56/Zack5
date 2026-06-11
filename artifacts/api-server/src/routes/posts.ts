import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db, usersTable, postsTable, postReactionsTable, postCommentsTable, notificationsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, getUser, formatUser } from "../lib/auth";
import { uploadsDir } from "../app";
import { io } from "../index";

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

async function buildPost(post: typeof postsTable.$inferSelect, meId: number) {
  const [author] = await db.select().from(usersTable).where(eq(usersTable.id, post.userId)).limit(1);
  const allReactions = await db.select().from(postReactionsTable).where(eq(postReactionsTable.postId, post.id));
  const reactionMap: Record<string, number> = {};
  for (const r of allReactions) {
    reactionMap[r.type] = (reactionMap[r.type] ?? 0) + 1;
  }
  const reactions = Object.entries(reactionMap).map(([type, cnt]) => ({ type, count: cnt }));
  const myReactionRow = allReactions.find(r => r.userId === meId);
  const [commentCountRow] = await db
    .select({ c: (await import("drizzle-orm")).count() })
    .from(postCommentsTable)
    .where(eq(postCommentsTable.postId, post.id));
  return {
    id: post.id,
    userId: post.userId,
    content: post.content,
    imageUrl: post.imageUrl,
    author: author ? formatUser(author) : null,
    reactions,
    commentCount: Number(commentCountRow?.c ?? 0),
    myReaction: myReactionRow?.type ?? null,
    createdAt: post.createdAt.toISOString(),
  };
}

router.get("/posts", requireAuth, async (req, res): Promise<void> => {
  const me = getUser(req);
  const userIdParam = req.query.userId ? parseInt(req.query.userId as string, 10) : undefined;
  let query = db.select().from(postsTable).orderBy(desc(postsTable.createdAt)).limit(50);
  let posts;
  if (userIdParam && !isNaN(userIdParam)) {
    posts = await db.select().from(postsTable).where(eq(postsTable.userId, userIdParam)).orderBy(desc(postsTable.createdAt)).limit(50);
  } else {
    posts = await db.select().from(postsTable).orderBy(desc(postsTable.createdAt)).limit(50);
  }
  const result = await Promise.all(posts.map(p => buildPost(p, me.id)));
  res.json(result);
});

router.post("/posts", requireAuth, async (req, res): Promise<void> => {
  const me = getUser(req);
  const { content, imageUrl } = req.body;
  if (!content) { res.status(400).json({ error: "content required" }); return; }
  const [post] = await db.insert(postsTable).values({ userId: me.id, content, imageUrl: imageUrl ?? null }).returning();
  const built = await buildPost(post, me.id);
  io.emit("new_post", built);
  res.status(201).json(built);
});

router.get("/posts/:id", requireAuth, async (req, res): Promise<void> => {
  const me = getUser(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, id)).limit(1);
  if (!post) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await buildPost(post, me.id));
});

router.delete("/posts/:id", requireAuth, async (req, res): Promise<void> => {
  const me = getUser(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, id)).limit(1);
  if (!post) { res.status(404).json({ error: "Not found" }); return; }
  if (post.userId !== me.id && !me.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.delete(postsTable).where(eq(postsTable.id, id));
  res.status(204).send();
});

router.post("/posts/:id/upload-image", requireAuth, upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "No file" }); return; }
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const url = `/api/uploads/${req.file.filename}`;
  await db.update(postsTable).set({ imageUrl: url }).where(eq(postsTable.id, id));
  res.json({ url });
});

router.post("/posts/:id/reactions", requireAuth, async (req, res): Promise<void> => {
  const me = getUser(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { type } = req.body;
  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, id)).limit(1);
  if (!post) { res.status(404).json({ error: "Not found" }); return; }
  const [existing] = await db.select().from(postReactionsTable)
    .where(and(eq(postReactionsTable.postId, id), eq(postReactionsTable.userId, me.id))).limit(1);
  if (existing) {
    await db.update(postReactionsTable).set({ type }).where(eq(postReactionsTable.id, existing.id));
  } else {
    await db.insert(postReactionsTable).values({ postId: id, userId: me.id, type });
    if (post.userId !== me.id) {
      await db.insert(notificationsTable).values({ userId: post.userId, type: "post_reaction", fromUserId: me.id, postId: id });
      io.to(`user:${post.userId}`).emit("notification", { type: "post_reaction" });
    }
  }
  res.json(await buildPost(post, me.id));
});

router.delete("/posts/:id/reactions", requireAuth, async (req, res): Promise<void> => {
  const me = getUser(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, id)).limit(1);
  if (!post) { res.status(404).json({ error: "Not found" }); return; }
  await db.delete(postReactionsTable).where(and(eq(postReactionsTable.postId, id), eq(postReactionsTable.userId, me.id)));
  res.json(await buildPost(post, me.id));
});

router.get("/posts/:id/comments", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const comments = await db.select().from(postCommentsTable).where(eq(postCommentsTable.postId, id)).orderBy(postCommentsTable.createdAt);
  const result = await Promise.all(comments.map(async c => {
    const [author] = await db.select().from(usersTable).where(eq(usersTable.id, c.userId)).limit(1);
    return {
      id: c.id, postId: c.postId, userId: c.userId,
      content: c.content,
      author: author ? formatUser(author) : null,
      createdAt: c.createdAt.toISOString(),
    };
  }));
  res.json(result);
});

router.post("/posts/:id/comments", requireAuth, async (req, res): Promise<void> => {
  const me = getUser(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { content } = req.body;
  if (!content) { res.status(400).json({ error: "content required" }); return; }
  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, id)).limit(1);
  if (!post) { res.status(404).json({ error: "Not found" }); return; }
  const [comment] = await db.insert(postCommentsTable).values({ postId: id, userId: me.id, content }).returning();
  const [author] = await db.select().from(usersTable).where(eq(usersTable.id, me.id)).limit(1);
  if (post.userId !== me.id) {
    await db.insert(notificationsTable).values({ userId: post.userId, type: "post_comment", fromUserId: me.id, postId: id });
    io.to(`user:${post.userId}`).emit("notification", { type: "post_comment" });
  }
  res.status(201).json({
    id: comment.id, postId: comment.postId, userId: comment.userId,
    content: comment.content,
    author: author ? formatUser(author) : null,
    createdAt: comment.createdAt.toISOString(),
  });
});

router.delete("/posts/:id/comments/:commentId", requireAuth, async (req, res): Promise<void> => {
  const me = getUser(req);
  const rawCommentId = Array.isArray(req.params.commentId) ? req.params.commentId[0] : req.params.commentId;
  const commentId = parseInt(rawCommentId, 10);
  const [comment] = await db.select().from(postCommentsTable).where(eq(postCommentsTable.id, commentId)).limit(1);
  if (!comment) { res.status(404).json({ error: "Not found" }); return; }
  if (comment.userId !== me.id && !me.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  await db.delete(postCommentsTable).where(eq(postCommentsTable.id, commentId));
  res.status(204).send();
});

export default router;
