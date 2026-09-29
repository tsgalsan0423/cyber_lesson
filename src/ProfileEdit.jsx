import React,{useState} from 'react'
import {X,Save} from 'lucide-react'

export default function ProfileEdit({user,request,onClose,onSaved}) {
  const [form,setForm]=useState({name:user.name||'',username:user.username||'',email:user.email||''})
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  const save=async e=>{
    e.preventDefault();setError('');setBusy(true)
    try{
      const data=await request('/auth/profile',{method:'PATCH',body:JSON.stringify(form)})
      onSaved(data.user)
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }
  return <div className="modal-bg">
    <form className="lesson-form" onSubmit={save} role="dialog" aria-modal="true" aria-label="Мэдээлэл солих">
      <button type="button" className="modal-close" aria-label="Хаах" disabled={busy} onClick={onClose}><X/></button>
      <span>ХУВИЙН МЭДЭЭЛЭЛ</span>
      <h2>Мэдээлэл солих</h2>
      <p className="analytics-note">Нэр, username болон и-мэйл хаягаа шинэчилнэ. Username болон и-мэйл давхардахгүй байх ёстой.</p>
      <label>Нэр<input required maxLength={120} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Таны нэр"/></label>
      <label>Username<input required maxLength={60} autoComplete="username" value={form.username} onChange={e=>setForm({...form,username:e.target.value})} placeholder="username"/></label>
      <label>И-мэйл<input required maxLength={160} type="email" autoComplete="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="name@example.com"/></label>
      {error&&<p className="error" role="alert">{error}</p>}
      <button className="primary" disabled={busy}><Save size={17}/>{busy?'Хадгалж байна…':'Өөрчлөлт хадгалах'}</button>
    </form>
  </div>
}
