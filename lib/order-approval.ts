import { createHmac, timingSafeEqual } from "node:crypto";

export type OrderDecision = "approved" | "rejected";

function getApprovalSecret() {
  const secret = process.env.APPROVAL_SECRET ?? process.env.TELEGRAM_BOT_TOKEN;

  if (!secret) {
    throw new Error("Missing APPROVAL_SECRET or TELEGRAM_BOT_TOKEN");
  }

  return secret;
}

export function createDecisionToken(orderId: string, decision: OrderDecision) {
  return createHmac("sha256", getApprovalSecret()).update(`${orderId}:${decision}`).digest("hex");
}

export function verifyDecisionToken(orderId: string, decision: OrderDecision, token: string) {
  const expected = createDecisionToken(orderId, decision);
  const tokenBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expected);

  if (tokenBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(tokenBuffer, expectedBuffer);
}
