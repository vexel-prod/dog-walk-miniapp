import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type OrderPayload = {
  offerId?: string;
  offerTitle?: string;
  offerPrice?: string;
  walkAt?: string;
  buyer?: string;
  username?: string | null;
  buyerTelegramId?: string | null;
};

export async function POST(request: Request) {
  const body = (await request.json()) as OrderPayload;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_OWNER_CHAT_ID;
  const databaseUrl = process.env.DATABASE_URL;

  if (!botToken || !chatId || !databaseUrl) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing TELEGRAM_BOT_TOKEN, TELEGRAM_OWNER_CHAT_ID, or DATABASE_URL",
      },
      { status: 500 },
    );
  }

  if (!body.offerId || !body.offerTitle || !body.offerPrice || !body.walkAt) {
    return NextResponse.json({ ok: false, error: "Missing order data" }, { status: 400 });
  }

  const buyerLine = body.buyer ?? "Неизвестный покупатель";
  const usernameLine = body.username ? `\nUsername: @${body.username}` : "";
  const order = await prisma.order.create({
    data: {
      offerId: body.offerId,
      offerTitle: body.offerTitle,
      offerPrice: body.offerPrice,
      walkAtLabel: body.walkAt,
      buyerName: buyerLine,
      buyerUsername: body.username ?? null,
      buyerTelegramId: body.buyerTelegramId ?? null,
    },
  });

  const text =
    `Новая заявка на прогулку с собакой\n\n` +
    `ID заявки: ${order.id}\n` +
    `Тариф: ${body.offerTitle}\n` +
    `Оплата: ${body.offerPrice}\n` +
    `Когда гулять: ${body.walkAt}\n` +
    `Покупатель: ${buyerLine}${usernameLine}\n` +
    `Время: ${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}`;

  const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });

  if (!telegramResponse.ok) {
    const errorText = await telegramResponse.text();
    await prisma.order.update({
      where: { id: order.id },
      data: {
        notificationStatus: "failed",
        notificationError: errorText,
      },
    });

    return NextResponse.json(
      { ok: false, error: "Telegram request failed", detail: errorText },
      { status: 502 },
    );
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      notificationStatus: "sent",
      notificationError: null,
    },
  });

  return NextResponse.json({ ok: true, orderId: order.id });
}
