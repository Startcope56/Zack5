import http from "http";
import { Server as SocketIOServer } from "socket.io";
import app from "./app";
import { logger } from "./lib/logger";
import { db, sessionsTable, usersTable, messagesTable, conversationParticipantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = http.createServer(app);

export const io = new SocketIOServer(server, {
  path: "/socket.io",
  cors: { origin: "*", credentials: true },
  transports: ["websocket", "polling"],
});

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) {
    return next(new Error("No token"));
  }
  const [session] = await db
    .select({ userId: sessionsTable.userId })
    .from(sessionsTable)
    .where(eq(sessionsTable.token, token))
    .limit(1);
  if (!session) {
    return next(new Error("Invalid token"));
  }
  socket.data.userId = session.userId;
  next();
});

io.on("connection", (socket) => {
  const userId: number = socket.data.userId;
  socket.join(`user:${userId}`);
  logger.info({ userId }, "Socket connected");

  socket.on("join_conversation", ({ conversationId }: { conversationId: number }) => {
    socket.join(`conv:${conversationId}`);
  });

  socket.on("leave_conversation", ({ conversationId }: { conversationId: number }) => {
    socket.leave(`conv:${conversationId}`);
  });

  socket.on("typing", ({ conversationId }: { conversationId: number }) => {
    socket.to(`conv:${conversationId}`).emit("typing", { userId, conversationId });
  });

  socket.on("seen", async ({ conversationId, messageId }: { conversationId: number; messageId: number }) => {
    const [msg] = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.id, messageId))
      .limit(1);
    if (!msg) return;
    const seenBy: number[] = JSON.parse(msg.seenBy || "[]");
    if (!seenBy.includes(userId)) {
      seenBy.push(userId);
      await db.update(messagesTable).set({ seenBy: JSON.stringify(seenBy) }).where(eq(messagesTable.id, messageId));
    }
    io.to(`conv:${conversationId}`).emit("message_seen", { messageId, userId, seenBy });
  });

  socket.on("disconnect", () => {
    logger.info({ userId }, "Socket disconnected");
  });
});

server.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});

export default server;
