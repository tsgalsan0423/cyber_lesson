// Zimbra SOAP over HTTPS works in both Node and the Sites Worker runtime.
// API reference: https://github.com/Zimbra/zm-mailbox/blob/develop/store/docs/soap.txt
const unavailable=()=>Object.assign(new Error('Нууц үг сэргээх цахим шуудангийн үйлчилгээ түр боломжгүй байна. Системийн админд хандана уу.'),{status:503})
const emailPattern=/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/
const content=value=>Array.isArray(value)?content(value[0]):typeof value==='string'?value:value?._content

function recoveryMessage(code){
  const card='https://hihello.com/p/fba323f5-1360-4080-a14e-89e02f547b9c?referer=email_signature&source=manual'
  const qr='https://cdn.hihello.me/cards/fba323f5-1360-4080-a14e-89e02f547b9c/kpee7CsufXYMNXJFAuLmAdm8JC12/signature_qrcode.png?generated=1777948598325'
  const notice='Энэ код 10 минутын хугацаанд хүчинтэй. Кодыг бусдад дамжуулахгүй байна уу.'
  const help='Та нууц үг шинэчлэх хүсэлт гаргаагүй бол кибер аюулгүй байдал хариуцсан мэргэжилтэнд хандана уу.'
  const text=`Нууц үг шинэчлэх нэг удаагийн код: ${code}\n\n${notice}\n${help}\n\nЦогбадрах Галсан\nКибер аюулгүй байдал хариуцсан мэргэжилтэн\nЦахим шуудан: galsan.ts@khurdan.gov.mn\nУтас: +976 9006 1699\nНэрийн хуудас: ${card}\n\nХУРДАН — Мэдээллийн аюулгүй байдлын сургалт\nhttps://cyber.khurdan.mn`
  const html=`<!doctype html><html lang="mn"><head><meta charset="utf-8"></head><body style="margin:0;padding:24px 12px;background:#f1f5f9;color:#172033;font-family:Arial,sans-serif;line-height:1.65">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center"><table role="presentation" width="560" cellspacing="0" cellpadding="0" style="width:100%;max-width:560px;background:#fff;border:1px solid #dbe5ee;border-radius:14px"><tr><td style="padding:28px">
<p style="margin:0 0 18px;color:#2563eb;font-size:12px;font-weight:bold">ХУРДАН · МЭДЭЭЛЛИЙН АЮУЛГҮЙ БАЙДЛЫН СУРГАЛТ</p>
<h1 style="margin:0 0 16px;font-size:21px;line-height:1.4">Нууц үг шинэчлэх нэг удаагийн код</h1>
<p style="margin:0 0 20px;padding:16px;border-radius:10px;background:#eff6ff;color:#1d4ed8;font-size:32px;font-weight:bold;letter-spacing:7px;text-align:center">${code}</p>
<p style="margin:0 0 12px;font-size:14px">${notice}</p><p style="margin:0 0 24px;font-size:14px">${help}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #e2e8f0"><tr><td style="padding-top:20px;vertical-align:top">
<p style="margin:0;font-size:16px;font-weight:bold">Цогбадрах Галсан</p><p style="margin:2px 0 10px;color:#52657b;font-size:13px">Кибер аюулгүй байдал хариуцсан мэргэжилтэн</p>
<p style="margin:0;font-size:13px"><a style="color:#2563eb" href="mailto:galsan.ts@khurdan.gov.mn">galsan.ts@khurdan.gov.mn</a><br><a style="color:#2563eb" href="tel:+97690061699">+976 9006 1699</a><br><a style="color:#2563eb" href="${card.replaceAll('&','&amp;')}">Нэрийн хуудас үзэх</a></p>
</td><td width="104" style="padding-top:20px;padding-left:12px;vertical-align:top"><a href="${card.replaceAll('&','&amp;')}"><img src="${qr}" width="88" height="88" alt="Цогбадрах Галсан — нэрийн хуудасны QR код" style="display:block;border:0;width:88px;height:88px"></a></td></tr></table>
<p style="margin:22px 0 0;font-size:12px"><a style="color:#64748b" href="https://cyber.khurdan.mn">cyber.khurdan.mn</a></p>
</td></tr></table></td></tr></table></body></html>`
  return{text,html}
}

export function recoveryMailConfigured(env){
  return env.PASSWORD_RECOVERY_ENABLED==='true'&&emailPattern.test(env.MAIL_USERNAME||'')&&Boolean(env.MAIL_PASSWORD)&&emailPattern.test(env.MAIL_FROM||env.MAIL_USERNAME||'')
}

export function createRecoveryMailer(env,fetcher=fetch,report=details=>console.error('otp_mail_delivery_failed',JSON.stringify(details))){
  return async function sendCode({email,code}){
    if(!recoveryMailConfigured(env)||!emailPattern.test(email)||!/^\d{6}$/.test(code))throw unavailable()
    const from=env.MAIL_FROM||env.MAIL_USERNAME
    let endpoint
    try{endpoint=new URL(env.MAIL_SOAP_URL||'https://mail.gov.mn/service/soap')}catch{throw unavailable()}
    if(endpoint.protocol!=='https:'||endpoint.hostname!=='mail.gov.mn'||endpoint.port||endpoint.username||endpoint.password||endpoint.search||endpoint.hash||!/^\/service\/soap\/?$/.test(endpoint.pathname))throw unavailable()
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000)
    let token,phase='authentication',providerStatus,providerCode
    const call=async(body)=>{
      const context={_jsns:'urn:zimbra',userAgent:{name:'SecureLab',version:'2'}}
      if(token){context.authToken={_content:token};context.account={by:'name',_content:env.MAIL_USERNAME}}
      const response=await fetcher(endpoint.href,{
        method:'POST',redirect:'error',signal:controller.signal,
        headers:{'content-type':'application/json; charset=utf-8',...(token?{cookie:`ZM_AUTH_TOKEN=${token}`}:{})},
        body:JSON.stringify({Header:{context},Body:body})
      })
      providerStatus=response.status
      if(!response.ok)throw unavailable()
      const data=await response.json()
      const fault=data?.Body?.Fault
      const rawCode=fault?.Detail?.Error?.Code||fault?.Detail?.Error?.[0]?.Code
      const code=typeof rawCode==='string'?rawCode:rawCode?._content
      if(typeof code==='string'&&/^[a-zA-Z0-9_.:-]{1,80}$/.test(code))providerCode=code
      if(data?.Body?.Fault||!data?.Body)throw unavailable()
      return data.Body
    }
    try{
      const auth=await call({AuthRequest:{_jsns:'urn:zimbraAccount',account:{by:'name',_content:env.MAIL_USERNAME},password:{_content:env.MAIL_PASSWORD}}})
      token=content(auth.AuthResponse?.authToken)
      if(typeof token!=='string'||!token||/[\s;\r\n]/.test(token)||auth.AuthResponse?.twoFactorAuthRequired===true||auth.AuthResponse?.twoFactorAuthRequired==='1')throw unavailable()
      phase='send';providerStatus=undefined;providerCode=undefined
      const {text,html}=recoveryMessage(code)
      const sent=await call({SendMsgRequest:{_jsns:'urn:zimbraMail',m:{e:[{a:from,t:'f'},{a:email,t:'t'}],su:{_content:'Нууц үг шинэчлэх баталгаажуулах код'},mp:[{ct:'multipart/alternative',mp:[{ct:'text/plain',content:{_content:text}},{ct:'text/html',content:{_content:html}}]}]}}})
      if(!sent.SendMsgResponse)throw unavailable()
    }catch(error){
      // Never return or log provider bodies, credentials, auth tokens or OTPs.
      const networkCode=error?.cause?.code
      const safeNetworkCode=['ENOTFOUND','ECONNREFUSED','ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT','CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE'].includes(networkCode)?networkCode:undefined
      report({phase,status:providerStatus,code:providerCode||safeNetworkCode||(error?.name==='AbortError'?'TIMEOUT':'MAIL_REQUEST_FAILED')})
      throw unavailable()
    }finally{clearTimeout(timeout)}
  }
}
