import test from 'node:test'
import assert from 'node:assert/strict'
import {request} from './api.js'

const originalFetch = globalThis.fetch
const originalStorage = globalThis.localStorage

async function withResponse(response, callback) {
  globalThis.localStorage = {getItem: () => null}
  globalThis.fetch = async () => response
  try { await callback() }
  finally {
    globalThis.fetch = originalFetch
    globalThis.localStorage = originalStorage
  }
}

test('successful JSON response remains usable', async () => {
  await withResponse(new Response('{"user":{"id":1},"token":"abc"}', {status:200}), async () => {
    assert.equal((await request('/auth/login')).token, 'abc')
  })
})

test('empty response shows a Mongolian explanation', async () => {
  await withResponse(new Response('', {status:200}), async () => {
    await assert.rejects(request('/auth/login'), /Серверээс хоосон хариу ирлээ/)
  })
})

test('empty and malformed error responses do not expose JSON errors', async () => {
  await withResponse(new Response('', {status:502}), async () => {
    await assert.rejects(request('/auth/login'), /Сервертэй холбогдоход алдаа гарлаа/)
  })
  await withResponse(new Response('<html>error</html>', {status:401}), async () => {
    await assert.rejects(request('/auth/login'), /Нэвтрэх нэр эсвэл нууц үг буруу байна/)
  })
})

test('server-provided Mongolian error is preserved', async () => {
  await withResponse(new Response('{"message":"Олон удаа буруу оролдсон байна."}', {status:429}), async () => {
    await assert.rejects(request('/auth/login'), /Олон удаа буруу оролдсон байна/)
  })
})

test('network failure gives a Mongolian connection message', async () => {
  globalThis.localStorage = {getItem: () => null}
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch') }
  try { await assert.rejects(request('/auth/login'), /Интернэт холболтоо шалгаад/) }
  finally {
    globalThis.fetch = originalFetch
    globalThis.localStorage = originalStorage
  }
})
