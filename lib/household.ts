import type { PrismaClient } from "@/generated/prisma/client";

const DEFAULT_HOUSEHOLD_ID = "default-dog-walk-household";

function getConfiguredUserIds() {
  const ownerUserId =
    process.env.TELEGRAM_OWNER_USER_ID ?? process.env.TELEGRAM_OWNER_CHAT_ID;
  const buyerUserId =
    process.env.TELEGRAM_BUYER_USER_ID ?? process.env.TELEGRAM_BUYER_CHAT_ID;

  return { ownerUserId, buyerUserId };
}

export async function ensureDefaultHousehold(prisma: PrismaClient) {
  const { ownerUserId, buyerUserId } = getConfiguredUserIds();

  if (!ownerUserId || !buyerUserId) {
    throw new Error(
      "Missing TELEGRAM_OWNER_USER_ID/TELEGRAM_OWNER_CHAT_ID or TELEGRAM_BUYER_USER_ID/TELEGRAM_BUYER_CHAT_ID",
    );
  }

  await prisma.household.upsert({
    where: { id: DEFAULT_HOUSEHOLD_ID },
    update: {},
    create: {
      id: DEFAULT_HOUSEHOLD_ID,
      name: "Dog Walk Family",
    },
  });

  await prisma.member.upsert({
    where: { telegramUserId: ownerUserId },
    update: {},
    create: {
      householdId: DEFAULT_HOUSEHOLD_ID,
      telegramUserId: ownerUserId,
      chatId: ownerUserId,
      firstName: "Owner",
      role: "owner",
    },
  });

  await prisma.member.upsert({
    where: { telegramUserId: buyerUserId },
    update: {},
    create: {
      householdId: DEFAULT_HOUSEHOLD_ID,
      telegramUserId: buyerUserId,
      chatId: buyerUserId,
      firstName: "Buyer",
      role: "buyer",
    },
  });
}

export { DEFAULT_HOUSEHOLD_ID, getConfiguredUserIds };
