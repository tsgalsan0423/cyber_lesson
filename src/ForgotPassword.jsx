import React,{useEffect,useRef,useState} from 'react'
import {ArrowLeft,CheckCircle2,Eye,EyeOff,KeyRound,Mail,X} from 'lucide-react'
import {request} from './api.js'
import './forgot-password.css'

const genericNotice='Хэрэв энэ цахим шуудангийн хаяг системд бүртгэлтэй бол баталгаажуулах код очно. Ирсэн захидал болон хэрэгцээгүй захидлын хавтсаа шалгана уу.'
const secondsUntil=deadline=>Math.max(0,Math.ceil((deadline-Date.now())/1000))

export default function ForgotPassword({initialEmail='',onClose,onSuccess}){
  const [email,setEmail]=useState(initialEmail),[challenge,setChallenge]=useState(null)
  const [code,setCode]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState('')
  const [showPassword,setShowPassword]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(false)
  const [remaining,setRemaining]=useState(0),[expiresIn,setExpiresIn]=useState(0)
  const modalRef=useRef(null),firstFieldRef=useRef(null),codeRef=useRef(null),busyRef=useRef(false),closeRef=useRef(onClose)
  busyRef.current=busy;closeRef.current=onClose
  useEffect(()=>{
    const previous=document.activeElement,overflow=document.body.style.overflow
    document.body.style.overflow='hidden';firstFieldRef.current?.focus()
    const handleKey=event=>{
      if(event.key==='Escape'){event.preventDefault();if(!busyRef.current)closeRef.current?.();return}
      if(event.key!=='Tab')return
      const nodes=[...modalRef.current.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"]')]
      if(!nodes.length)return
      const first=nodes[0],last=nodes[nodes.length-1],outside=!modalRef.current.contains(document.activeElement)
      if(event.shiftKey&&(document.activeElement===first||outside)){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&(document.activeElement===last||outside)){event.preventDefault();first.focus()}
    }
    document.addEventListener('keydown',handleKey)
    return()=>{document.removeEventListener('keydown',handleKey);document.body.style.overflow=overflow;previous?.focus?.()}
  },[])
  useEffect(()=>{
    if(!challenge)return
    const update=()=>{setRemaining(secondsUntil(challenge.resendAt));setExpiresIn(secondsUntil(challenge.expiresAt))}
    update();codeRef.current?.focus()
    const timer=window.setInterval(update,1000)
    return()=>window.clearInterval(timer)
  },[challenge])
  const sendCode=async event=>{
    event?.preventDefault();if(busy||remaining>0)return
    setBusy(true);setError('')
    try{
      const data=await request('/auth/password-reset/request',{method:'POST',silent:true,body:JSON.stringify({email:email.trim().toLowerCase()})})
      if(typeof data.request_id!=='string'||!data.request_id)throw new Error('Баталгаажуулах хүсэлтийн мэдээлэл дутуу ирлээ. Дахин оролдоно уу.')
      const resend=Number.isFinite(Number(data.resend_after))?Math.max(1,Number(data.resend_after)):60
      const expires=Number.isFinite(Number(data.expires_in))?Math.max(1,Number(data.expires_in)):600
      setChallenge({id:data.request_id,resendAt:Date.now()+resend*1000,expiresAt:Date.now()+expires*1000});setCode('')
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }
  const resetPassword=async event=>{
    event.preventDefault();setError('')
    if(!/^\d{6}$/.test(code)){setError('Цахим шууданд ирсэн 6 оронтой кодыг оруулна уу.');return}
    if(password.length<12||new TextEncoder().encode(password).length>72){setError('Шинэ нууц үг 12-оос доошгүй тэмдэгттэй, 72 байтаас ихгүй байна.');return}
    if(!/[a-z]/.test(password)||!/[A-Z]/.test(password)||!/[0-9]/.test(password)||!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?`~]/.test(password)){setError('Нууц үг латин том, жижиг үсэг, тоо, тусгай тэмдэгт агуулна.');return}
    if(password!==confirmation){setError('Шинэ нууц үг давтан оруулсантай таарахгүй байна.');return}
    setBusy(true)
    try{
      await request('/auth/password-reset/confirm',{method:'POST',silent:true,body:JSON.stringify({email:email.trim().toLowerCase(),request_id:challenge.id,code,password,confirmation})})
      setPassword('');setConfirmation('');setCode('');setChallenge(null);setSuccess(true)
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }
  const changeEmail=()=>{setChallenge(null);setCode('');setPassword('');setConfirmation('');setRemaining(0);setError('');window.requestAnimationFrame(()=>firstFieldRef.current?.focus())}
  const finish=()=>{if(onSuccess)onSuccess('Нууц үг амжилттай шинэчлэгдлээ. Шинэ нууц үгээрээ нэвтэрнэ үү.');else onClose?.()}
  return <div className="modal-bg forgot-password-backdrop"><section ref={modalRef} className="forgot-password-modal" role="dialog" aria-modal="true" aria-labelledby="forgot-password-title" aria-describedby="forgot-password-description" aria-busy={busy}>
    <button type="button" className="forgot-close" aria-label="Нууц үг сэргээх цонх хаах" disabled={busy} onClick={onClose}><X size={19}/></button>
    <div className={`forgot-icon${success?' success':''}`}>{success?<CheckCircle2/>:challenge?<KeyRound/>:<Mail/>}</div>
    <h2 id="forgot-password-title">{success?'Нууц үг шинэчлэгдлээ':challenge?'Кодоо баталгаажуулна уу':'Нууц үгээ сэргээх'}</h2>
    <p id="forgot-password-description">{success?'Шинэ нууц үгээрээ системд нэвтэрнэ үү.':challenge?'Цахим шууданд ирсэн код болон шинэ нууц үгээ оруулна уу.':'Системд бүртгэлтэй цахим шуудангийн хаягаа оруулна уу.'}</p>
    {success?<button type="button" autoFocus className="primary forgot-submit" onClick={finish}>Нэвтрэх хэсэг рүү</button>:<>
      {challenge?<>
        <div className="forgot-recipient"><span>{email.trim().toLowerCase()}</span><button type="button" disabled={busy} onClick={changeEmail}>Хаяг өөрчлөх</button></div>
        <p className="forgot-notice" role="status">{genericNotice}</p>
        <form onSubmit={resetPassword}>
          <label htmlFor="reset-code">Баталгаажуулах код</label>
          <input ref={codeRef} id="reset-code" className="forgot-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required placeholder="000000" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} disabled={busy} aria-describedby="reset-code-expiry"/>
          <small id="reset-code-expiry" className="forgot-expiry">{expiresIn>0?`Кодын хүчинтэй хугацаа: ${Math.floor(expiresIn/60)}:${String(expiresIn%60).padStart(2,'0')}`:'Кодын хугацаа дууссан. Шинэ код авна уу.'}</small>
          <label htmlFor="reset-new-password">Шинэ нууц үг</label>
          <div className="forgot-password-field"><input id="reset-new-password" type={showPassword?'text':'password'} autoComplete="new-password" minLength={12} maxLength={72} required value={password} onChange={e=>setPassword(e.target.value)} disabled={busy} aria-describedby="reset-password-policy"/><button type="button" disabled={busy} onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Нууц үг нуух':'Нууц үг харуулах'}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>
          <p id="reset-password-policy" className="forgot-policy">12-оос доошгүй тэмдэгттэй, латин том, жижиг үсэг, тоо, тусгай тэмдэгт агуулна.</p>
          <label htmlFor="reset-confirm-password">Шинэ нууц үг давтан оруулах</label>
          <input id="reset-confirm-password" type={showPassword?'text':'password'} autoComplete="new-password" minLength={12} maxLength={72} required value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={busy}/>
          {error&&<p className="forgot-error" role="alert">{error}</p>}
          <button type="submit" className="primary forgot-submit" disabled={busy||expiresIn===0}>{busy?'Шалгаж байна…':'Нууц үг шинэчлэх'}</button>
        </form>
        <div className="forgot-resend"><span>Код ирээгүй юу?</span><button type="button" disabled={busy||remaining>0} onClick={sendCode}>{remaining>0?`${remaining} секундийн дараа дахин авах`:'Код дахин авах'}</button></div>
      </>:<form onSubmit={sendCode}>
        <label htmlFor="reset-email">Цахим шуудангийн хаяг</label>
        <input ref={firstFieldRef} id="reset-email" type="email" autoComplete="email" required maxLength={160} placeholder="name@khurdan.gov.mn" value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/>
        {error&&<p className="forgot-error" role="alert">{error}</p>}
        <button type="submit" className="primary forgot-submit" disabled={busy}>{busy?'Код илгээж байна…':'Баталгаажуулах код авах'}</button>
      </form>}
      <button type="button" className="forgot-back" disabled={busy} onClick={onClose}><ArrowLeft size={15}/>Нэвтрэх хэсэг рүү буцах</button>
    </>}
  </section></div>
}
