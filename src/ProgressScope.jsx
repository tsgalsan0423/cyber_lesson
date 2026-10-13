import React,{useEffect,useMemo,useState} from 'react'
import {Award,BookOpen,Download,LockKeyhole,RefreshCw,TrendingUp,Users} from 'lucide-react'
import {compareDepartments,compareStaff} from './staffOrder.js'
import PasswordReset from './PasswordReset.jsx'
import './progress-scope.css'

const pct=(value,total)=>total?Math.round(value/total*100):0
const usersPerPage=10
const exportScopes=new Set(['department_head','department_senior','division_head','division_senior'])
const csvCell=value=>{
  if(typeof value==='number'&&Number.isFinite(value))return String(value)
  const text=String(value??'')
  const safe=/^[\t\r ]*[=+\-@]/.test(text)?`'${text}`:text
  return `"${safe.replaceAll('"','""')}"`
}

function exportProgress(users){
  const rows=[['Овог','Нэр','Цахим шуудан','Нэгж','Албан тушаал','Хичээл','Нээсэн','Оролдлого','Сүүлийн оноо','Шилдэг оноо','Дуусгасан']]
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
  const [page,setPage]=useState(1)
  const [passwordUser,setPasswordUser]=useState(null),[notice,setNotice]=useState('')
  const load=async()=>{setLoading(true);setError('');try{setData(await request('/progress-scope'))}catch(e){setError(e.message)}finally{setLoading(false)}}
  useEffect(()=>{load()},[])
  const units=useMemo(()=>[...new Set((data?.users||[]).map(user=>user.department).filter(Boolean))].sort(compareDepartments),[data])
  const users=useMemo(()=>(data?.users||[]).filter(user=>unit==='all'||user.department===unit).sort(compareStaff),[data,unit])
  const pageCount=Math.max(1,Math.ceil(users.length/usersPerPage))
  const pagedUsers=useMemo(()=>users.slice((page-1)*usersPerPage,page*usersPerPage),[users,page])
  useEffect(()=>{setPage(1)},[unit])
  useEffect(()=>{setPage(current=>Math.min(current,pageCount))},[pageCount])
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
      <div className="scope-table-wrap"><table><thead><tr><th>Албан хаагч</th><th>Нэгж / Албан тушаал</th><th>Хичээлийн явц</th><th>Дундаж оноо</th>{canManagePasswords&&<th>Удирдах</th>}</tr></thead><tbody>{pagedUsers.map(user=>{const progress=pct(user.completed,data.lesson_count);return <tr key={user.id}><td><b>{user.surname?`${user.surname} `:''}{user.name}</b><small>{user.email}</small></td><td>{user.department||'—'}<small>{user.position||'—'}</small></td><td><div className="scope-progress-value"><span>{user.completed}/{data.lesson_count}</span><b>{progress}%</b></div><div className="scope-progress-track"><i style={{width:`${progress}%`}}/></div></td><td><strong>{user.average===null?'—':`${user.average}%`}</strong></td>{canManagePasswords&&<td>{user.can_reset_password&&<button type="button" className="scope-password-button" onClick={()=>{setPasswordUser(user);setNotice('')}}><LockKeyhole size={14}/>Нууц үг шинэчлэх</button>}</td>}</tr>})}</tbody></table>{!users.length&&<p className="analytics-empty">Энэ хүрээнд бүртгэлтэй албан хаагч алга.</p>}</div>
      {users.length>usersPerPage&&<nav className="user-pagination" aria-label="Явцын хэрэглэгчдийн хуудас"><button type="button" disabled={page===1} onClick={()=>setPage(current=>current-1)} aria-label="Өмнөх хуудас">‹</button>{Array.from({length:pageCount},(_,index)=>index+1).map(pageNumber=><button type="button" key={pageNumber} className={pageNumber===page?'active':''} aria-current={pageNumber===page?'page':undefined} onClick={()=>setPage(pageNumber)}>{pageNumber}</button>)}<button type="button" disabled={page===pageCount} onClick={()=>setPage(current=>current+1)} aria-label="Дараагийн хуудас">›</button></nav>}
      <p className="user-page-summary">{users.length?`${(page-1)*usersPerPage+1}–${Math.min(page*usersPerPage,users.length)} / ${users.length} хэрэглэгч`:'0 хэрэглэгч'}</p>
    </>}
    {passwordUser&&<PasswordReset user={passwordUser} request={request} passwordPath={`/managed-users/${passwordUser.id}/password`} onClose={()=>setPasswordUser(null)} onSaved={()=>{setPasswordUser(null);setNotice('Нууц үг шинэчлэгдлээ. Хэрэглэгчийн хуучин нэвтрэлт хүчингүй болсон.')}}/>}
  </section>
}
