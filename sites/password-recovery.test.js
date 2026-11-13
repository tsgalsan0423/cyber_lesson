import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import worker from '../dist/server/index.js'

test('Worker recovery routes reset the password and revoke old sessions without affecting login',async()=>{
  const sqlite=new Database(':memory:')
  sqlite.exec(`CREATE TABLE system_meta(key TEXT PRIMARY KEY,value TEXT);
    INSERT INTO system_meta VALUES('schema_version','2026-11-07-performance-v1');
    CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT,email TEXT,username TEXT,password_hash TEXT,role TEXT,session_version INTEGER DEFAULT 0,must_change_password INTEGER DEFAULT 0,surname TEXT,department TEXT,position TEXT,phone TEXT);
    CREATE TABLE login_events(id INTEGER PRIMARY KEY,user_id INTEGER,ip_address TEXT,device_id TEXT,user_agent TEXT);
    CREATE TABLE rate_limits(key TEXT PRIMARY KEY,window_started INTEGER,attempts INTEGER,blocked_until INTEGER);`)
  sqlite.prepare('INSERT INTO users(id,name,email,username,password_hash,role) VALUES(1,?,?,?,?,?)').run('Test','person@khurdan.gov.mn','person@khurdan.gov.mn',await bcrypt.hash('OldPassword-123!',4),'student')
  const env={JWT_SECRET:'test-signing-secret-at-least-32-characters',PASSWORD_RECOVERY_ENABLED:'true',MAIL_USERNAME:'sender@khurdan.gov.mn',MAIL_PASSWORD:'fixture-only',DB:{
    exec:async sql=>sqlite.exec(sql),
    batch:async statements=>statements.map(statement=>statement.run()),
    prepare(sql){let args=[];return{bind(...values){args=values;return this},first:async()=>sqlite.prepare(sql).get(...args)||null,all:async()=>({results:sqlite.prepare(sql).all(...args)}),run:async()=>{const row=sqlite.prepare(sql).run(...args);return{meta:{changes:row.changes,last_row_id:row.lastInsertRowid}}}}}
  }}
  const call=(path,body,token)=>worker.fetch(new Request('https://example.test/api'+path,{method:'POST',headers:{'content-type':'application/json','cf-connecting-ip':'192.0.2.1','x-device-id':'test-device-12345678',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body)}),env,{})
  const originalFetch=globalThis.fetch
  let deliveredCode
  globalThis.fetch=async(url,options)=>{
    const data=JSON.parse(options.body).Body
    if(data.AuthRequest)return Response.json({Body:{AuthResponse:{authToken:[{_content:'fixture-token'}]}}})
    assert.equal(data.SendMsgRequest.m.e[1].a,'person@khurdan.gov.mn')
    deliveredCode=data.SendMsgRequest.m.mp[0].mp.find(part=>part.ct==='text/plain').content._content.match(/код: (\d{6})/)[1]
    return Response.json({Body:{SendMsgResponse:{m:[{id:'1'}]}}})
  }
  try{
    const initial=await call('/auth/login',{email:'person@khurdan.gov.mn',password:'OldPassword-123!'})
    assert.equal(initial.status,200)
    const oldToken=(await initial.json()).token
    const requested=await call('/auth/password-reset/request',{email:'person@khurdan.gov.mn'})
    assert.equal(requested.status,200)
    const challenge=await requested.json()
    assert.ok(!JSON.stringify(challenge).includes(deliveredCode))
    const payload={email:'person@khurdan.gov.mn',request_id:challenge.request_id,code:deliveredCode,password:'NewPassword-456!',confirmation:'NewPassword-456!'}
    const confirmed=await call('/auth/password-reset/confirm',payload)
    assert.equal(confirmed.status,200,await confirmed.text())
    assert.equal((await call('/auth/password-reset/confirm',payload)).status,400)
    assert.equal((await call('/auth/login',{email:payload.email,password:'OldPassword-123!'})).status,401)
    assert.equal((await call('/auth/login',{email:payload.email,password:payload.password})).status,200)
    assert.equal((await call('/auth/password',{currentPassword:payload.password,password:'AnotherPassword-789!',confirmation:'AnotherPassword-789!'},oldToken)).status,401)
    assert.equal(sqlite.prepare('SELECT session_version FROM users WHERE id=1').get().session_version,1)
  }finally{globalThis.fetch=originalFetch;sqlite.close()}
})
