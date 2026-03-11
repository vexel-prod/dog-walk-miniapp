type TelegramSendOptions = {
  chatId: string;
  text: string;
  replyMarkup?: Record<string, unknown>;
};

export async function sendTelegramMessage({
  chatId,
  text,
  replyMarkup,
}: TelegramSendOptions) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN");
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: replyMarkup,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Telegram request failed");
  }

  return response.json();
}
