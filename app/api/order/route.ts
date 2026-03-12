import { authorizeRequest } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { formatOrderNumber } from "@/lib/order-format";
import { createDecisionToken } from "@/lib/order-approval";
import { getConfiguredUserIds } from "@/lib/household";
import { sendTelegramMessage } from "@/lib/telegram";
import { NextResponse } from "next/server";

type OrderPayload = {
  offerId?: string;
  offerTitle?: string;
  offerPrice?: string;
  walkDate?: string;
  walkPeriod?: string;
};

export async function POST(request: Request) {
  const prisma = getPrisma();
  const auth = await authorizeRequest(request, prisma);
  const body = (await request.json()) as OrderPayload;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const { ownerUserId } = getConfiguredUserIds();
  const databaseUrl = process.env.DATABASE_URL;
  const origin = new URL(request.url).origin;

  if (!auth) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!botToken || !ownerUserId || !databaseUrl) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Missing TELEGRAM_BOT_TOKEN, TELEGRAM_OWNER_USER_ID/TELEGRAM_OWNER_CHAT_ID, or DATABASE_URL",
      },
      { status: 500 },
    );
  }

  if (
    !body.offerId ||
    !body.offerTitle ||
    !body.offerPrice ||
    !body.walkDate ||
    !body.walkPeriod
  ) {
    return NextResponse.json({ ok: false, error: "Missing order data" }, { status: 400 });
  }

  const buyerLine =
    [auth.user.first_name, auth.user.last_name].filter(Boolean).join(" ").trim() ||
    auth.user.username ||
    auth.member.firstName;
  const usernameLine = auth.user.username ? `\nUsername: @${auth.user.username}` : "";
  const order = await prisma.order.create({
    data: {
      householdId: auth.member.householdId,
      offerId: body.offerId,
      offerTitle: body.offerTitle,
      offerPrice: body.offerPrice,
      walkDateLabel: body.walkDate,
      walkPeriodLabel: body.walkPeriod,
      buyerName: buyerLine,
      buyerUsername: auth.user.username ?? null,
      buyerTelegramId: String(auth.user.id),
    },
  });

  const approveToken = createDecisionToken(order.id, "approved");
  const rejectToken = createDecisionToken(order.id, "rejected");
  const approveUrl = `${origin}/api/order/decision?orderId=${order.id}&decision=approved&token=${approveToken}`;
  const rejectUrl = `${origin}/api/order/decision?orderId=${order.id}&decision=rejected&token=${rejectToken}`;
  const publicOrderNumber = formatOrderNumber(order.orderNumber);

  const ownerText =
    `Новая заявка на прогулку с собакой\n\n` +
    `Заявка: ${publicOrderNumber}\n` +
    `Тариф: ${body.offerTitle}\n` +
    `Оплата: ${body.offerPrice}\n` +
    `Когда гулять: ${body.walkDate}, ${body.walkPeriod}\n` +
    `Покупатель: ${buyerLine}${usernameLine}\n` +
    `Время оформления: ${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}`;

  try {
    const ownerMessage = await sendTelegramMessage({
      chatId: ownerUserId,
      text: ownerText,
      replyMarkup: {
        inline_keyboard: [
          [
            { text: "Подтвердить", url: approveUrl },
            { text: "Отказать", url: rejectUrl },
          ],
        ],
      },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        ownerMessageId: ownerMessage.result?.message_id ?? null,
        notificationStatus: "sent",
        notificationError: null,
      },
    });
  } catch (error) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        notificationStatus: "failed",
        notificationError: error instanceof Error ? error.message : "Owner notification failed",
      },
    });

    return NextResponse.json(
      { ok: false, error: "Owner notification failed" },
      { status: 502 },
    );
  }

  try {
    await sendTelegramMessage({
      chatId: String(auth.user.id),
      text:
        `Твоя заявка создана и ждет решения\n\n` +
        `Номер заявки: ${publicOrderNumber}\n` +
        `Прогулка: ${body.walkDate}, ${body.walkPeriod}\n` +
        `Оплата: ${body.offerPrice}\n\n` +
        `Когда будет решение, бот отдельно напишет результат.`,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        buyerNotificationStatus: "sent",
        buyerNotificationError: null,
      },
    });
  } catch (error) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        buyerNotificationStatus: "failed",
        buyerNotificationError: error instanceof Error ? error.message : "Buyer notification failed",
      },
    });

    return NextResponse.json(
      { ok: false, error: "Buyer notification failed" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, orderId: order.id, orderNumber: publicOrderNumber });
}
