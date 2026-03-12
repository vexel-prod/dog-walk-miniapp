import type { PrismaClient } from "@/generated/prisma/client";
import { ensureDefaultHousehold } from "@/lib/household";
import { createHmac, timingSafeEqual } from "node:crypto";

type TelegramAuthUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

type AuthorizedMember = {
  member: {
    id: string;
    householdId: string;
    telegramUserId: string;
    chatId: string;
    firstName: string;
    lastName: string | null;
    username: string | null;
    role: string;
  };
  user: TelegramAuthUser;
};

function getHeaderInitData(request: Request) {
  return request.headers.get("x-telegram-init-data")?.trim() ?? "";
}

function validateTelegramInitData(rawInitData: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN");
  }

  if (!rawInitData) {
    return null;
  }

  const params = new URLSearchParams(rawInitData);
  const hash = params.get("hash");

  if (!hash) {
    return null;
  }

  const pairs = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`);

  const dataCheckString = pairs.join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  const expectedHash = Buffer.from(computedHash, "hex");
  const receivedHash = Buffer.from(hash, "hex");

  if (
    receivedHash.length !== expectedHash.length ||
    !timingSafeEqual(receivedHash, expectedHash)
  ) {
    return null;
  }

  const rawUser = params.get("user");

  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser) as TelegramAuthUser;
  } catch {
    return null;
  }
}

export async function authorizeRequest(
  request: Request,
  prisma: PrismaClient,
): Promise<AuthorizedMember | null> {
  await ensureDefaultHousehold(prisma);

  const initData = getHeaderInitData(request);
  const user = validateTelegramInitData(initData);

  if (!user?.id) {
    return null;
  }

  const member = await prisma.member.findUnique({
    where: { telegramUserId: String(user.id) },
  });

  if (!member) {
    return null;
  }

  const updatedMember = await prisma.member.update({
    where: { id: member.id },
    data: {
      chatId: String(user.id),
      firstName: user.first_name || member.firstName,
      lastName: user.last_name ?? member.lastName,
      username: user.username ?? member.username,
    },
  });

  return {
    member: updatedMember,
    user,
  };
}
