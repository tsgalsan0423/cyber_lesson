import React,{useEffect,useState} from 'react'

export default function GlobalLoadingOverlay(){
  const [active,setActive]=useState(false)
  const [slow,setSlow]=useState(false)
  useEffect(()=>{
    let slowTimer
    const handleLoading=event=>{
      window.clearTimeout(slowTimer)
      const next=Boolean(event.detail?.active)
      setActive(next)
      setSlow(false)
      if(next)slowTimer=window.setTimeout(()=>setSlow(true),7000)
    }
    window.addEventListener('securelab:loading',handleLoading)
    return()=>{window.clearTimeout(slowTimer);window.removeEventListener('securelab:loading',handleLoading)}
  },[])
  if(!active)return null
  return <div className="global-loading-shadow" role="status" aria-live="polite" aria-label="Мэдээлэл уншиж байна">
    <div className="global-loading-panel">
      <span className="global-loading-spinner" aria-hidden="true"/>
      <b>{slow?'Сүлжээ удааширч байна':'Мэдээлэл уншиж байна'}</b>
      <small>{slow?'Түр хүлээнэ үү. Хуудсыг дахин дахин шинэчлэх шаардлагагүй.':'Түр хүлээнэ үү…'}</small>
    </div>
  </div>
}
