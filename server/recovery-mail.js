// Zimbra SOAP over HTTPS works in both Node and the Sites Worker runtime.
// API reference: https://github.com/Zimbra/zm-mailbox/blob/develop/store/docs/soap.txt
const unavailable=()=>Object.assign(new Error('Нууц үг сэргээх цахим шуудангийн үйлчилгээ түр боломжгүй байна. Системийн админд хандана уу.'),{status:503})
const emailPattern=/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/
const content=value=>Array.isArray(value)?content(value[0]):typeof value==='string'?value:value?._content

export function recoveryMailConfigured(env){
  return env.PASSWORD_RECOVERY_ENABLED==='true'&&emailPattern.test(env.MAIL_USERNAME||'')&&Boolean(env.MAIL_PASSWORD)&&emailPattern.test(env.MAIL_FROM||env.MAIL_USERNAME||'')
}

export function createRecoveryMailer(env,fetcher=fetch){
  return async function sendCode({email,code}){
    if(!recoveryMailConfigured(env)||!emailPattern.test(email)||!/^\d{6}$/.test(code))throw unavailable()
    const from=env.MAIL_FROM||env.MAIL_USERNAME
    let endpoint
    try{endpoint=new URL(env.MAIL_SOAP_URL||'https://mail.gov.mn/service/soap')}catch{throw unavailable()}
    if(endpoint.protocol!=='https:'||endpoint.hostname!=='mail.gov.mn'||endpoint.port||endpoint.username||endpoint.password||endpoint.search||endpoint.hash||!/^\/service\/soap\/?$/.test(endpoint.pathname))throw unavailable()
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000)
    let token
    const call=async(body)=>{
      const context={_jsns:'urn:zimbra',userAgent:{name:'SecureLab',version:'2'}}
      if(token){context.authToken={_content:token};context.account={by:'name',_content:env.MAIL_USERNAME}}
      const response=await fetcher(endpoint.href,{
        method:'POST',redirect:'error',signal:controller.signal,
        headers:{'content-type':'application/json; charset=utf-8',...(token?{cookie:`ZM_AUTH_TOKEN=${token}`}:{})},
        body:JSON.stringify({Header:{context},Body:body})
      })
      if(!response.ok)throw unavailable()
      const data=await response.json()
      if(data?.Body?.Fault||!data?.Body)throw unavailable()
      return data.Body
    }
    try{
      const auth=await call({AuthRequest:{_jsns:'urn:zimbraAccount',account:{by:'name',_content:env.MAIL_USERNAME},password:{_content:env.MAIL_PASSWORD}}})
      token=content(auth.AuthResponse?.authToken)
      if(typeof token!=='string'||!token||/[\s;\r\n]/.test(token)||auth.AuthResponse?.twoFactorAuthRequired===true||auth.AuthResponse?.twoFactorAuthRequired==='1')throw unavailable()
      const text=`Нууц үг шинэчлэх нэг удаагийн код: ${code}\n\nЭнэ код 10 минутын хугацаанд хүчинтэй. Кодыг бусдад дамжуулахгүй байна уу.\nТа нууц үг шинэчлэх хүсэлт гаргаагүй бол энэ шууданг үл хэрэгсээрэй.\n\nХУРДАН — Мэдээллийн аюулгүй байдлын сургалт\nhttps://cyber.khurdan.mn`
      const sent=await call({SendMsgRequest:{_jsns:'urn:zimbraMail',m:{e:[{a:from,t:'f'},{a:email,t:'t'}],su:{_content:'Нууц үг шинэчлэх баталгаажуулах код'},mp:[{ct:'text/plain',content:{_content:text}}]}}})
      if(!sent.SendMsgResponse)throw unavailable()
    }catch{
      // Never return or log provider bodies, credentials, auth tokens or OTPs.
      throw unavailable()
    }finally{clearTimeout(timeout)}
  }
}
