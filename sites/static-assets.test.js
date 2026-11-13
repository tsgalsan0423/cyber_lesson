import test from 'node:test'
import assert from 'node:assert/strict'
import {gunzipSync} from 'node:zlib'
import worker from '../dist/server/index.js'

const fetchAsset=(path,headers={},method='GET')=>worker.fetch(new Request('https://example.test'+path,{method,headers}),{}, {})
test('compressed assets preserve exact content and negotiate encoding',async()=>{
  const html=await (await fetchAsset('/')).text()
  const path=html.match(/src="([^"]+\.js)"/)[1]
  const raw=await fetchAsset(path),bytes=Buffer.from(await raw.arrayBuffer())
  const zipped=await fetchAsset(path,{'accept-encoding':'br, gzip'})
  const compressed=Buffer.from(await zipped.arrayBuffer())
  assert.equal(zipped.headers.get('content-encoding'),'gzip')
  assert.equal(zipped.headers.get('vary'),'Accept-Encoding')
  assert.deepEqual(gunzipSync(compressed),bytes)
  assert.ok(compressed.length<bytes.length*.6)
  assert.equal((await fetchAsset(path,{'accept-encoding':'gzip;q=0'})).headers.get('content-encoding'),null)
  const range=await fetchAsset(path,{'accept-encoding':'gzip',range:'bytes=0-9'})
  assert.equal(range.status,206)
  assert.deepEqual(Buffer.from(await range.arrayBuffer()),bytes.subarray(0,10))
  assert.equal(range.headers.get('content-encoding'),null)
  const head=await fetchAsset(path,{'accept-encoding':'gzip'},'HEAD')
  assert.equal((await head.arrayBuffer()).byteLength,0)
  assert.equal(Number(head.headers.get('content-length')),compressed.length)
})
