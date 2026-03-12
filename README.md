# Dog Walk Mini App

Шуточный Telegram Mini App для семейного "магазина" прогулок с собакой. Пользователь выбирает вариант "оплаты", а тебе приходит уведомление в Telegram.

## Что внутри

- стильный одностраничный интерфейс под Telegram Mini App
- кнопка `Оформить покупку прогулки`
- шуточный прайс с тремя тарифами
- дата и время прогулки
- сохранение заявок в Postgres через Prisma
- серверный API `/api/order`, который шлет уведомление тебе в Telegram
- готово для деплоя во Vercel

## Локальный запуск

1. Создай файл `.env` по примеру `.env.example`.
2. Укажи:
   - `TELEGRAM_BOT_TOKEN` - токен твоего бота
   - `TELEGRAM_OWNER_USER_ID` - твой Telegram user id
   - `TELEGRAM_BUYER_USER_ID` - Telegram user id второго участника, который может оформлять заявку
   - `DATABASE_URL` - connection string от Neon
3. Установи зависимости:

```bash
bun install
```

4. Запусти проект:

```bash
bun run dev
```

## Как получить chat id

Самый простой способ:

1. Напиши своему боту любое сообщение.
2. Открой в браузере:

```text
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
```

3. Найди `chat.id` в ответе.

## Подключение как Telegram Mini App

У бота через `@BotFather`:

1. Создай бота через `/newbot`, если его еще нет.
2. Открой `/mybots` -> выбери бота -> `Bot Settings` -> `Menu Button`.
3. Укажи URL задеплоенного приложения во Vercel.

## Деплой во Vercel

Preview deploy:

```bash
vercel deploy . -y
```

После деплоя добавь в Vercel Project Settings -> Environment Variables:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_OWNER_USER_ID`
- `TELEGRAM_BUYER_USER_ID`
- `DATABASE_URL`

Потом сделай redeploy.

Vercel будет использовать рабочий build-скрипт из `package.json`, то есть `next build --webpack`.

## База данных

Для Vercel не используй SQLite для заявок. Здесь целимся в Neon Postgres.

`DATABASE_URL` используется и приложением, и Prisma CLI.

После того как получишь строку подключения, примени схему:

```bash
bunx prisma db push
```

Если захочешь вести историю миграций:

```bash
bunx prisma migrate dev --name init
```

## Что можно быстро докрутить

- добавить экран подтверждения с анимацией
- сделать отдельную админ-панель с историей "покупок"
- добавить больше тарифов и персональные условия
