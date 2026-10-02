import React,{useState} from 'react'
import {X,Eye,EyeOff} from 'lucide-react'

export default function PasswordReset({user,request,onClose,onSaved,self=false,mandatory=false,passwordPath=''}) {
  const [currentPassword,setCurrentPassword]=useState('')
  const [password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[show,setShow]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const save=async e=>{e.preventDefault();setError('');if(password!==confirm){setError('Нууц үг давтан оруулсантай таарахгүй байна.');return}setBusy(true);try{await request(self?'/auth/password':passwordPath||'/admin/users/'+user.id+'/password',{method:'POST',body:JSON.stringify({password,...(self?{currentPassword,confirmation:confirm}:{})})});onSaved()}catch(e){setError(e.message)}finally{setBusy(false)}}
  return <div className="modal-bg"><form className="lesson-form" onSubmit={save} role="dialog" aria-modal="true" aria-label="Нууц үг солих">
    {!mandatory&&<button type="button" className="modal-close" aria-label="Хаах" disabled={busy} onClick={onClose}><X/></button>}
    <h2>Нууц үг шинэчлэх</h2><p>{user.name} · {user.email||user.username}</p>
    {mandatory&&<p className="error">Анхны нууц үг утасны дугаар тул үргэлжлүүлэхийн өмнө шинэ нууц үг сонгоно уу.</p>}
    <p className="analytics-note">12–72 тэмдэгттэй, том болон жижиг үсэг, тоо, тусгай тэмдэгт агуулна. Өмнөх нэвтрэлтүүд хүчингүй болно.</p>
    {self&&<label>Одоогийн нууц үг<input autoFocus required autoComplete="current-password" type={show?'text':'password'} value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/></label>}
    <label>Шинэ нууц үг<input required minLength={12} maxLength={72} autoComplete="new-password" type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)}/></label>
    <label>Дахин оруулах<input required minLength={12} maxLength={72} autoComplete="new-password" type={show?'text':'password'} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
    <button type="button" className="preview-btn" onClick={()=>setShow(!show)}>{show?<EyeOff size={16}/>:<Eye size={16}/>} {show?'Нуух':'Харуулах'}</button>
    {error&&<p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy?'Шинэчилж байна…':'Нууц үг шинэчлэх'}</button>
  </form></div>
}
