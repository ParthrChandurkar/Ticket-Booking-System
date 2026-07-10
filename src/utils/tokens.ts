import jwt from "jsonwebtoken";
import { SignOptions } from "jsonwebtoken";
import { Role } from "@prisma/client";
import { getEnv } from "../config/env";

type TokenType = "access" | "refresh";

export type TokenPayload = {
  sub: string;
  email: string;
  role: Role;
  type: TokenType;
};

const signToken = (payload: TokenPayload, expiresIn: SignOptions["expiresIn"]) =>
  jwt.sign(payload, getEnv("JWT_SECRET"), { expiresIn });

export const createAccessToken = (user: { id: string; email: string; role: Role }) =>
  signToken(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: "access"
    },
    "15m"
  );

export const createRefreshToken = (user: { id: string; email: string; role: Role }) =>
  signToken(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: "refresh"
    },
    "7d"
  );

export const verifyToken = (token: string) =>
  jwt.verify(token, getEnv("JWT_SECRET")) as TokenPayload;
