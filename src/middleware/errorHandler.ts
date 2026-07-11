import { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/httpError";

export const notFound = (req: Request, res: Response) => {
  res.status(404).json({ message: "Not found" });
};

export const errorHandler = (
  error: Error | HttpError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = error instanceof HttpError ? error.statusCode : 500;
  const message = statusCode === 500 ? "Internal server error" : error.message;

  res.status(statusCode).json({
    message,
    ...(error instanceof HttpError && error.errors ? { errors: error.errors } : {})
  });
};
