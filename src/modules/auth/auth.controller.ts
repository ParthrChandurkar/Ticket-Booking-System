import bcrypt from "bcrypt";
import { Role } from "@prisma/client";
import { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { getEnv } from "../../config/env";
import { HttpError } from "../../utils/httpError";
import { createAccessToken, createRefreshToken, verifyToken } from "../../utils/tokens";

const publicUser = (user: {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
}) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt
});

const tokenPair = (user: { id: string; email: string; role: any }) => ({
  accessToken: createAccessToken(user),
  refreshToken: createRefreshToken(user)
});

export const register = async (req: Request, res: Response) => {
  const existing = await prisma.user.findUnique({
    where: { email: req.body.email }
  });
  if (existing) {
    throw new HttpError(409, "Email is already registered");
  }

  const passwordHash = await bcrypt.hash(req.body.password, 12);
  const user = await prisma.user.create({
    data: {
      name: req.body.name,
      email: req.body.email,
      passwordHash,
      role: Role.CUSTOMER
    }
  });

  res.status(201).json({
    user: publicUser(user)
  });
};

export const registerOrganiser = async (req: Request, res: Response) => {
  if (req.body.organiserSignupCode !== getEnv("ORGANISER_SIGNUP_CODE")) {
    throw new HttpError(403, "Invalid organiser signup code");
  }

  const existing = await prisma.user.findUnique({
    where: { email: req.body.email }
  });
  if (existing) {
    throw new HttpError(409, "Email is already registered");
  }

  const passwordHash = await bcrypt.hash(req.body.password, 12);
  const user = await prisma.user.create({
    data: {
      name: req.body.name,
      email: req.body.email,
      passwordHash,
      role: Role.ORGANISER
    }
  });

  res.status(201).json({
    user: publicUser(user)
  });
};

export const login = async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { email: req.body.email }
  });

  if (!user) {
    throw new HttpError(401, "Invalid email or password");
  }

  const passwordMatches = await bcrypt.compare(req.body.password, user.passwordHash);
  if (!passwordMatches) {
    throw new HttpError(401, "Invalid email or password");
  }

  res.json({
    user: publicUser(user),
    ...tokenPair(user)
  });
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const payload = verifyToken(req.body.refreshToken);
    if (payload.type !== "refresh") {
      throw new HttpError(401, "Invalid token type");
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub }
    });
    if (!user) {
      throw new HttpError(401, "Invalid refresh token");
    }

    res.json(tokenPair(user));
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(401, "Invalid or expired refresh token");
  }
};
