import React,{useEffect,useMemo,useState} from 'react'
import {Award,BookOpen,Download,LockKeyhole,RefreshCw,TrendingUp,Users} from 'lucide-react'
import {compareDepartments,compareStaff} from './staffOrder.js'
import PasswordReset from './PasswordReset.jsx'
import './progress-scope.css'

const pct=(value,total)=>total?Math.round(value/total*100):0
const exportScopes=new Set(['department_head','department_senior','division_head','division_senior'])
const csvCell=value=>{
  if(typeof value==='number'&&Number.isFinite(value))return String(value)
  const text=String(value??'')
  const safe=/^[\t\r ]*[=+\-@]/.test(text)?`'${text}`:text
  return `"${safe.replaceAll('"','""')}"`
}

function exportProgress(users){
  const rows=[['Овог','Нэр','И-мэйл','Нэгж','Албан тушаал','Хичээл','Нээсэн','Оролдлого','Сүүлийн оноо','Шилдэг оноо','Дуусгасан']]
  users.forEach(user=>(user.courses||[]).forEach(course=>rows.push([
    user.surname||'',user.name,user.email||user.username||'',user.department||'',user.position||'',course.title,
    course.opened?'Тийм':'Үгүй',course.attempts||0,course.last_score??'',course.best_score??'',course.completed?'Тийм':'Үгүй'
  ])))
  const content='\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')
  const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}))
  const link=document.createElement('a')
  link.href=url
  link.download=`surgaltiin-yavts-${new Date().toISOString().slice(0,10)}.csv`
  document.body.appendChild(link);link.click();link.remove()
  setTimeout(()=>URL.revokeObjectURL(url),1000)
}

export default function ProgressScope({request}){
  const [data,setData]=useState(null),[unit,setUnit]=useState('all'),[loading,setLoading]=useState(true),[error,setError]=useState('')
  const [passwordUser,setPasswordUser]=useState(null),[notice,setNotice]=useState('')
  const load=async()=>{setLoading(true);setError('');try{setData(await request('/progress-scope'))}catch(e){setError(e.message)}finally{setLoading(false)}}
  useEffect(()=>{load()},[])
  const units=useMemo(()=>[...new Set((data?.users||[]).map(user=>user.department).filter(Boolean))].sort(compareDepartments),[data])
  const users=useMemo(()=>(data?.users||[]).filter(user=>unit==='all'||user.department===unit).sort(compareStaff),[data,unit])
  const stats=useMemo(()=>{
    const averages=users.map(user=>user.average).filter(Number.isFinite)
    return{total:users.length,completed:users.filter(user=>data?.lesson_count&&user.completed>=data.lesson_count).length,average:averages.length?Math.round(averages.reduce((sum,value)=>sum+value,0)/averages.length):null}
  },[users,data])
  const canExport=exportScopes.has(data?.scope?.code)
  const canManagePasswords=Boolean(data?.users?.some(user=>user.can_reset_password))
  return <section className="page-section scoped-progress" id="progress">
    <div className="section-head"><div><span>СУРГАЛТЫН ЯВЦ</span><h2>Явц</h2></div><div className="scope-actions">{canExport&&<button className="scope-export" type="button" onClick={()=>exportProgress(users)} disabled={!users.length}><Download size={15}/>Excel татах</button>}<button className="scope-refresh" type="button" onClick={load} disabled={loading}><RefreshCw size={15}/>{loading?'Уншиж байна…':'Шинэчлэх'}</button></div></div>
    {error&&<p className="error" role="alert">{error}</p>}
    {notice&&<p className="success-notice" role="status">{notice}</p>}
    {!data&&loading&&<p role="status">Явцын мэдээлэл уншиж байна…</p>}
    {data&&<>
      <div className="scope-banner"><TrendingUp/><div><b>{data.scope.label}</b><span>Таны эрхийн хүрээнд харагдах сургалтын явц</span></div></div>
      {units.length>1&&<label className="scope-unit-filter">Нэгж<select value={unit} onChange={event=>setUnit(event.target.value)}><option value="all">Бүх харагдах нэгж</option>{units.map(name=><option key={name} value={name}>{name}</option>)}</select></label>}
      <div className="scope-kpis"><article><Users/><div><small>Харагдах хүмүүс</small><strong>{stats.total}</strong></div></article><article><BookOpen/><div><small>Бүх хичээлээ дуусгасан</small><strong>{stats.completed}</strong></div></article><article><Award/><div><small>Дундаж оноо</small><strong>{stats.average===null?'—':`${stats.average}%`}</strong></div></article></div>
      <div className="scope-table-wrap"><table><thead><tr><th>Албан хаагч</th><th>Нэгж / Албан тушаал</th><th>Хичээлийн явц</th><th>Дундаж оноо</th>{canManagePasswords&&<th>Удирдах</th>}</tr></thead><tbody>{users.map(user=>{const progress=pct(user.completed,data.lesson_count);return <tr key={user.id}><td><b>{user.surname?`${user.surname} `:''}{user.name}</b><small>{user.email}</small></td><td>{user.department||'—'}<small>{user.position||'—'}</small></td><td><div className="scope-progress-value"><span>{user.completed}/{data.lesson_count}</span><b>{progress}%</b></div><div className="scope-progress-track"><i style={{width:`${progress}%`}}/></div></td><td><strong>{user.average===null?'—':`${user.average}%`}</strong></td>{canManagePasswords&&<td>{user.can_reset_password&&<button type="button" className="scope-password-button" onClick={()=>{setPasswordUser(user);setNotice('')}}><LockKeyhole size={14}/>Нууц үг шинэчлэх</button>}</td>}</tr>})}</tbody></table>{!users.length&&<p className="analytics-empty">Энэ хүрээнд бүртгэлтэй албан хаагч алга.</p>}</div>
    </>}
    {passwordUser&&<PasswordReset user={passwordUser} request={request} passwordPath={`/managed-users/${passwordUser.id}/password`} onClose={()=>setPasswordUser(null)} onSaved={()=>{setPasswordUser(null);setNotice('Нууц үг шинэчлэгдлээ. Хэрэглэгчийн хуучин нэвтрэлт хүчингүй болсон.')}}/>}
  </section>
}
