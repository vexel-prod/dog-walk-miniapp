import { getPrisma } from "@/lib/prisma";
import { createDecisionToken } from "@/lib/order-approval";
import { sendTelegramMessage } from "@/lib/telegram";
import { NextResponse } from "next/server";

type OrderPayload = {
  offerId?: string;
  offerTitle?: string;
  offerPrice?: string;
  walkDate?: string;
  walkPeriod?: string;
  buyer?: string;
  username?: string | null;
  buyerTelegramId?: string | null;
};

export async function POST(request: Request) {
  const prisma = getPrisma();
  const body = (await request.json()) as OrderPayload;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_OWNER_CHAT_ID;
  const databaseUrl = process.env.DATABASE_URL;
  const origin = new URL(request.url).origin;

  if (!botToken || !chatId || !databaseUrl) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing TELEGRAM_BOT_TOKEN, TELEGRAM_OWNER_CHAT_ID, or DATABASE_URL",
      },
      { status: 500 },
    );
  }

  if (
    !body.offerId ||
    !body.offerTitle ||
    !body.offerPrice ||
    !body.walkDate ||
    !body.walkPeriod ||
    !body.buyerTelegramId
  ) {
    return NextResponse.json({ ok: false, error: "Missing order data" }, { status: 400 });
  }

  const buyerLine = body.buyer ?? "Неизвестный покупатель";
  const usernameLine = body.username ? `\nUsername: @${body.username}` : "";
  const order = await prisma.order.create({
    data: {
      offerId: body.offerId,
      offerTitle: body.offerTitle,
      offerPrice: body.offerPrice,
      walkDateLabel: body.walkDate,
      walkPeriodLabel: body.walkPeriod,
      buyerName: buyerLine,
      buyerUsername: body.username ?? null,
      buyerTelegramId: body.buyerTelegramId,
    },
  });

  const approveToken = createDecisionToken(order.id, "approved");
  const rejectToken = createDecisionToken(order.id, "rejected");
  const approveUrl = `${origin}/api/order/decision?orderId=${order.id}&decision=approved&token=${approveToken}`;
  const rejectUrl = `${origin}/api/order/decision?orderId=${order.id}&decision=rejected&token=${rejectToken}`;

  const ownerText =
    `Новая заявка на прогулку с собакой\n\n` +
    `ID заявки: ${order.id}\n` +
    `Тариф: ${body.offerTitle}\n` +
    `Оплата: ${body.offerPrice}\n` +
    `Когда гулять: ${body.walkDate}, ${body.walkPeriod}\n` +
    `Покупатель: ${buyerLine}${usernameLine}\n` +
    `Время оформления: ${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}`;

  try {
    const ownerMessage = await sendTelegramMessage({
      chatId,
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
      chatId: body.buyerTelegramId,
      text:
        `Твоя заявка создана и ждет решения\n\n` +
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

  return NextResponse.json({ ok: true, orderId: order.id });
}
