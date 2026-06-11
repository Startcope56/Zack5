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
  (req as Request & { user: typeof user }).user = user;
  next();
}

export function getUser(req: Request) {
  return (req as Request & { user: { id: number; email: string; name: string; isAdmin: boolean; privacy: string; profilePicture: string | null; coverPicture: string | null; bio: string | null; location: string | null; website: string | null; createdAt: Date; updatedAt: Date; pinHash: string } }).user;
}

export function formatUser(user: { id: number; email: string; name: string; profilePicture: string | null; coverPicture: string | null; bio: string | null; location: string | null; website: string | null; privacy: string; isAdmin: boolean; createdAt: Date }) {
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
    createdAt: user.createdAt.toISOString(),
  };
}
