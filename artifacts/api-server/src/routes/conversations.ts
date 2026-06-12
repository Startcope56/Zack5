import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db, usersTable, conversationsTable, conversationParticipantsTable, messagesTable, messageReactionsTable, notificationsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, getUser, formatUser } from "../lib/auth";
import { uploadsDir } from "../app";
import { io } from "../index";
import { generateBlueAIResponse } from "../lib/blueai";
import { containsProfanity } from "../lib/profanity";
import bcrypt from "bcryptjs";

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

async function buildMessage(msg: typeof messagesTable.$inferSelect) {
  const [sender] = await db.select().from(usersTable).where(eq(usersTable.id, msg.senderId)).limit(1);
  const reactions = await db.select().from(messageReactionsTable).where(eq(messageReactionsTable.messageId, msg.id));
  const reactionsFull = await Promise.all(reactions.map(async r => {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, r.userId)).limit(1);
    return { id: r.id, messageId: r.messageId, userId: r.userId, emoji: r.emoji, user: u ? formatUser(u) : null };
  }));
  const seenBy: number[] = JSON.parse(msg.seenBy || "[]");
  return {
    id: msg.id,
    conversationId: msg.conversationId,
    senderId: msg.senderId,
    content: msg.content,
    imageUrl: msg.imageUrl,
    sender: sender ? formatUser(sender) : null,
    reactions: reactionsFull,
    seenBy,
    createdAt: msg.createdAt.toISOString(),
  };
}

async function buildConversation(conv: typeof conversationsTable.$inferSelect, meId: number) {
  const participants = await db
    .select()
    .from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.conversationId, conv.id));
  const participantUsers = await Promise.all(participants.map(async p => {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, p.userId)).limit(1);
    return u ? formatUser(u) : null;
  }));
  const [lastMsg] = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, conv.id))
    .orderBy(desc(messagesTable.createdAt))
    .limit(1);
  const allMessages = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, conv.id));
  const unreadCount = allMessages.filter(m => {
    const seenBy: number[] = JSON.parse(m.seenBy || "[]");
    return m.senderId !== meId && !seenBy.includes(meId);
  }).length;
  return {
    id: conv.id,
    type: conv.type,
    name: conv.name,
    pictureUrl: conv.pictureUrl,
    backgroundTheme: conv.backgroundTheme,
    participants: participantUsers.filter(Boolean),
    lastMessage: lastMsg ? await buildMessage(lastMsg) : null,
    unreadCount,
    createdAt: conv.createdAt.toISOString(),
  };
}

async function getOrCreateBlueAIUser() {
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.isBlueAI, true)).limit(1);
  if (existing) return existing;
  const pinHash = await bcrypt.hash("BLUEAI_INTERNAL", 10);
  const [user] = await db.insert(usersTable).values({
    email: "blueai@bluemedia.internal",
    name: "BLUE AI",
    pinHash,
    isBlueAI: true,
    blueBadge: true,
    bio: "Ako ang official AI assistant ng Blue Media! Magtanong ka sa akin tungkol sa app. 💙",
  }).returning();
  return user;
}

router.get("/conversations", requireAuth, async (req, res): Promise<void> => {
  const me = getUser(req);
  const participations = await db
    .select()
    .from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.userId, me.id));
  const convs = await Promise.all(participations.map(async p => {
    const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, p.conversationId)).limit(1);
    return conv ? buildConversation(conv, me.id) : null;
  }));
  const results = (await Promise.all(convs)).filter(Boolean);
  res.json(results);
});

router.post("/conversations", requireAuth, async (req, res): Promise<void> => {
  const me = getUser(req);
  const { participantId } = req.body;
  if (!participantId) { res.status(400).json({ error: "participantId required" }); return; }
  const myParticipations = await db
    .select()
    .from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.userId, me.id));
  for (const p of myParticipations) {
    const [conv] = await db.select().from(conversationsTable)
      .where(and(eq(conversationsTable.id, p.conversationId), eq(conversationsTable.type, "direct")))
      .limit(1);
    if (!conv) continue;
    const otherParticipants = await db.select().from(conversationParticipantsTable)
      .where(and(eq(conversationParticipantsTable.conversationId, conv.id), eq(conversationParticipantsTable.userId, participantId)))
      .limit(1);
    if (otherParticipants.length) {
      res.json(await buildConversation(conv, me.id)); return;
    }
  }
  const [conv] = await db.insert(conversationsTable).values({ type: "direct", createdBy: me.id }).returning();
  await db.insert(conversationParticipantsTable).values({ conversationId: conv.id, userId: me.id });
  await db.insert(conversationParticipantsTable).values({ conversationId: conv.id, userId: participantId });
  res.json(await buildConversation(conv, me.id));
});

router.post("/conversations/groups", requireAuth, async (req, res): Promise<void> => {
  const me = getUser(req);
  const { name, pictureUrl, participantIds } = req.body;
  if (!name || !participantIds?.length) { res.status(400).json({ error: "name and participantIds required" }); return; }
  const [conv] = await db.insert(conversationsTable).values({ type: "group", name, pictureUrl: pictureUrl ?? null, createdBy: me.id }).returning();
  const allIds = [me.id, ...participantIds.filter((id: number) => id !== me.id)];
  await Promise.all(allIds.map((uid: number) =>
    db.insert(conversationParticipantsTable).values({ conversationId: conv.id, userId: uid })
  ));
  res.status(201).json(await buildConversation(conv, me.id));
});

// BLUE AI conversation
router.post("/conversations/blue-ai", requireAuth, async (req, res): Promise<void> => {
  const me = getUser(req);
  const aiUser = await getOrCreateBlueAIUser();

  const myParticipations = await db
    .select()
    .from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.userId, me.id));

  for (const p of myParticipations) {
    const [conv] = await db.select().from(conversationsTable)
      .where(and(eq(conversationsTable.id, p.conversationId), eq(conversationsTable.type, "direct")))
      .limit(1);
    if (!conv) continue;
    const aiParticipant = await db.select().from(conversationParticipantsTable)
      .where(and(eq(conversationParticipantsTable.conversationId, conv.id), eq(conversationParticipantsTable.userId, aiUser.id)))
      .limit(1);
    if (aiParticipant.length) {
      res.json(await buildConversation(conv, me.id)); return;
    }
  }

  const [conv] = await db.insert(conversationsTable).values({ type: "direct", createdBy: me.id }).returning();
  await db.insert(conversationParticipantsTable).values({ conversationId: conv.id, userId: me.id });
  await db.insert(conversationParticipantsTable).values({ conversationId: conv.id, userId: aiUser.id });

  // Send welcome message from BLUE AI
  const welcomeMsg = "Kumusta! Ako si BLUE AI — ang official AI assistant ng Blue Media! 💙\n\nPwede mo akong itanong tungkol sa:\n• Paano gamitin ang Blue Media\n• Mga rules at guidelines\n• Features ng app\n\nAno ang maari kong gawin para sa inyo today? 😊";
  const [msg] = await db.insert(messagesTable).values({
    conversationId: conv.id,
    senderId: aiUser.id,
    content: welcomeMsg,
    seenBy: JSON.stringify([aiUser.id]),
  }).returning();
  io.to(`conv:${conv.id}`).emit("message", await buildMessage(msg));

  res.json(await buildConversation(conv, me.id));
});

router.get("/conversations/:id", requireAuth, async (req, res): Promise<void> => {
  const me = getUser(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id)).limit(1);
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await buildConversation(conv, me.id));
});

router.patch("/conversations/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const me = getUser(req);
  const { name, pictureUrl, backgroundTheme } = req.body;
  const update: Record<string, string | null> = {};
  if (name !== undefined) update.name = name;
  if (pictureUrl !== undefined) update.pictureUrl = pictureUrl;
  if (backgroundTheme !== undefined) update.backgroundTheme = backgroundTheme;
  const [conv] = await db.update(conversationsTable).set(update).where(eq(conversationsTable.id, id)).returning();
  res.json(await buildConversation(conv, me.id));
});

router.get("/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const messages = await db.select().from(messagesTable)
    .where(eq(messagesTable.conversationId, id))
    .orderBy(messagesTable.createdAt)
    .limit(100);
  const result = await Promise.all(messages.map(buildMessage));
  res.json(result);
});

router.post("/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const me = getUser(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { content, imageUrl } = req.body;
  if (content == null) { res.status(400).json({ error: "content required" }); return; }

  // Profanity filter on messages
  if (containsProfanity(content)) {
    res.status(400).json({
      error: "HINDI PWEDE ANG MASAMANG SALITA ❌ — Your message contains inappropriate language!",
      profanity: true,
    });
    return;
  }

  const [msg] = await db.insert(messagesTable).values({
    conversationId: id,
    senderId: me.id,
    content,
    imageUrl: imageUrl ?? null,
    seenBy: JSON.stringify([me.id]),
  }).returning();
  const built = await buildMessage(msg);
  io.to(`conv:${id}`).emit("message", built);

  // Notify other participants
  const participants = await db.select().from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.conversationId, id));
  for (const p of participants) {
    if (p.userId !== me.id) {
      const [pUser] = await db.select().from(usersTable).where(eq(usersTable.id, p.userId)).limit(1);
      if (pUser?.isBlueAI) {
        // Auto-respond from BLUE AI after short delay
        setTimeout(async () => {
          const aiResponse = generateBlueAIResponse(content);
          const [aiMsg] = await db.insert(messagesTable).values({
            conversationId: id,
            senderId: p.userId,
            content: aiResponse,
            seenBy: JSON.stringify([p.userId]),
          }).returning();
          const builtAi = await buildMessage(aiMsg);
          io.to(`conv:${id}`).emit("message", builtAi);
        }, 1200 + Math.random() * 800);
      } else {
        await db.insert(notificationsTable).values({ userId: p.userId, type: "message", fromUserId: me.id, conversationId: id });
        io.to(`user:${p.userId}`).emit("notification", { type: "message", conversationId: id });
      }
    }
  }
  res.status(201).json(built);
});

router.post("/conversations/:id/messages/upload", requireAuth, upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "No file" }); return; }
  const url = `/api/uploads/${req.file.filename}`;
  res.json({ url });
});

router.post("/conversations/:id/messages/:msgId/reactions", requireAuth, async (req, res): Promise<void> => {
  const me = getUser(req);
  const rawMsgId = Array.isArray(req.params.msgId) ? req.params.msgId[0] : req.params.msgId;
  const msgId = parseInt(rawMsgId, 10);
  const { emoji } = req.body;
  const [existing] = await db.select().from(messageReactionsTable)
    .where(and(eq(messageReactionsTable.messageId, msgId), eq(messageReactionsTable.userId, me.id))).limit(1);
  if (existing) {
    await db.update(messageReactionsTable).set({ emoji }).where(eq(messageReactionsTable.id, existing.id));
  } else {
    await db.insert(messageReactionsTable).values({ messageId: msgId, userId: me.id, emoji });
  }
  const [msgRow] = await db.select().from(messagesTable).where(eq(messagesTable.id, msgId)).limit(1);
  if (msgRow) {
    const builtMsg = await buildMessage(msgRow);
    io.to(`conv:${msgRow.conversationId}`).emit("message_updated", builtMsg);
  }
  res.json({ ok: true });
});

router.post("/conversations/:id/read", requireAuth, async (req, res): Promise<void> => {
  const me = getUser(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const convId = parseInt(raw, 10);
  const messages = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, convId));
  for (const m of messages) {
    const seenBy: number[] = JSON.parse(m.seenBy || "[]");
    if (!seenBy.includes(me.id)) {
      seenBy.push(me.id);
      await db.update(messagesTable).set({ seenBy: JSON.stringify(seenBy) }).where(eq(messagesTable.id, m.id));
    }
  }
  io.to(`conv:${convId}`).emit("conversation_read", { conversationId: convId, userId: me.id });
  res.json({ ok: true });
});

router.post("/conversations/:id/participants", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { userId } = req.body;
  const existing = await db.select().from(conversationParticipantsTable)
    .where(and(eq(conversationParticipantsTable.conversationId, id), eq(conversationParticipantsTable.userId, userId))).limit(1);
  if (!existing.length) {
    await db.insert(conversationParticipantsTable).values({ conversationId: id, userId });
  }
  res.json({ ok: true });
});

router.delete("/conversations/:id/participants/:userId", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const convId = parseInt(rawId, 10);
  const rawUserId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const userId = parseInt(rawUserId, 10);
  await db.delete(conversationParticipantsTable)
    .where(and(eq(conversationParticipantsTable.conversationId, convId), eq(conversationParticipantsTable.userId, userId)));
  res.status(204).send();
});

export default router;
