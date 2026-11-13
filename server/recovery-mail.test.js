import test from 'node:test'
import assert from 'node:assert/strict'
import {createRecoveryMailer,recoveryMailConfigured} from './recovery-mail.js'

const env={PASSWORD_RECOVERY_ENABLED:'true',MAIL_USERNAME:'sender@khurdan.gov.mn',MAIL_PASSWORD:'test-only-secret'}
test('Zimbra sends OTP over HTTPS with mailbox authentication, without forwarding',async()=>{
  const calls=[]
  const send=createRecoveryMailer(env,async(url,opts)=>{
    calls.push({url,opts,body:JSON.parse(opts.body)})
    return Response.json({Body:calls.length===1?{AuthResponse:{authToken:[{_content:'mock-token'}]}}:{SendMsgResponse:{m:[{id:'1'}]}}})
  })
  await send({email:'recipient@khurdan.gov.mn',code:'123456'})
  assert.equal(calls.length,2)
  assert.equal(calls[0].url,'https://mail.gov.mn/service/soap')
  assert.equal(calls[0].opts.redirect,'error')
  assert.equal(calls[1].opts.headers.cookie,'ZM_AUTH_TOKEN=mock-token')
  assert.equal(calls[1].body.Body.SendMsgRequest.m.e[1].a,'recipient@khurdan.gov.mn')
  assert.match(calls[1].body.Body.SendMsgRequest.m.mp[0].content._content,/123456/)
  assert.ok(!calls[1].opts.body.includes(env.MAIL_PASSWORD))
})
test('provider faults are sanitized and no send is attempted after bad auth',async()=>{
  let calls=0
  const send=createRecoveryMailer(env,async()=>{calls++;return Response.json({Body:{Fault:{Reason:'provider-secret-detail'}}})})
  await assert.rejects(send({email:'recipient@khurdan.gov.mn',code:'123456'}),e=>e.status===503&&!e.message.includes('provider-secret'))
  assert.equal(calls,1)
})
test('missing config and unexpected endpoints fail closed',async()=>{
  assert.equal(recoveryMailConfigured({}),false)
  for(const settings of [{}, {...env,MAIL_SOAP_URL:'https://other.example/service/soap'}, {...env,MAIL_SOAP_URL:'http://mail.gov.mn/service/soap'}]){
    await assert.rejects(createRecoveryMailer(settings,()=>assert.fail('must not send'))({email:'recipient@khurdan.gov.mn',code:'123456'}),e=>e.status===503)
  }
})
