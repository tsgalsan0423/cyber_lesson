import React,{useEffect,useRef,useState} from 'react'
import {Bell,BookOpen,CheckCheck,FileText} from 'lucide-react'
import './notifications.css'

const formatDate=value=>new Date(value.includes('T')?value:value.replace(' ','T')+'Z').toLocaleString('mn-MN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})

export default function Notifications({request}){
  const [items,setItems]=useState([]),[open,setOpen]=useState(false),[error,setError]=useState('')
  const wrap=useRef(null)
  const load=()=>request('/notifications').then(setItems).catch(()=>{})
  useEffect(()=>{load();const timer=setInterval(load,60000);window.addEventListener('focus',load);return()=>{clearInterval(timer);window.removeEventListener('focus',load)}},[])
  useEffect(()=>{const close=event=>{if(!wrap.current?.contains(event.target))setOpen(false)};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[])
  const unread=items.filter(item=>!Number(item.is_read)).length
  const readAll=async()=>{try{await request('/notifications/read-all',{method:'POST',body:'{}'});setItems(current=>current.map(item=>({...item,is_read:1})));setError('')}catch(e){setError(e.message)}}
  const select=async item=>{
    if(!Number(item.is_read))try{await request(`/notifications/${item.id}/read`,{method:'POST',body:'{}'});setItems(current=>current.map(value=>value.id===item.id?{...value,is_read:1}:value))}catch(e){setError(e.message);return}
    setOpen(false)
    const target=item.target_url?document.querySelector(item.target_url):null
    if(target){window.history.replaceState({},'',item.target_url);target.scrollIntoView({behavior:'smooth',block:'start'})}
  }
  return <div className="notification-wrap" ref={wrap}>
    <button type="button" className="notification-button" aria-label={`Мэдэгдэл${unread?` — ${unread} уншаагүй`:''}`} aria-expanded={open} onClick={()=>{setOpen(value=>{if(!value)load();return !value})}}><Bell size={19}/>{unread>0&&<span>{unread>99?'99+':unread}</span>}</button>
    {open&&<div className="notification-panel" role="dialog" aria-label="Мэдэгдэл">
      <div className="notification-head"><div><b>Мэдэгдэл</b><small>{unread?`${unread} уншаагүй`:'Шинэ мэдэгдэл алга'}</small></div>{unread>0&&<button type="button" onClick={readAll}><CheckCheck size={15}/> Бүгдийг уншсан</button>}</div>
      {error&&<p className="notification-error">{error}</p>}
      <div className="notification-list">{items.map(item=><button type="button" key={item.id} className={Number(item.is_read)?'read':'unread'} onClick={()=>select(item)}>{item.type.includes('news')?<FileText/>:<BookOpen/>}<span><b>{item.title}</b><small>{item.message}</small><time>{formatDate(item.created_at)}</time></span></button>)}{!items.length&&<div className="notification-empty"><Bell/><b>Мэдэгдэл алга байна</b><span>Шинэ хичээл, мэдээ энд харагдана.</span></div>}</div>
    </div>}
  </div>
}
