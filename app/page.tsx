'use client'

import { useEffect, useState } from 'react'

type Offer = {
  id: string
  title: string
  description: string
  price: string
  accent: string
}

type WalkPeriod = 'Утренняя' | 'Вечерняя'

type TelegramUser = {
  first_name?: string
  last_name?: string
  username?: string
  id?: number
}

type TelegramWebApp = {
  ready?: () => void
  expand?: () => void
  initData?: string
  initDataUnsafe?: {
    user?: TelegramUser
  }
}

type TelegramWindow = Window & {
  Telegram?: {
    WebApp?: TelegramWebApp
  }
}

const offers: Offer[] = [
  {
    id: 'blowjob',
    title: 'Экспресс-тариф',
    description: 'Вышел спокойно, без торга, с пакетом и поводком.',
    price: '1 минет',
    accent: 'from-rose-400 to-orange-300',
  },
  {
    id: 'massage',
    title: 'Премиум-выгул',
    description: 'Полный круг по району плюс короткий фотоотчет о счастливой собаке.',
    price: '30 минут массажа',
    accent: 'from-amber-300 to-pink-400',
  },
  {
    id: 'breakfast',
    title: 'Sunday Edition',
    description: 'Длинная прогулка, без возмущений, с отдельным бонусом за лужи и дождь.',
    price: 'завтрак в постель',
    accent: 'from-cyan-300 to-blue-400',
  },
]

const walkPeriods: WalkPeriod[] = ['Утренняя', 'Вечерняя']

function getBuyerLabel(user?: TelegramUser) {
  if (!user) return 'Анонимная заказчица'
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim()
  if (fullName) return fullName
  if (user.username) return `@${user.username}`
  if (user.id) return `id:${user.id}`
  return 'Анонимная заказчица'
}

function parseUserFromTelegramParams(rawParams: string) {
  const params = new URLSearchParams(rawParams)
  const rawUser = params.get('user')

  if (!rawUser) {
    return undefined
  }

  try {
    return JSON.parse(rawUser) as TelegramUser
  } catch {
    return undefined
  }
}

function getTelegramUser() {
  const telegram = (window as TelegramWindow).Telegram?.WebApp
  const sdkUser = telegram?.initDataUnsafe?.user

  if (sdkUser) {
    return sdkUser
  }

  if (telegram?.initData) {
    const parsedUser = parseUserFromTelegramParams(telegram.initData)
    if (parsedUser) {
      return parsedUser
    }
  }

  const searchUser = parseUserFromTelegramParams(window.location.search.slice(1))
  if (searchUser) {
    return searchUser
  }

  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
  return parseUserFromTelegramParams(hash)
}

function getDefaultWalkSlot() {
  const now = new Date()
  const timezoneOffset = now.getTimezoneOffset()
  const localTime = new Date(now.getTime() - timezoneOffset * 60_000)
  return localTime.toISOString().slice(0, 10)
}

function formatWalkDate(value: string) {
  const date = new Date(`${value}T12:00:00`)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    weekday: 'long',
  }).format(date)
}

export default function Page() {
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null)
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [buyer, setBuyer] = useState<TelegramUser | undefined>()
  const [walkDate, setWalkDate] = useState(getDefaultWalkSlot)
  const [walkPeriod, setWalkPeriod] = useState<WalkPeriod>('Вечерняя')
  const [customPayment, setCustomPayment] = useState('')

  useEffect(() => {
    const telegram = (window as TelegramWindow).Telegram?.WebApp
    telegram?.ready?.()
    telegram?.expand?.()
    setBuyer(getTelegramUser())
  }, [])

  async function submitOrder(offer: Offer) {
    if (!walkDate || !walkPeriod) {
      setStatus('error')
      setMessage('Сначала выбери дату и тип прогулки.')
      return
    }

    if (!buyer?.id) {
      setStatus('error')
      setMessage('Открой приложение через Telegram-бота, чтобы он мог присылать тебе уведомления.')
      return
    }

    setSelectedOffer(offer)
    setStatus('sending')
    setMessage('')

    try {
      const response = await fetch('/api/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          offerId: offer.id,
          offerTitle: offer.title,
          offerPrice: offer.price,
          walkDate: formatWalkDate(walkDate),
          walkPeriod,
          buyer: getBuyerLabel(buyer),
          username: buyer?.username ?? null,
          buyerTelegramId: String(buyer.id),
        }),
      })

      if (!response.ok) {
        throw new Error('Не удалось отправить уведомление')
      }

      setStatus('done')
      setMessage(
        `Заявка на "${offer.title}" на ${formatWalkDate(walkDate)}, ${walkPeriod.toLowerCase()} оформлена. Бот написал вам обоим и теперь ждет твоего решения.`,
      )
    } catch {
      setStatus('error')
      setMessage('Не получилось отправить уведомление. Проверь токен бота и chat id.')
    }
  }

  async function submitCustomPayment() {
    const normalizedPayment = customPayment.trim()

    if (!normalizedPayment) {
      setStatus('error')
      setMessage('Сначала впиши свой вариант оплаты.')
      return
    }

    await submitOrder({
      id: 'custom-offer',
      title: 'Индивидуальное предложение',
      description: normalizedPayment,
      price: normalizedPayment,
      accent: 'from-lime-300 to-emerald-400',
    })
  }

  return (
    <main className='shell'>
      <section className='hero-card'>
        <div className='hero-noise' />
        <div className='hero-copy'>
          <p className='eyebrow'>Domestic diplomacy service</p>
          <h1>Кто гуляет с собакой сегодня?</h1>
          <p className='lede'>
            Когда спорить уже лень, можно оформить официальную заявку на выгул и выбрать максимально
            приятный способ оплаты.
          </p>
          <button
            className='purchase-button'
            type='button'
            onClick={() => {
              const priceList = document.getElementById('price-list')
              priceList?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
          >
            Оформить покупку прогулки
          </button>
        </div>
        <div
          className='cover-art'
          aria-hidden='true'
        >
          <div
            className='dog-badge'
            style={{
              backgroundImage: 'url(/dog-walker.png)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              color: 'tomato'
            }}
          >
          </div>
          <div className='ticket'>
            <span>TONIGHT</span>
            <strong>1 прогулка</strong>
            <small>без препирательств и драм</small>
          </div>
        </div>
      </section>

      <section
        id='price-list'
        className='pricing-card'
      >
        <div className='section-head'>
          <p className='eyebrow'>Меню оплаты</p>
          <h2>Выбери тариф, который сегодня особенно удобен</h2>
        </div>

        <div className='buyer-pill'>
          Покупатель: <strong>{getBuyerLabel(buyer)}</strong>
        </div>

        <div className='schedule-card'>
          <div style={{placeSelf: 'baseline'}}>
            <p className='schedule-label'>Когда нужна прогулка</p>
            <p className='schedule-hint'>Выбери дату и формат прогулки: утренняя или вечерняя.</p>
          </div>
          <div className='schedule-controls'>
            <label className='schedule-input-wrap'>
              <span>Дата</span>
              <input
                className='schedule-input'
                type='date'
                value={walkDate}
                onChange={event => setWalkDate(event.target.value)}
              />
            </label>

            <div className='schedule-input-wrap'>
              <span>Тип прогулки</span>
              <div
                className='time-grid'
                role='list'
                aria-label='Выбор типа прогулки'
              >
                {walkPeriods.map(period => (
                  <button
                    key={period}
                    type='button'
                    className={`time-chip ${walkPeriod === period ? 'active' : ''}`}
                    onClick={() => setWalkPeriod(period)}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className='offers-grid'>
          {offers.map(offer => (
            <article
              key={offer.id}
              className='offer-card'
            >
              <div className={`offer-accent ${offer.accent}`} />
              <p className='offer-title'>{offer.title}</p>
              <p className='offer-price'>{offer.price}</p>
              <p className='offer-description'>{offer.description}</p>
              <button
                type='button'
                className='offer-button'
                onClick={() => void submitOrder(offer)}
                disabled={status === 'sending'}
              >
                {status === 'sending' && selectedOffer?.id === offer.id
                  ? 'Отправляю...'
                  : 'Выбрать этот способ'}
              </button>
            </article>
          ))}
        </div>

        <div className='custom-offer-card'>
          <p className='offer-title'>Свой вариант</p>
          <p className='custom-offer-copy'>
            Если стандартные тарифы не подходят, можно предложить свою оплату. Твой партнер решит,
            принять это предложение или отклонить.
          </p>
          <textarea
            className='custom-offer-input'
            placeholder='Например: ужин + массаж + я сама мою лапы после прогулки'
            value={customPayment}
            onChange={event => setCustomPayment(event.target.value)}
            rows={4}
          />
          <button
            type='button'
            className='offer-button custom-offer-button'
            onClick={() => void submitCustomPayment()}
            disabled={status === 'sending'}
          >
            {status === 'sending' && selectedOffer?.id === 'custom-offer'
              ? 'Отправляю...'
              : 'Предложить свой вариант'}
          </button>
        </div>

        <div className={`status-panel ${status}`}>
          <span className='status-label'>Статус</span>
          <p>
            {message ||
              'После оформления бот напишет вам обоим. Затем ты подтвердишь или отклонишь заявку из своего чата.'}
          </p>
        </div>
      </section>
    </main>
  )
}
