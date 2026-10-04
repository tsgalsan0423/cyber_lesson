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

function statusMessage(status) {
  return STATUS_MESSAGES[status] || (status >= 500
    ? 'Серверт алдаа гарлаа. Түр хүлээгээд дахин оролдоно уу.'
    : 'Хүсэлтийг гүйцэтгэж чадсангүй. Дахин оролдоно уу.')
}

export async function request(path, options = {}) {
  const token = localStorage.getItem('securelab-token')
  let response
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    })
  } catch {
    throw new Error('Сүлжээнд холбогдож чадсангүй. Интернэт холболтоо шалгаад дахин оролдоно уу.')
  }

  let body
  try {
    body = await response.text()
  } catch {
    throw new Error('Серверийн хариуг уншиж чадсангүй. Дахин оролдоно уу.')
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
    throw new Error(message)
  }
  if (!data || typeof data !== 'object') {
    throw new Error('Серверээс хоосон хариу ирлээ. Дахин оролдоно уу.')
  }
  return data
}
