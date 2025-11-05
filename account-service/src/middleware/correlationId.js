// middleware/correlationId.js
import { randomUUID } from "crypto";

export function correlationIdMiddleware(req, res, next) {
  const headerId = req.headers["x-correlation-id"];
  req.correlationId = headerId || randomUUID();
  res.setHeader("x-correlation-id", req.correlationId);
  next();
}
