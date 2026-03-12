'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'

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

type FetchOptions = RequestInit & {
  headers?: HeadersInit
}

const offers: Offer[] = [
  {
    id: 'blowjob',
    title: 'Экспресс-тариф',
    description: 'Вышел спокойно, без торга, с пакетом и поводком.',
    price: '1 минет',
    accent: 'from-rose-400 via-orange-300 to-amber-200',
  },
  {
    id: 'massage',
    title: 'Премиум-выгул',
    description: 'Полный круг по району плюс короткий фотоотчет о счастливой собаке.',
    price: '30 минут массажа',
    accent: 'from-amber-300 via-pink-300 to-fuchsia-400',
  },
  {
    id: 'breakfast',
    title: 'Sunday Edition',
    description: 'Длинная прогулка, без возмущений, с отдельным бонусом за лужи и дождь.',
    price: 'завтрак в постель',
    accent: 'from-cyan-300 via-sky-400 to-blue-500',
  },
]

const walkPeriods: WalkPeriod[] = ['Утренняя', 'Вечерняя']
const calendarWeekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

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

function getTelegramInitData() {
  const telegram = (window as TelegramWindow).Telegram?.WebApp
  return telegram?.initData ?? ''
}

function getDefaultWalkDate() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

function getMonthLabel(date: Date) {
  return new Intl.DateTimeFormat('ru-RU', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function toIsoDate(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

function getCalendarDays(monthCursor: Date) {
  const startOfMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1)
  const endOfMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0)
  const startOffset = (startOfMonth.getDay() + 6) % 7
  const days: Array<{ date: Date; currentMonth: boolean }> = []

  for (let index = startOffset; index > 0; index -= 1) {
    const date = new Date(startOfMonth)
    date.setDate(startOfMonth.getDate() - index)
    days.push({ date, currentMonth: false })
  }

  for (let day = 1; day <= endOfMonth.getDate(); day += 1) {
    days.push({
      date: new Date(monthCursor.getFullYear(), monthCursor.getMonth(), day),
      currentMonth: true,
    })
  }

  while (days.length % 7 !== 0) {
    const date = new Date(endOfMonth)
    date.setDate(endOfMonth.getDate() + (days.length % 7) + 1)
    days.push({ date, currentMonth: false })
  }

  return days
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

const reveal = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
}

export default function Page() {
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null)
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  const [buyer, setBuyer] = useState<TelegramUser | undefined>()
  const [walkDate, setWalkDate] = useState('')
  const [walkPeriod, setWalkPeriod] = useState<WalkPeriod>('Вечерняя')
  const [customPayment, setCustomPayment] = useState('')
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [monthCursor, setMonthCursor] = useState<Date | null>(null)
  const [todayIso, setTodayIso] = useState('')
  const [telegramInitData, setTelegramInitData] = useState('')
  const calendarDays = useMemo(
    () => (monthCursor ? getCalendarDays(monthCursor) : []),
    [monthCursor],
  )

  useEffect(() => {
    const telegram = (window as TelegramWindow).Telegram?.WebApp
    telegram?.ready?.()
    telegram?.expand?.()
    setBuyer(getTelegramUser())
    setTelegramInitData(getTelegramInitData())
    const defaultDate = getDefaultWalkDate()
    const now = new Date()
    setTodayIso(defaultDate)
    setWalkDate(defaultDate)
    setMonthCursor(new Date(now.getFullYear(), now.getMonth(), 1))
  }, [])

  async function telegramFetch(input: string, init?: FetchOptions) {
    const headers = new Headers(init?.headers)
    const resolvedInitData = telegramInitData || getTelegramInitData()

    if (resolvedInitData) {
      headers.set('x-telegram-init-data', resolvedInitData)
    }

    return fetch(input, {
      ...init,
      headers,
    })
  }

  async function submitOrder(offer: Offer) {
    if (!walkDate || !walkPeriod) {
      setStatus('error')
      setMessage('Сначала выбери день и тип прогулки.')
      return
    }

    if (!buyer?.id) {
      setStatus('error')
      setMessage(
        'Открой приложение через Telegram, чтобы бот мог отправлять уведомления вам обоим.',
      )
      return
    }

    setSelectedOffer(offer)
    setStatus('sending')
    setMessage('')
    setIsStatusModalOpen(true)

    try {
      const response = await telegramFetch('/api/order', {
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
        }),
      })

      if (!response.ok) {
        throw new Error('Не удалось создать заявку')
      }

      setStatus('done')
      setMessage(
        `Заявка на "${offer.title}" оформлена: ${formatWalkDate(walkDate)}, ${walkPeriod.toLowerCase()}. Бот уже написал вам обоим.`,
      )
    } catch {
      setStatus('error')
      setMessage('Не получилось отправить заявку. Проверь настройки бота, базы и Vercel env.')
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
      accent: 'from-lime-300 via-emerald-300 to-teal-400',
    })
  }

  return (
    <main className='bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.22),transparent_26%),radial-gradient(circle_at_85%_20%,rgba(253,186,116,0.22),transparent_20%),linear-gradient(180deg,#07111f_0%,#140c1e_52%,#070d18_100%)]'>
      {isStatusModalOpen ? (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-md'>
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className='modal-box w-full max-w-lg rounded-4xl border border-white/10 bg-[#120f1f]/95 p-0 shadow-2xl'
          >
            <div
              className={`h-2 w-full ${
                status === 'done'
                  ? 'bg-linear-to-r from-emerald-300 via-lime-300 to-teal-400'
                  : status === 'error'
                    ? 'bg-linear-to-r from-rose-400 via-orange-300 to-amber-300'
                    : 'bg-linear-to-r from-sky-400 via-cyan-300 to-violet-400'
              }`}
            />
            <div className='space-y-5 p-6 sm:p-7'>
              <div className='flex items-start justify-between gap-4'>
                <div className='space-y-2'>
                  <div className='badge badge-outline border-white/15 bg-white/5 px-4 py-3 uppercase tracking-[0.24em] text-white/65'>
                    {status === 'sending' ? 'Оформляю' : status === 'done' ? 'Готово' : 'Ошибка'}
                  </div>
                  <h3 className='text-3xl font-black text-white'>
                    {status === 'sending'
                      ? 'Отправляю заявку'
                      : status === 'done'
                        ? 'Заявка оформлена'
                        : 'Не удалось оформить'}
                  </h3>
                </div>
                <button
                  type='button'
                  className='btn btn-circle btn-ghost text-white/60 hover:bg-white/10'
                  onClick={() => {
                    if (status !== 'sending') {
                      setIsStatusModalOpen(false)
                    }
                  }}
                  disabled={status === 'sending'}
                  aria-label='Закрыть окно статуса'
                >
                  ✕
                </button>
              </div>

              <div
                className={`rounded-3xl border p-4 text-base leading-8 ${
                  status === 'done'
                    ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-50'
                    : status === 'error'
                      ? 'border-rose-300/20 bg-rose-400/10 text-rose-50'
                      : 'border-white/10 bg-white/5 text-white/75'
                }`}
              >
                {message ||
                  'Связываюсь с базой, Telegram и ботом. Обычно это занимает пару секунд.'}
              </div>

              <div className='flex justify-end'>
                {status === 'sending' ? (
                  <span className='loading loading-dots loading-md text-warning' />
                ) : (
                  <button
                    type='button'
                    className='btn btn-warning rounded-full px-8 text-neutral'
                    onClick={() => setIsStatusModalOpen(false)}
                  >
                    Понятно
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}

      <div className='pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size-[24px_24px] opacity-20' />
      <div className='mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6'>
        <motion.section
          variants={reveal}
          initial='hidden'
          animate='visible'
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className='hero min-h-128 overflow-hidden rounded-4xl border border-white/10 bg-base-100/8 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl'
        >
          <div className='hero-content grid w-full max-w-none gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-10'>
            <div className='flex flex-col justify-center gap-6'>
              <div className='badge badge-warning badge-outline w-fit gap-2 px-4 py-4 text-[0.7rem] uppercase tracking-[0.35em]'>
                Domestic diplomacy service
              </div>
              <div className='space-y-4'>
                <h1 className='max-w-[10ch] text-5xl font-black leading-[0.9] tracking-tight text-white sm:text-6xl lg:text-7xl'>
                  Кто гуляет с собакой сегодня?
                </h1>
                <p className='max-w-2xl text-lg leading-8 text-white/70 sm:text-xl'>
                  Когда спор уже зашел слишком далеко, оформляй официальную заявку на выгул, выбирай
                  тариф или предлагай свою цену, а решение прилетит прямо в Telegram.
                </p>
              </div>
              <div className='flex flex-wrap gap-3'>
                <button
                  type='button'
                  className='btn btn-warning btn-lg rounded-full px-8 text-base font-semibold text-neutral'
                  onClick={() => {
                    const priceList = document.getElementById('price-list')
                    priceList?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                >
                  Оформить покупку прогулки
                </button>
                <div className='badge badge-lg rounded-full border-white/10 bg-white/6 px-5 py-5 text-white/70'>
                  Покупатель:{' '}
                  <span className='ml-2 font-semibold text-white'>{getBuyerLabel(buyer)}</span>
                </div>
              </div>
            </div>

            <div className='relative flex items-center justify-center'>
              <motion.div
                initial={{ opacity: 0, scale: 0.94, rotate: -4 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ delay: 0.15, duration: 0.7, ease: 'easeOut' }}
                className='relative w-full max-w-md'
              >
                <div className='absolute inset-0 rounded-[2.5rem] bg-linear-to-br from-sky-400/30 via-transparent to-warning/30 blur-3xl' />
                <div className='card overflow-hidden rounded-[2.5rem] border border-white/15 bg-white/8 shadow-2xl backdrop-blur-2xl'>
                  <figure className='relative aspect-square w-full bg-linear-to-br from-sky-200 via-cyan-100 to-warning/30 p-4'>
                    <Image
                      src='/dog-walker.png'
                      alt='LuckyWalker dog'
                      fill
                      className='rounded-4xl object-cover'
                      priority
                    />
                  </figure>
                  <div className='card-body gap-4'>
                    <div className='flex items-center justify-between'>
                      <div>
                        <p className='text-xs uppercase tracking-[0.3em] text-warning'>
                          LuckyWalker
                        </p>
                        <h2 className='text-3xl font-black text-white'>1 прогулка</h2>
                      </div>
                      <div className='badge badge-accent badge-lg rounded-full px-4 py-4 text-accent-content'>
                        mini app
                      </div>
                    </div>
                    <p className='text-base leading-7 text-white/70'>
                      Собака довольна, спор снят с повестки, а условия сделки закреплены официально.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.section>

        <motion.section
          id='price-list'
          variants={reveal}
          initial='hidden'
          animate='visible'
          transition={{ delay: 0.12, duration: 0.5, ease: 'easeOut' }}
          className='space-y-6 rounded-4xl border border-white/10 bg-base-100/8 p-4 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-6'
        >
          <div className='flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
            <div className='space-y-3'>
              <div className='badge badge-secondary badge-outline w-fit gap-2 px-4 py-4 text-[0.7rem] uppercase tracking-[0.35em]'>
                Меню оплаты
              </div>
              <h2 className='max-w-3xl text-4xl font-black leading-tight text-white sm:text-5xl'>
                Выбери день, формат прогулки и тариф, который сегодня особенно удобен
              </h2>
            </div>
          </div>

          <div className='grid gap-4'>
            <div className='card border border-white/10 bg-base-100/12 shadow-xl'>
              <div className='card-body gap-6'>
                <div className='space-y-2'>
                  <h3 className='text-2xl font-bold text-white'>Когда нужна прогулка</h3>
                </div>

                <div className='space-y-3'>
                  <p className='text-sm font-semibold uppercase tracking-[0.24em] text-white/50'>
                    День
                  </p>
                  <div className='dropdown w-full'>
                    <button
                      type='button'
                      className='input input-xl flex h-auto min-h-20 w-full items-center justify-between rounded-[1.75rem] border-white/10 bg-black/20 px-5 py-4 text-left text-white hover:border-warning/50'
                      onClick={() => setIsCalendarOpen(current => !current)}
                    >
                      <div>
                        <div className='text-xs uppercase tracking-[0.24em] text-white/45'>
                          Выбранная дата
                        </div>
                        <div className='mt-2 text-lg font-semibold text-white'>
                          {walkDate ? formatWalkDate(walkDate) : 'Выбери дату прогулки'}
                        </div>
                      </div>
                      <div className='text-sm text-warning'>
                        {isCalendarOpen ? 'Свернуть' : 'Изменить'}
                      </div>
                    </button>

                    {isCalendarOpen && monthCursor ? (
                      <div className='mt-3 w-full rounded-[1.75rem] border border-white/10 bg-[#120f1f]/95 p-4 shadow-2xl backdrop-blur-xl'>
                        <div className='mb-4 flex items-center justify-between gap-3'>
                          <button
                            type='button'
                            className='btn btn-ghost btn-sm rounded-full text-white/70'
                            onClick={() =>
                              setMonthCursor(current =>
                                current
                                  ? new Date(current.getFullYear(), current.getMonth() - 1, 1)
                                  : current,
                              )
                            }
                          >
                            ←
                          </button>
                          <div className='text-sm font-semibold uppercase tracking-[0.24em] text-white/70'>
                            {getMonthLabel(monthCursor)}
                          </div>
                          <button
                            type='button'
                            className='btn btn-ghost btn-sm rounded-full text-white/70'
                            onClick={() =>
                              setMonthCursor(current =>
                                current
                                  ? new Date(current.getFullYear(), current.getMonth() + 1, 1)
                                  : current,
                              )
                            }
                          >
                            →
                          </button>
                        </div>

                        <div className='grid grid-cols-7 gap-2 text-center text-xs uppercase tracking-[0.24em] text-white/35'>
                          {calendarWeekdays.map(day => (
                            <div
                              key={day}
                              className='py-2'
                            >
                              {day}
                            </div>
                          ))}
                        </div>

                        <div className='grid grid-cols-7 gap-2'>
                          {calendarDays.map(({ date, currentMonth }) => {
                            const iso = toIsoDate(date)
                            const selected = iso === walkDate
                            const today = todayIso ? iso === todayIso : false

                            return (
                              <button
                                key={iso}
                                type='button'
                                onClick={() => {
                                  setWalkDate(iso)
                                  setIsCalendarOpen(false)
                                }}
                                className={`aspect-square rounded-2xl text-sm font-semibold transition ${
                                  selected
                                    ? 'bg-warning text-neutral shadow-lg shadow-warning/20'
                                    : currentMonth
                                      ? 'bg-white/5 text-white hover:bg-white/10'
                                      : 'bg-transparent text-white/25 hover:bg-white/5'
                                } ${today && !selected ? 'ring-1 ring-warning/40' : ''}`}
                              >
                                {date.getDate()}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className='space-y-3'>
                  <p className='text-sm font-semibold uppercase tracking-[0.24em] text-white/50'>
                    Тип прогулки
                  </p>
                  <div className='grid gap-3 sm:grid-cols-2'>
                    {walkPeriods.map(period => (
                      <button
                        key={period}
                        type='button'
                        onClick={() => setWalkPeriod(period)}
                        className={`rounded-3xl border px-5 py-5 text-left transition ${
                          walkPeriod === period
                            ? 'border-transparent bg-linear-to-r from-warning to-orange-400 text-neutral shadow-xl shadow-orange-500/20'
                            : 'border-white/10 bg-white/5 text-white hover:border-white/20 hover:bg-white/10'
                        }`}
                      >
                        <div className='text-lg font-bold'>{period}</div>
                        <div className='mt-1 text-sm opacity-75'>
                          {period === 'Утренняя'
                            ? 'Для ранних договоренностей и собаки с планами.'
                            : 'Когда день уже всех утомил и пора решить вопрос красиво.'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className='grid gap-4 lg:grid-cols-3'>
            {offers.map((offer, index) => (
              <motion.article
                key={offer.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * index, duration: 0.4, ease: 'easeOut' }}
                className='card overflow-hidden border border-white/10 bg-base-100/10 shadow-xl'
              >
                <div className={`h-2 w-full bg-linear-to-r ${offer.accent}`} />
                <div className='card-body gap-5'>
                  <div className='space-y-3'>
                    <p className='text-xs uppercase tracking-[0.3em] text-white/50'>
                      {offer.title}
                    </p>
                    <h3 className='text-4xl font-black leading-none text-white'>{offer.price}</h3>
                    <p className='min-h-24 text-base leading-8 text-white/70'>
                      {offer.description}
                    </p>
                  </div>
                  <button
                    type='button'
                    className='mt-auto btn btn-outline btn-lg rounded-full border-white/15 bg-white/5 text-white hover:border-warning hover:bg-warning hover:text-neutral'
                    onClick={() => void submitOrder(offer)}
                    disabled={status === 'sending'}
                  >
                    {status === 'sending' && selectedOffer?.id === offer.id
                      ? 'Отправляю...'
                      : 'Выбрать этот способ'}
                  </button>
                </div>
              </motion.article>
            ))}
          </div>

          <motion.section
            variants={reveal}
            initial='hidden'
            animate='visible'
            transition={{ delay: 0.2, duration: 0.45, ease: 'easeOut' }}
            className='grid gap-4 lg:grid-cols-1'
          >
            <div className='card border border-emerald-300/15 bg-linear-to-br from-emerald-400/10 via-base-100/10 to-teal-400/10 shadow-xl'>
              <div className='card-body gap-5'>
                <div className='space-y-2'>
                  <p className='text-xs uppercase tracking-[0.3em] text-emerald-300'>
                    Свой вариант
                  </p>
                  <h3 className='text-3xl font-black text-white'>Предложить свой вариант оплаты</h3>
                </div>
                <textarea
                  className='w-full textarea h-36 rounded-3xl border-white/10 bg-black/20 text-base text-white placeholder:text-white/35 focus:border-emerald-300'
                  placeholder='Например: я приготовлю ужин, сама вымою лапы после прогулки и не трогаю тебя весь вечер'
                  value={customPayment}
                  onChange={event => setCustomPayment(event.target.value)}
                />
                <button
                  type='button'
                  className='btn btn-success btn-lg rounded-full text-base text-neutral'
                  onClick={() => void submitCustomPayment()}
                  disabled={status === 'sending'}
                >
                  {status === 'sending' && selectedOffer?.id === 'custom-offer'
                    ? 'Отправляю...'
                    : 'Предложить свой вариант'}
                </button>
              </div>
            </div>
          </motion.section>
        </motion.section>
      </div>
    </main>
  )
}
