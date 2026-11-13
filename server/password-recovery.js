import bcrypt from 'bcryptjs'

export const RECOVERY_SCHEMA = `
CREATE TABLE IF NOT EXISTS password_reset_codes (
  request_id TEXT PRIMARY KEY,user_id INTEGER,email TEXT NOT NULL,code_hash TEXT NOT NULL,
  expires_at BIGINT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,consumed_at BIGINT,
  session_version INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS password_reset_codes_email ON password_reset_codes(email);
CREATE INDEX IF NOT EXISTS password_reset_codes_expiry ON password_reset_codes(expires_at);
CREATE TABLE IF NOT EXISTS password_reset_limits (
  key TEXT PRIMARY KEY,window_started BIGINT NOT NULL,attempts INTEGER NOT NULL
);`

const EXPIRY_MS = 600000,HOUR_MS = 3600000
const encoder = new TextEncoder()
const invalidMessage = 'Баталгаажуулах код буруу, хугацаа нь дууссан эсвэл ашиглагдсан байна. Шинэ код авч дахин оролдоно уу.'
const fail = (message,status=400) => Object.assign(new Error(message),{status})
const normalizeEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : ''
const validEmail = email => email.length<=160 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
const safeEqual = (a,b) => {
  let difference=a.length^b.length
  for(let index=0;index<Math.max(a.length,b.length);index++)difference|=(a.charCodeAt(index)||0)^(b.charCodeAt(index)||0)
  return difference===0
}
function newCode(){
  const random=new Uint32Array(1),ceiling=Math.floor(2**32/1000000)*1000000
  do{crypto.getRandomValues(random)}while(random[0]>=ceiling)
  return String(random[0]%1000000).padStart(6,'0')
}

export function createPasswordRecovery({db,secret,sendCode,passwordError,now=Date.now}){
  if(typeof secret!=='string'||encoder.encode(secret).length<32)throw new Error('Нууц үг сэргээх серверийн нууц тохиргоо дутуу байна.')
  const key=crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign'])
  async function hash(purpose,...parts){
    const result=await crypto.subtle.sign('HMAC',await key,encoder.encode(JSON.stringify(['securelab-password-reset-v1',purpose,...parts])))
    return Array.from(new Uint8Array(result),byte=>byte.toString(16).padStart(2,'0')).join('')
  }
  async function limit(kind,identifier,count,duration=HOUR_MS){
    const timestamp=now(),expiry=timestamp-duration,opaqueKey=await hash('rate',kind,String(identifier||'unknown').slice(0,200))
    const accepted=await db.get(`INSERT INTO password_reset_limits(key,window_started,attempts) VALUES(?,?,1)
      ON CONFLICT(key) DO UPDATE SET
      attempts=CASE WHEN password_reset_limits.window_started<=? THEN 1 ELSE password_reset_limits.attempts+1 END,
      window_started=CASE WHEN password_reset_limits.window_started<=? THEN ? ELSE password_reset_limits.window_started END
      WHERE password_reset_limits.window_started<=? OR password_reset_limits.attempts<? RETURNING key`,
      [opaqueKey,timestamp,expiry,expiry,timestamp,expiry,count])
    if(!accepted){
      const record=await db.get('SELECT window_started FROM password_reset_limits WHERE key=?',[opaqueKey])
      const retry_after=Math.max(1,Math.ceil((Number(record?.window_started??timestamp)+duration-timestamp)/1000))
      const wait=retry_after<60?`${retry_after} секунд`:`${Math.ceil(retry_after/60)} минут`
      const message=kind==='resend-email'
        ?`Код дахин авахын өмнө ${wait} хүлээнэ үү.`
        :kind.startsWith('send-')?`Баталгаажуулах код авах цагийн хязгаарт хүрсэн байна. ${wait} дараа дахин оролдоно уу.`
        :`Код баталгаажуулах оролдлогын хязгаарт хүрсэн байна. ${wait} дараа дахин оролдоно уу.`
      throw Object.assign(fail(message,429),{retry_after})
    }
  }
  async function request({email:value,ip,device}){
    const email=normalizeEmail(value)
    if(!validEmail(email))throw fail('Зөв цахим шуудангийн хаяг оруулна уу.')
    await limit('send-device',device,30);await limit('send-ip',ip,300)
    await limit('resend-email',email,1,60000);await limit('send-email',email,5)
    const timestamp=now()
    await db.run('DELETE FROM password_reset_codes WHERE expires_at<?',[timestamp-HOUR_MS])
    await db.run('DELETE FROM password_reset_limits WHERE window_started<?',[timestamp-HOUR_MS])
    const user=await db.get('SELECT id,email,password_hash,session_version FROM users WHERE lower(email)=?',[email])
    const request_id=crypto.randomUUID(),code=newCode(),codeHash=await hash('code',request_id,email,code)
    await db.run('UPDATE password_reset_codes SET consumed_at=? WHERE email=? AND consumed_at IS NULL',[timestamp,email])
    await db.run('INSERT INTO password_reset_codes(request_id,user_id,email,code_hash,expires_at,session_version) VALUES(?,?,?,?,?,?)',
      [request_id,user?.id??null,email,codeHash,timestamp+EXPIRY_MS,Number(user?.session_version)||0])
    if(user){
      try{await sendCode({email:user.email,code})}
      catch{
        await db.run('UPDATE password_reset_codes SET consumed_at=? WHERE request_id=?',[now(),request_id])
        const retry_after=Math.max(1,Math.ceil((timestamp+60000-now())/1000))
        throw Object.assign(fail('Баталгаажуулах кодыг цахим шуудангаар илгээж чадсангүй. Хүлээх хугацаа дууссаны дараа дахин оролдоно уу. Алдаа давтагдвал системийн админд хандана уу.',503),{retry_after})
      }
    }
    return{request_id,message:'Хэрэв энэ цахим шуудангийн хаяг системд бүртгэлтэй бол баталгаажуулах код илгээгдэнэ. Ирсэн захидал болон сэжигтэй захидлын хавтсаа шалгана уу.',resend_after:60,expires_in:600}
  }
  async function confirm({email:value,request_id,code,password,confirmation,ip,device}){
    const email=normalizeEmail(value)
    if(!validEmail(email)||typeof request_id!=='string'||!/^[a-f0-9-]{36}$/i.test(request_id))throw fail(invalidMessage)
    await limit('verify-device',device,60);await limit('verify-ip',ip,1000);await limit('verify-email',email,15)
    const policyError=passwordError(password)
    if(policyError)throw fail(policyError)
    if(password!==confirmation)throw fail('Шинэ нууц үг давтан оруулсантай таарахгүй байна.')
    const token=await db.get(`UPDATE password_reset_codes SET attempts=attempts+1 WHERE request_id=? AND email=?
      AND consumed_at IS NULL AND expires_at>? AND attempts<5 RETURNING *`,[request_id,email,now()])
    if(!token)throw fail(invalidMessage)
    const candidate=await hash('code',request_id,email,typeof code==='string'?code.slice(0,20):'')
    if(!safeEqual(candidate,token.code_hash)||typeof code!=='string'||!/^\d{6}$/.test(code)||token.user_id==null)throw fail(invalidMessage)
    const user=await db.get('SELECT id,email,password_hash,session_version FROM users WHERE id=?',[token.user_id])
    if(!user||normalizeEmail(user.email)!==email||Number(user.session_version)!==Number(token.session_version))throw fail(invalidMessage)
    if(await bcrypt.compare(password,user.password_hash))throw fail('Шинэ нууц үг өмнөхөөсөө өөр байх ёстой.')
    const passwordHash=await bcrypt.hash(password,12)
    // Updating the version atomically claims this reset, invalidating concurrent
    // uses and every other code or session issued under the previous version.
    const result=await db.run(`UPDATE users SET password_hash=?,must_change_password=0,session_version=session_version+1
      WHERE id=? AND lower(email)=? AND session_version=? AND EXISTS(SELECT 1 FROM password_reset_codes
      WHERE request_id=? AND user_id=users.id AND email=? AND code_hash=? AND consumed_at IS NULL AND expires_at>? AND attempts<=5)`,
      [passwordHash,user.id,email,token.session_version,request_id,email,candidate,now()])
    if(!Number(result.changes))throw fail(invalidMessage)
    await db.run('UPDATE password_reset_codes SET consumed_at=? WHERE user_id=? AND consumed_at IS NULL',[now(),user.id])
    return{ok:true,message:'Нууц үг амжилттай шинэчлэгдлээ. Шинэ нууц үгээрээ нэвтэрнэ үү.'}
  }
  return{request,confirm}
}
