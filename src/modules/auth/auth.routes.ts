import express from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { validateBody } from "../../middleware/validate";
import { login, refresh, register, registerOrganiser } from "./auth.controller";
import {
  loginSchema,
  organiserRegisterSchema,
  refreshSchema,
  registerSchema
} from "./auth.schemas";

export const authRouter = express.Router();

authRouter.post("/register", validateBody(registerSchema), asyncHandler(register));
authRouter.post(
  "/register-organiser",
  validateBody(organiserRegisterSchema),
  asyncHandler(registerOrganiser)
);
authRouter.post("/login", validateBody(loginSchema), asyncHandler(login));
authRouter.post("/refresh", validateBody(refreshSchema), asyncHandler(refresh));
