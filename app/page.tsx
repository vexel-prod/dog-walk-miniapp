"use client";

import { useEffect, useState } from "react";

type Offer = {
  id: string;
  title: string;
  description: string;
  price: string;
  accent: string;
};

type TelegramUser = {
  first_name?: string;
  last_name?: string;
  username?: string;
  id?: number;
};

type TelegramWebApp = {
  ready?: () => void;
  expand?: () => void;
  initData?: string;
  initDataUnsafe?: {
    user?: TelegramUser;
  };
};

type TelegramWindow = Window & {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
};

const offers: Offer[] = [
  {
    id: "blowjob",
    title: "Экспресс-тариф",
    description: "Вышел спокойно, без торга, с пакетом и поводком.",
    price: "1 минет",
    accent: "from-rose-400 to-orange-300",
  },
  {
    id: "massage",
    title: "Премиум-выгул",
    description: "Полный круг по району плюс короткий фотоотчет о счастливой собаке.",
    price: "30 минут массажа",
    accent: "from-amber-300 to-pink-400",
  },
  {
    id: "breakfast",
    title: "Sunday Edition",
    description: "Длинная прогулка, без возмущений, с отдельным бонусом за лужи и дождь.",
    price: "завтрак в постель",
    accent: "from-cyan-300 to-blue-400",
  },
];

const timeOptions = [
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "12:00",
  "14:00",
  "16:00",
  "18:00",
  "20:00",
  "22:00",
];

function getBuyerLabel(user?: TelegramUser) {
  if (!user) return "Анонимная заказчица";
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  if (user.username) return `@${user.username}`;
  if (user.id) return `id:${user.id}`;
  return "Анонимная заказчица";
}

function parseUserFromTelegramParams(rawParams: string) {
  const params = new URLSearchParams(rawParams);
  const rawUser = params.get("user");

  if (!rawUser) {
    return undefined;
  }

  try {
    return JSON.parse(rawUser) as TelegramUser;
  } catch {
    return undefined;
  }
}

function getTelegramUser() {
  const telegram = (window as TelegramWindow).Telegram?.WebApp;
  const sdkUser = telegram?.initDataUnsafe?.user;

  if (sdkUser) {
    return sdkUser;
  }

  if (telegram?.initData) {
    const parsedUser = parseUserFromTelegramParams(telegram.initData);
    if (parsedUser) {
      return parsedUser;
    }
  }

  const searchUser = parseUserFromTelegramParams(window.location.search.slice(1));
  if (searchUser) {
    return searchUser;
  }

  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  return parseUserFromTelegramParams(hash);
}

function getDefaultWalkSlot() {
  const now = new Date();
  now.setHours(now.getHours() + 1, 0, 0, 0);
  const timezoneOffset = now.getTimezoneOffset();
  const localTime = new Date(now.getTime() - timezoneOffset * 60_000);
  return {
    date: localTime.toISOString().slice(0, 10),
    time: localTime.toISOString().slice(11, 16),
  };
}

function combineWalkSlot(date: string, time: string) {
  if (!date || !time) {
    return "";
  }

  return `${date}T${time}`;
}

function formatWalkSlot(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "long",
  }).format(date);
}

export default function Page() {
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [buyer, setBuyer] = useState<TelegramUser | undefined>();
  const [walkDate, setWalkDate] = useState(() => getDefaultWalkSlot().date);
  const [walkTime, setWalkTime] = useState(() => getDefaultWalkSlot().time);

  useEffect(() => {
    const telegram = (window as TelegramWindow).Telegram?.WebApp;
    telegram?.ready?.();
    telegram?.expand?.();
    setBuyer(getTelegramUser());
  }, []);

  async function submitOrder(offer: Offer) {
    const walkAt = combineWalkSlot(walkDate, walkTime);

    if (!walkAt) {
      setStatus("error");
      setMessage("Сначала выбери дату и время прогулки.");
      return;
    }

    setSelectedOffer(offer);
    setStatus("sending");
    setMessage("");

    try {
      const response = await fetch("/api/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          offerId: offer.id,
          offerTitle: offer.title,
          offerPrice: offer.price,
          walkAt: formatWalkSlot(walkAt),
          buyer: getBuyerLabel(buyer),
          username: buyer?.username ?? null,
          buyerTelegramId: buyer?.id ? String(buyer.id) : null,
        }),
      });

      if (!response.ok) {
        throw new Error("Не удалось отправить уведомление");
      }

      setStatus("done");
      setMessage(
        `Заявка на "${offer.title}" на ${formatWalkSlot(walkAt)} оформлена. Уведомление уже улетело.`,
      );
    } catch {
      setStatus("error");
      setMessage("Не получилось отправить уведомление. Проверь токен бота и chat id.");
    }
  }

  return (
    <main className="shell">
      <section className="hero-card">
        <div className="hero-noise" />
        <div className="hero-copy">
          <p className="eyebrow">Domestic diplomacy service</p>
          <h1>Кто гуляет с собакой сегодня?</h1>
          <p className="lede">
            Когда спорить уже лень, можно оформить официальную заявку на выгул и выбрать
            максимально приятный способ оплаты.
          </p>
          <button
            className="purchase-button"
            type="button"
            onClick={() => {
              const priceList = document.getElementById("price-list");
              priceList?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            Оформить покупку прогулки
          </button>
        </div>
        <div className="cover-art" aria-hidden="true">
          <div className="dog-badge">DOG WALK</div>
          <div className="ticket">
            <span>TONIGHT</span>
            <strong>1 прогулка</strong>
            <small>без препирательств и драм</small>
          </div>
        </div>
      </section>

      <section id="price-list" className="pricing-card">
        <div className="section-head">
          <p className="eyebrow">Меню оплаты</p>
          <h2>Выбери тариф, который сегодня особенно удобен</h2>
        </div>

        <div className="buyer-pill">
          Покупатель: <strong>{getBuyerLabel(buyer)}</strong>
        </div>

        <div className="schedule-card">
          <div>
            <p className="schedule-label">Когда нужна прогулка</p>
            <p className="schedule-hint">
              Выберите дату и ткните в удобное время. Так намного удобнее, чем системный picker
              внутри Telegram.
            </p>
          </div>
          <div className="schedule-controls">
            <label className="schedule-input-wrap">
              <span>Дата</span>
              <input
                className="schedule-input"
                type="date"
                value={walkDate}
                onChange={(event) => setWalkDate(event.target.value)}
              />
            </label>

            <div className="schedule-input-wrap">
              <span>Время</span>
              <div className="time-grid" role="list" aria-label="Выбор времени">
                {timeOptions.map((time) => (
                  <button
                    key={time}
                    type="button"
                    className={`time-chip ${walkTime === time ? "active" : ""}`}
                    onClick={() => setWalkTime(time)}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>

            <label className="schedule-input-wrap">
              <span>Или выбери точное время</span>
              <select
                className="schedule-input schedule-select"
                value={walkTime}
                onChange={(event) => setWalkTime(event.target.value)}
              >
                {timeOptions.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="offers-grid">
          {offers.map((offer) => (
            <article key={offer.id} className="offer-card">
              <div className={`offer-accent ${offer.accent}`} />
              <p className="offer-title">{offer.title}</p>
              <p className="offer-price">{offer.price}</p>
              <p className="offer-description">{offer.description}</p>
              <button
                type="button"
                className="offer-button"
                onClick={() => void submitOrder(offer)}
                disabled={status === "sending"}
              >
                {status === "sending" && selectedOffer?.id === offer.id
                  ? "Отправляю..."
                  : "Выбрать этот способ"}
              </button>
            </article>
          ))}
        </div>

        <div className={`status-panel ${status}`}>
          <span className="status-label">Статус</span>
          <p>{message || "После оформления тебе придет уведомление в Telegram."}</p>
        </div>
      </section>
    </main>
  );
}
