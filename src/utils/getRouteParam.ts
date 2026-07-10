import { Request } from "express";
import { HttpError } from "./httpError";

export const getRouteParam = (req: Request, key: string) => {
  const value = req.params[key];
  if (typeof value !== "string") {
    throw new HttpError(400, `Invalid route parameter: ${key}`);
  }

  return value;
};
