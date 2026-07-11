import { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import { AuthUser } from "../types/auth";
import { verifyToken } from "../utils/tokens";

type RequestWithUser = Request & {
  user?: AuthUser;
};

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const value = Array.isArray(header) ? header[0] : header;

  if (!value || !value.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const payload = verifyToken(value.slice("Bearer ".length));
    if (payload.type !== "access") {
      return res.status(401).json({ message: "Invalid token type" });
    }

    (req as RequestWithUser).user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role
    };
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const optionalAuth = (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const value = Array.isArray(header) ? header[0] : header;

  if (!value || !value.startsWith("Bearer ")) {
    return next();
  }

  try {
    const payload = verifyToken(value.slice("Bearer ".length));
    if (payload.type === "access") {
      (req as RequestWithUser).user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role
      };
    }
  } catch {
    // Public endpoints stay public; invalid optional auth is treated as anonymous.
  }

  return next();
};

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    const user = (req as RequestWithUser).user;
    if (!user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!roles.includes(user.role as Role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return next();
  };
