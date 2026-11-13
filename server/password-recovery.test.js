import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import {RECOVERY_SCHEMA,createPasswordRecovery} from './password-recovery.js'

const email='person@khurdan.gov.mn',oldPassword='Old-Password-123!',password='New-Password-456!'
const oldHash=bcrypt.hashSync(oldPassword,4)
const passwordError=value=>typeof value!=='string'||value.length<12||new TextEncoder().encode(value).length>72||!/[A-Z]/.test(value)||!/[a-z]/.test(value)||!/[0-9]/.test(value)||!/[!@#$%^&*]/.test(value)?'Нууц үг шаардлага хангахгүй байна.':''
function fixture({send}={}){
  const sqlite=new Database(':memory:')
  sqlite.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT,password_hash TEXT,session_version INTEGER NOT NULL DEFAULT 0,must_change_password INTEGER DEFAULT 1);${RECOVERY_SCHEMA}`)
  sqlite.prepare('INSERT INTO users(id,email,password_hash) VALUES(1,?,?)').run(email,oldHash)
  let timestamp=1790000000000
  const messages=[]
  const db={get:async(sql,values=[])=>sqlite.prepare(sql).get(...values),run:async(sql,values=[])=>sqlite.prepare(sql).run(...values)}
  const service=createPasswordRecovery({db,secret:'test-only-secret-that-is-longer-than-32-bytes',passwordError,now:()=>timestamp,sendCode:async message=>{messages.push(message);if(send)await send(message)}})
  const context={email,ip:'shared-office',device:'device-one'}
  const request=()=>service.request(context)
  const confirm=(result,overrides={})=>service.confirm({...context,...result,code:messages.at(-1)?.code,password,confirmation:password,...overrides})
  return{sqlite,db,service,context,messages,request,confirm,advance:milliseconds=>{timestamp+=milliseconds}}
}
const invalid=error=>error.status===400&&/код/.test(error.message)

test('cooldown and hourly caps report remaining time rather than a generic lockout',async()=>{
  const f=fixture()
  await f.request()
  f.advance(30000)
  await assert.rejects(f.request(),error=>error.status===429&&error.retry_after===30&&/30 секунд/.test(error.message))
  f.advance(30000)
  await f.request()
  for(let sent=2;sent<5;sent++){f.advance(60000);await f.request()}
  f.advance(60000)
  await assert.rejects(f.request(),error=>error.status===429&&error.retry_after===3300&&/цагийн хязгаарт/.test(error.message))
  f.sqlite.close()
})

test('OTP is hashed, expires in ten minutes and resets only password/session state',async()=>{
  const f=fixture(),result=await f.request()
  assert.equal(result.expires_in,600);assert.equal(result.resend_after,60)
  assert.match(f.messages[0].code,/^\d{6}$/)
  assert.equal(f.messages[0].email,email)
  assert.equal(Object.hasOwn(result,'code'),false)
  const stored=await f.db.get('SELECT * FROM password_reset_codes')
  assert.match(stored.code_hash,/^[a-f0-9]{64}$/)
  assert.notEqual(stored.code_hash,f.messages[0].code)
  assert.equal((await f.confirm(result)).ok,true)
  const user=await f.db.get('SELECT * FROM users')
  assert.equal(user.session_version,1);assert.equal(user.must_change_password,0)
  assert.equal(await bcrypt.compare(password,user.password_hash),true)
  await assert.rejects(f.confirm(result),invalid)
  f.sqlite.close()
})

test('expired and five-times incorrect codes cannot reset a password',async()=>{
  const expired=fixture(),result=await expired.request()
  expired.advance(600001)
  await assert.rejects(expired.confirm(result),invalid)
  expired.sqlite.close()
  const f=fixture(),challenge=await f.request(),wrong=f.messages[0].code==='111111'?'222222':'111111'
  for(let attempt=0;attempt<5;attempt++)await assert.rejects(f.confirm(challenge,{code:wrong}),invalid)
  await assert.rejects(f.confirm(challenge),invalid)
  assert.equal((await f.db.get('SELECT attempts FROM password_reset_codes')).attempts,5)
  assert.equal((await f.db.get('SELECT session_version FROM users')).session_version,0)
  f.sqlite.close()
})

test('cooldown is shared across devices and resend invalidates the old code',async()=>{
  const f=fixture(),first=await f.request(),firstCode=f.messages[0].code
  await assert.rejects(f.service.request({...f.context,device:'different-device',ip:'different-ip'}),error=>error.status===429)
  f.advance(60000)
  const second=await f.request()
  await assert.rejects(f.confirm(first,{code:firstCode}),invalid)
  assert.equal((await f.confirm(second)).ok,true)
  f.sqlite.close()
})

test('unknown accounts receive an identical public response without delivery',async()=>{
  const f=fixture(),known=await f.request(),unknown=await f.service.request({...f.context,email:'missing@khurdan.gov.mn'})
  assert.deepEqual(Object.keys(unknown),Object.keys(known))
  assert.equal(known.message,unknown.message)
  assert.equal(f.messages.length,1)
  await assert.rejects(f.service.confirm({...f.context,...unknown,email:'missing@khurdan.gov.mn',code:'123456',password,confirmation:password}),invalid)
  f.sqlite.close()
})

test('early resend attempts do not consume the hourly account delivery budget',async()=>{
  const f=fixture()
  await f.request()
  for(let attempt=0;attempt<5;attempt++)await assert.rejects(f.request(),error=>error.status===429)
  for(let sent=1;sent<5;sent++){
    f.advance(60000)
    await f.request()
  }
  assert.equal(f.messages.length,5)
  f.advance(60000)
  await assert.rejects(f.request(),error=>error.status===429)
  f.sqlite.close()
})

test('concurrent successful guesses permit exactly one password update',async()=>{
  const f=fixture(),result=await f.request()
  const outcomes=await Promise.allSettled([f.confirm(result),f.confirm(result)])
  assert.equal(outcomes.filter(outcome=>outcome.status==='fulfilled').length,1)
  assert.equal((await f.db.get('SELECT session_version FROM users')).session_version,1)
  f.sqlite.close()
})

test('changed account email or session version invalidates a previous mailbox code',async()=>{
  for(const update of ["UPDATE users SET email='new@khurdan.gov.mn'","UPDATE users SET session_version=session_version+1"]){
    const f=fixture(),result=await f.request()
    await f.db.run(update)
    await assert.rejects(f.confirm(result),invalid)
    assert.equal(await bcrypt.compare(oldPassword,(await f.db.get('SELECT password_hash FROM users')).password_hash),true)
    f.sqlite.close()
  }
})

test('provider failures revoke the token and never expose provider credentials',async()=>{
  const f=fixture({send:async()=>{throw new Error('provider-token-private')}})
  await assert.rejects(f.request(),error=>error.status===503&&!error.message.includes('provider-token-private'))
  assert.notEqual((await f.db.get('SELECT consumed_at FROM password_reset_codes')).consumed_at,null)
  assert.equal((await f.db.get('SELECT session_version FROM users')).session_version,0)
  f.sqlite.close()
})

test('password policy, matching confirmation and password reuse are enforced',async()=>{
  const f=fixture(),result=await f.request()
  await assert.rejects(f.confirm(result,{password:'weak',confirmation:'weak'}),/шаардлага/)
  await assert.rejects(f.confirm(result,{confirmation:'different'}),/таарахгүй/)
  await assert.rejects(f.confirm(result,{password:oldPassword,confirmation:oldPassword}),/өөр байх/)
  assert.equal((await f.confirm(result)).ok,true)
  f.sqlite.close()
})

test('the verification budget persists across code resends',async()=>{
  const f=fixture()
  for(let round=0;round<3;round++){
    const result=await f.request(),wrong=f.messages.at(-1).code==='111111'?'222222':'111111'
    for(let attempt=0;attempt<5;attempt++)await assert.rejects(f.confirm(result,{code:wrong}),invalid)
    f.advance(60000)
  }
  const result=await f.request()
  await assert.rejects(f.confirm(result),error=>error.status===429)
  f.sqlite.close()
})

test('device and shared-IP request limits remain independent of account names',async()=>{
  for(const [total,device] of [[30,'one-device'],[300,null]]){
    const f=fixture()
    for(let index=0;index<total;index++)await f.service.request({email:`missing${index}@khurdan.gov.mn`,device:device||`device-${index}`,ip:'one-shared-ip'})
    await assert.rejects(f.service.request({email:'extra@khurdan.gov.mn',device:device||'device-extra',ip:'one-shared-ip'}),error=>error.status===429)
    assert.equal(f.messages.length,0)
    f.sqlite.close()
  }
})
