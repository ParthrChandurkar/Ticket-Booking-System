import { PrismaClient } from "@prisma/client";
import { loadEnv } from "./env";

loadEnv();

export const prisma = new PrismaClient();
