import { Request, Response, NextFunction } from "express";
import { db, sessionsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = header.slice(7);
  const [session] = await db
    .select({ userId: sessionsTable.userId })
    .from(sessionsTable)
    .where(eq(sessionsTable.token, token))
    .limit(1);
  if (!session) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, session.userId))
    .limit(1);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  if (user.banned) {
    res.status(403).json({ error: "Account banned" });
    return;
  }
  (req as Request & { user: typeof user }).user = user;
  next();
}

export function getUser(req: Request) {
  return (req as any).user as typeof usersTable.$inferSelect;
}

export function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    profilePicture: user.profilePicture,
    coverPicture: user.coverPicture,
    bio: user.bio,
    location: user.location,
    website: user.website,
    privacy: user.privacy,
    isAdmin: user.isAdmin,
    isBlueAI: user.isBlueAI ?? false,
    blueBadge: user.blueBadge ?? false,
    blueBadgeClaimedAt: user.blueBadgeClaimedAt ? user.blueBadgeClaimedAt.toISOString() : null,
    restricted: user.restricted ?? false,
    banned: user.banned ?? false,
    createdAt: user.createdAt.toISOString(),
  };
}
