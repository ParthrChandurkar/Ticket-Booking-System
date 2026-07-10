import { Request } from "express";
import { AuthUser } from "../types/auth";

export type RequestWithUser = Request & {
  user?: AuthUser;
};

export const getAuthUser = (req: Request) => {
  const user = (req as RequestWithUser).user;
  if (!user) {
    throw new Error("Authenticated user was not attached to the request");
  }

  return user;
};
