import test from 'node:test'
import assert from 'node:assert/strict'
import {request} from './api.js'

test('API preserves safe server wait metadata for throttling and delivery errors',async()=>{
  const original={fetch:globalThis.fetch,window:globalThis.window,storage:globalThis.localStorage}
  globalThis.window={setTimeout,clearTimeout}
  globalThis.localStorage={getItem:key=>key==='securelab-device-id'?'test-device-123456789':null}
  try{
    for(const status of [429,503]){
      globalThis.fetch=async()=>Response.json({message:'Код дахин авахын өмнө хүлээнэ үү.',retry_after:42},{status,headers:{'retry-after':'41'}})
      await assert.rejects(request('/auth/password-reset/request',{method:'POST',silent:true,body:'{}'}),error=>error.status===status&&error.retryAfter===41&&/хүлээнэ/.test(error.message))
    }
    globalThis.fetch=async()=>Response.json({message:'Код авах хүсэлтээ түр хүлээнэ үү.',retry_after:30},{status:429})
    await assert.rejects(request('/auth/password-reset/request',{method:'POST',silent:true,body:'{}'}),error=>error.retryAfter===30)
  }finally{
    globalThis.fetch=original.fetch;globalThis.window=original.window;globalThis.localStorage=original.storage
  }
})
