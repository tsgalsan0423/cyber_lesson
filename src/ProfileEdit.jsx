import React,{useState} from 'react'
import {X,Save} from 'lucide-react'

export default function ProfileEdit({user,request,onClose,onSaved}) {
  const [form,setForm]=useState({surname:user.surname||'',name:user.name||'',department:user.department||'',position:user.position||'',email:user.email||''})
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
      <p className="analytics-note">И-мэйл хаяг нь таны нэвтрэх нэр болно.</p>
      <div className="form-row"><label>Овог<input maxLength={120} value={form.surname} onChange={e=>setForm({...form,surname:e.target.value})}/></label><label>Нэр<input required maxLength={120} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label></div>
      <label>Нэгж<input maxLength={240} value={form.department} onChange={e=>setForm({...form,department:e.target.value})}/></label>
      <label>Албан тушаал<input maxLength={240} value={form.position} onChange={e=>setForm({...form,position:e.target.value})}/></label>
      <label>И-мэйл / нэвтрэх нэр<input required maxLength={160} type="email" autoComplete="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="name@khurdan.gov.mn"/></label>
      {user.phone&&<label>Бүртгэлтэй утас<input readOnly value={user.phone}/></label>}
      {error&&<p className="error" role="alert">{error}</p>}
      <button className="primary" disabled={busy}><Save size={17}/>{busy?'Хадгалж байна…':'Өөрчлөлт хадгалах'}</button>
    </form>
  </div>
}
