import { getPrisma } from "@/lib/prisma";
import { formatOrderNumber } from "@/lib/order-format";
import { type OrderDecision, verifyDecisionToken } from "@/lib/order-approval";
import { editTelegramMessage, sendTelegramMessage } from "@/lib/telegram";

function renderHtml(title: string, description: string) {
  return new Response(
    `<!doctype html>
    <html lang="ru">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
        <style>
          body{margin:0;min-height:100vh;display:grid;place-items:center;background:#120f17;color:#fff4e8;font-family:ui-sans-serif,system-ui,sans-serif}
          main{width:min(92vw,560px);padding:28px;border-radius:28px;background:rgba(23,18,35,.88);border:1px solid rgba(255,255,255,.08)}
          h1{margin:0 0 12px;font-size:2rem}
          p{margin:0;color:#d4c4d6;line-height:1.5}
        </style>
      </head>
      <body>
        <main>
          <h1>${title}</h1>
          <p>${description}</p>
        </main>
      </body>
    </html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    },
  );
}

export async function GET(request: Request) {
  const prisma = getPrisma();
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");
  const decision = searchParams.get("decision") as OrderDecision | null;
  const token = searchParams.get("token");

  if (!orderId || !decision || !token || !["approved", "rejected"].includes(decision)) {
    return renderHtml("Ссылка невалидна", "Не хватает данных для обработки решения.");
  }

  if (!verifyDecisionToken(orderId, decision, token)) {
    return renderHtml("Доступ запрещен", "Токен подтверждения не подошел.");
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });

  if (!order) {
    return renderHtml("Заявка не найдена", "Возможно, она уже была удалена.");
  }

  if (order.status !== "pending") {
    const title = order.status === "approved" ? "Уже подтверждено" : "Уже отклонено";
    return renderHtml(title, `Заявка уже обработана. Текущий статус: ${order.status}.`);
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: decision,
      decisionAt: new Date(),
    },
  });

  if (updatedOrder.ownerMessageId && process.env.TELEGRAM_OWNER_CHAT_ID) {
    const ownerWalkLabel = [updatedOrder.walkDateLabel, updatedOrder.walkPeriodLabel]
      .filter(Boolean)
      .join(", ");
    const ownerDecisionLabel = decision === "approved" ? "Подтверждено" : "Отклонено";
    const publicOrderNumber = formatOrderNumber(updatedOrder.orderNumber);

    try {
      await editTelegramMessage({
        chatId: process.env.TELEGRAM_OWNER_CHAT_ID,
        messageId: updatedOrder.ownerMessageId,
        text:
          `Заявка обработана\n\n` +
          `Статус: ${ownerDecisionLabel}\n` +
          `Заявка: ${publicOrderNumber}\n` +
          `Тариф: ${updatedOrder.offerTitle}\n` +
          `Оплата: ${updatedOrder.offerPrice}\n` +
          `Когда гулять: ${ownerWalkLabel || "не указано"}\n` +
          `Покупатель: ${updatedOrder.buyerName}\n` +
          `Решение принято: ${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}`,
      });
    } catch {
      // If Telegram message edit fails, keep the DB state and buyer notification flow intact.
    }
  }

  if (updatedOrder.buyerTelegramId) {
    const walkLabel = [updatedOrder.walkDateLabel, updatedOrder.walkPeriodLabel]
      .filter(Boolean)
      .join(", ");
    const publicOrderNumber = formatOrderNumber(updatedOrder.orderNumber);
    const buyerText =
      decision === "approved"
        ? `Твоя заявка подтверждена\n\nНомер заявки: ${publicOrderNumber}\nПрогулка: ${walkLabel || "время не указано"}\nОплата: ${updatedOrder.offerPrice}`
        : `Твоя заявка отклонена\n\nНомер заявки: ${publicOrderNumber}\nПрогулка: ${walkLabel || "время не указано"}\nПредложенная оплата: ${updatedOrder.offerPrice}`;

    try {
      await sendTelegramMessage({
        chatId: updatedOrder.buyerTelegramId,
        text: buyerText,
      });

      await prisma.order.update({
        where: { id: orderId },
        data: {
          buyerNotificationStatus: "sent",
          buyerNotificationError: null,
        },
      });
    } catch (error) {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          buyerNotificationStatus: "failed",
          buyerNotificationError: error instanceof Error ? error.message : "Unknown buyer notify error",
        },
      });
    }
  }

  return renderHtml(
    decision === "approved" ? "Заявка подтверждена" : "Заявка отклонена",
    "Решение сохранено. Бот отправил покупателю соответствующее уведомление, если его чат доступен.",
  );
}
