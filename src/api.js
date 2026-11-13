const STATUS_MESSAGES = {
  400: 'Илгээсэн мэдээллээ шалгаад дахин оролдоно уу.',
  401: 'Нэвтрэх нэр эсвэл нууц үг буруу байна.',
  403: 'Энэ үйлдлийг хийх эрх хүрэлцэхгүй байна.',
  404: 'Хүссэн мэдээлэл олдсонгүй.',
  408: 'Серверийн хариу удааширлаа. Дахин оролдоно уу.',
  429: 'Олон удаа оролдсон байна. Түр хүлээгээд дахин оролдоно уу.',
  500: 'Серверт алдаа гарлаа. Түр хүлээгээд дахин оролдоно уу.',
  502: 'Сервертэй холбогдоход алдаа гарлаа. Түр хүлээгээд дахин оролдоно уу.',
  503: 'Үйлчилгээ түр боломжгүй байна. Дараа дахин оролдоно уу.',
  504: 'Серверийн хариу удааширлаа. Дахин оролдоно уу.'
}

const deviceKey = 'securelab-device-id'
const responseCache = new Map()
const inFlightRequests = new Map()
let foregroundRequests = 0
let loadingTimer = null
let loadingVisible = false

function emitLoading(active) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('securelab:loading', { detail: { active } }))
}

function beginLoading() {
  foregroundRequests += 1
  if (foregroundRequests !== 1) return
  loadingTimer = window.setTimeout(() => {
    loadingVisible = true
    emitLoading(true)
  }, 220)
}

function endLoading() {
  foregroundRequests = Math.max(0, foregroundRequests - 1)
  if (foregroundRequests) return
  window.clearTimeout(loadingTimer)
  loadingTimer = null
  if (loadingVisible) emitLoading(false)
  loadingVisible = false
}
function deviceId() {
  let value = globalThis.localStorage?.getItem?.(deviceKey) || ''
  if (!/^[a-z0-9_-]{16,80}$/i.test(value)) {
    value = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
    globalThis.localStorage?.setItem?.(deviceKey, value)
  }
  return value
}

function statusMessage(status) {
  return STATUS_MESSAGES[status] || (status >= 500
    ? 'Серверт алдаа гарлаа. Түр хүлээгээд дахин оролдоно уу.'
    : 'Хүсэлтийг гүйцэтгэж чадсангүй. Дахин оролдоно уу.')
}

export async function request(path, options = {}) {
  const token = localStorage.getItem('securelab-token')
  const {
    silent = false,
    cacheTtl = 12000,
    forceRefresh = false,
    timeoutMs = 30000,
    ...fetchOptions
  } = options
  const method = String(fetchOptions.method || 'GET').toUpperCase()
  const cacheable = method === 'GET' && !fetchOptions.body
  const cacheKey = `${token || 'guest'}:${path}`
  const cached = responseCache.get(cacheKey)
  if (cacheable && !forceRefresh && cached && cached.expiresAt > Date.now()) return cached.data
  if (cacheable && !forceRefresh && inFlightRequests.has(cacheKey)) return inFlightRequests.get(cacheKey)

  const execute = async () => {
    if (!silent) beginLoading()
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
    let response
    try {
      response = await fetch(`/api${path}`, {
        ...fetchOptions,
        signal: fetchOptions.signal || controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Device-ID': deviceId(),
          ...(fetchOptions.headers || {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      })
    } catch (error) {
      window.clearTimeout(timeout)
      if (error?.name === 'AbortError') throw new Error('Серверийн хариу хэт удааширлаа. Дахин оролдоно уу.')
      throw new Error('Сүлжээнд холбогдож чадсангүй. Интернэт холболтоо шалгаад дахин оролдоно уу.')
    }

    let body
    try {
      body = await response.text()
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('Серверийн хариу хэт удааширлаа. Дахин оролдоно уу.')
      throw new Error('Серверийн хариуг уншиж чадсангүй. Дахин оролдоно уу.')
    } finally {
      window.clearTimeout(timeout)
    }

    let data
    if (body.trim()) {
      try {
        data = JSON.parse(body)
      } catch {
        throw new Error(response.ok
          ? 'Серверээс ойлгомжгүй хариу ирлээ. Дахин оролдоно уу.'
          : statusMessage(response.status))
      }
    }

    if (!response.ok) {
      const message = typeof data?.message === 'string' && /[А-Яа-яӨөҮүЁё]/.test(data.message)
        ? data.message
        : statusMessage(response.status)
      const error=new Error(message)
      error.status=response.status
      const retryAfter=Number(response.headers.get('retry-after')||data?.retry_after)
      if(Number.isFinite(retryAfter)&&retryAfter>0)error.retryAfter=Math.min(86400,Math.ceil(retryAfter))
      throw error
    }
    if (!data || typeof data !== 'object') {
      throw new Error('Серверээс хоосон хариу ирлээ. Дахин оролдоно уу.')
    }
    if (cacheable && cacheTtl > 0) responseCache.set(cacheKey, { data, expiresAt: Date.now() + cacheTtl })
    if (!cacheable) responseCache.clear()
    return data
  }

  const pending = execute().finally(() => {
    if (!silent) endLoading()
    if (cacheable) inFlightRequests.delete(cacheKey)
  })
  if (cacheable) inFlightRequests.set(cacheKey, pending)
  return pending
}
