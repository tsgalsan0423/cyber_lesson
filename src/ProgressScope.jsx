import React,{useEffect,useMemo,useState} from 'react'
import {Award,BookOpen,RefreshCw,TrendingUp,Users} from 'lucide-react'
import {compareDepartments,compareStaff} from './staffOrder.js'
import './progress-scope.css'

const pct=(value,total)=>total?Math.round(value/total*100):0

export default function ProgressScope({request}){
  const [data,setData]=useState(null),[unit,setUnit]=useState('all'),[loading,setLoading]=useState(true),[error,setError]=useState('')
  const load=async()=>{setLoading(true);setError('');try{setData(await request('/progress-scope'))}catch(e){setError(e.message)}finally{setLoading(false)}}
  useEffect(()=>{load()},[])
  const units=useMemo(()=>[...new Set((data?.users||[]).map(user=>user.department).filter(Boolean))].sort(compareDepartments),[data])
  const users=useMemo(()=>(data?.users||[]).filter(user=>unit==='all'||user.department===unit).sort(compareStaff),[data,unit])
  const stats=useMemo(()=>{
    const averages=users.map(user=>user.average).filter(Number.isFinite)
    return{total:users.length,completed:users.filter(user=>data?.lesson_count&&user.completed>=data.lesson_count).length,average:averages.length?Math.round(averages.reduce((sum,value)=>sum+value,0)/averages.length):null}
  },[users,data])
  return <section className="page-section scoped-progress" id="progress">
    <div className="section-head"><div><span>СУРГАЛТЫН ЯВЦ</span><h2>Явц</h2></div><button className="scope-refresh" type="button" onClick={load} disabled={loading}><RefreshCw size={15}/>{loading?'Уншиж байна…':'Шинэчлэх'}</button></div>
    {error&&<p className="error" role="alert">{error}</p>}
    {!data&&loading&&<p role="status">Явцын мэдээлэл уншиж байна…</p>}
    {data&&<>
      <div className="scope-banner"><TrendingUp/><div><b>{data.scope.label}</b><span>Таны эрхийн хүрээнд харагдах сургалтын явц</span></div></div>
      {units.length>1&&<label className="scope-unit-filter">Нэгж<select value={unit} onChange={event=>setUnit(event.target.value)}><option value="all">Бүх харагдах нэгж</option>{units.map(name=><option key={name} value={name}>{name}</option>)}</select></label>}
      <div className="scope-kpis"><article><Users/><div><small>Харагдах хүмүүс</small><strong>{stats.total}</strong></div></article><article><BookOpen/><div><small>Бүх хичээлээ дуусгасан</small><strong>{stats.completed}</strong></div></article><article><Award/><div><small>Дундаж оноо</small><strong>{stats.average===null?'—':`${stats.average}%`}</strong></div></article></div>
      <div className="scope-table-wrap"><table><thead><tr><th>Албан хаагч</th><th>Нэгж / Албан тушаал</th><th>Хичээлийн явц</th><th>Дундаж оноо</th></tr></thead><tbody>{users.map(user=>{const progress=pct(user.completed,data.lesson_count);return <tr key={user.id}><td><b>{user.surname?`${user.surname} `:''}{user.name}</b><small>{user.email}</small></td><td>{user.department||'—'}<small>{user.position||'—'}</small></td><td><div className="scope-progress-value"><span>{user.completed}/{data.lesson_count}</span><b>{progress}%</b></div><div className="scope-progress-track"><i style={{width:`${progress}%`}}/></div></td><td><strong>{user.average===null?'—':`${user.average}%`}</strong></td></tr>})}</tbody></table>{!users.length&&<p className="analytics-empty">Энэ хүрээнд бүртгэлтэй албан хаагч алга.</p>}</div>
    </>}
  </section>
}
