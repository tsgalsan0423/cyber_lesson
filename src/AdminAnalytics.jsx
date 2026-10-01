import React, {useEffect,useMemo,useState} from 'react'
import {ReportActions,AuditLog} from './ReportActions.jsx'
import {ActivityTrend,AttentionList,CourseBars,ScoreDistribution} from './AnalyticsCharts.jsx'
import {Activity, Award, BarChart3, Eye, RefreshCw, Target, TrendingUp, UserCheck, Users} from 'lucide-react'
import {compareDepartments,compareStaff} from './staffOrder.js'
const date=value=>value?new Date(value.includes('T')?value:value.replace(' ','T')+'Z').toLocaleString('mn-MN'):'Бүртгэлгүй'
const score=value=>value===null?'—':value+'%'
const pct=(value,total)=>total?Math.round(value/total*100):0
const clamp=value=>Math.max(0,Math.min(100,value||0))

export default function AdminAnalytics({request}) {
  const [data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true)
  const [query,setQuery]=useState(''),[role,setRole]=useState('student'),[course,setCourse]=useState('all'),[department,setDepartment]=useState('all')
  const load=async()=>{setLoading(true);setError('');try{setData(await request('/admin/analytics'))}catch(e){setError(e.message)}finally{setLoading(false)}}
  useEffect(()=>{load()},[])
  const departments=useMemo(()=>[...new Set((data?.users||[]).map(u=>u.department).filter(Boolean))].sort(compareDepartments),[data])
  const users=useMemo(()=>data?.users.filter(u=>(role==='all'||u.role===role)&&(department==='all'||u.department===department)&&(`${u.surname||''} ${u.name} ${u.email||''} ${u.position||''}`).toLowerCase().includes(query.toLowerCase()))||[],[data,role,department,query])
  const departmentUsers=useMemo(()=>department==='all'?[]:(data?.users||[]).filter(u=>u.department===department).sort(compareStaff),[data,department])
  const dashboard=useMemo(()=>{
    if(!data)return null
    const visibleCourses=course==='all'?data.courses:data.courses.filter(c=>String(c.id)===course)
    const totalSlots=Math.max(1,users.length*visibleCourses.length)
    const filteredCourses=visibleCourses.map(l=>({...l,viewed:users.filter(u=>u.courses.find(c=>c.id===l.id)?.opened).length,tested:users.filter(u=>u.courses.find(c=>c.id===l.id)?.attempts>0).length,completed:users.filter(u=>u.courses.find(c=>c.id===l.id)?.completed).length}))
    const relevant=users.flatMap(u=>u.courses.filter(c=>visibleCourses.some(l=>l.id===c.id)))
    const attempts=relevant.flatMap(c=>c.history)
    const completionSlots=filteredCourses.reduce((n,c)=>n+c.completed,0)
    const accessed=users.filter(u=>Number(u.logins)>0).length
    const testedUsers=users.filter(u=>u.courses.some(c=>visibleCourses.some(l=>l.id===c.id)&&c.attempts>0)).length
    return {
      registered:users.length,accessed,testedUsers,attempts:attempts.length,
      access:pct(accessed,users.length),
      active:pct(users.filter(u=>u.last_login&&Date.now()-new Date(u.last_login).getTime()<7*86400000).length,users.length),
      coverage:pct(relevant.filter(c=>c.opened).length,totalSlots),
      completion:pct(completionSlots,totalSlots),
      tested:pct(testedUsers,users.length),
      pass:attempts.length?pct(attempts.filter(a=>a.passed).length,attempts.length):0,
      courses:filteredCourses,
      topCourses:[...filteredCourses].sort((a,b)=>(b.completed+b.tested+b.viewed)-(a.completed+a.tested+a.viewed)).slice(0,10)
    }
  },[data,users,course])
  const kpis=data?[
    {label:'Суралцагч',value:dashboard.registered,hint:'Шүүлтүүрт таарсан',icon:Users,tone:'blue'},
    {label:'Нэвтэрсэн',value:dashboard.accessed,hint:`${dashboard.access}% хэрэглэгч`,icon:UserCheck,tone:'cyan'},
    {label:'Шалгалт өгсөн',value:dashboard.testedUsers,hint:`${dashboard.tested}% хэрэглэгч`,icon:Eye,tone:'violet'},
    {label:'Тэнцэлтийн хувь',value:score(dashboard.pass),hint:'Оролдлогоос тооцов',icon:Award,tone:'green'}
  ]:[]
  return <section className="analytics" id="analytics">
    <div className="admin-title"><div><span>СУРГАЛТЫН ТАЙЛАН</span><h2>Хандалт ба үр дүн</h2></div><button onClick={load} disabled={loading}><RefreshCw size={14}/> {loading?'Уншиж байна…':'Шинэчлэх'}</button></div>
    {error&&<p className="error" role="alert">{error}</p>}
    {!data&&loading&&<p role="status">Тайлан ачаалж байна…</p>}
    {data&&<>
      <div className="bi-slicers" aria-label="Dashboard шүүлтүүр">
        <label>Хэрэглэгч<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Нэр, и-мэйл, албан тушаал…"/></label>
        <label>Нэгж<select value={department} onChange={e=>{setDepartment(e.target.value);if(e.target.value!=='all')setRole('all')}}><option value="all">Бүх нэгж</option>{departments.map(d=><option key={d}>{d}</option>)}</select></label>
        <label>Эрх<select value={role} onChange={e=>setRole(e.target.value)}><option value="student">Суралцагч</option><option value="admin">Админ</option><option value="all">Бүгд</option></select></label>
        <label>Хичээл<select value={course} onChange={e=>setCourse(e.target.value)}><option value="all">Бүх хичээл</option>{data.courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
        <button onClick={()=>{setQuery('');setRole('student');setCourse('all');setDepartment('all')}}>Шүүлтүүр цэвэрлэх</button>
      </div>
      {department!=='all'&&<section className="department-users" aria-live="polite"><div className="department-users-head"><div><h3>{department}</h3><p>Тус нэгжид бүртгэлтэй бүх хэрэглэгч</p></div><strong>{departmentUsers.length}</strong></div><div className="admin-table-wrap"><table><thead><tr><th>Хэрэглэгч</th><th>И-мэйл</th><th>Албан тушаал</th><th>Эрх</th></tr></thead><tbody>{departmentUsers.map(u=><tr key={u.id}><td><b>{u.surname?`${u.surname} `:''}{u.name}</b></td><td>{u.email||u.username}</td><td>{u.position||'—'}</td><td><span className={`role ${u.role}`}>{u.role==='admin'?'Админ':'Суралцагч'}</span></td></tr>)}</tbody></table></div></section>}
      <ReportActions users={users}/>
      <p className="analytics-note">Хандалт, хичээл нээсэн түүхийг {date(data.started_at)}-аас бүртгэнэ. Өмнөх шалгалтын оноонууд багтсан. Хичээл нээсэн нь уншиж дуусгасны баталгаа биш.</p>
      <div className="dashboard-kpis">{kpis.map(({label,value,hint,icon:Icon,tone})=><article className={`kpi-card ${tone}`} key={label}><span><Icon size={18}/></span><div><small>{label}</small><strong>{value}</strong><em>{hint}</em></div></article>)}</div>
      <div className="bi-grid bi-grid-top">
        <section className="analytics-box progress-panel"><div><h3>Ерөнхий гүйцэтгэл</h3><p>Сонгосон хэрэглэгч, хичээлийн нэгтгэл</p></div>
          <div className="donut-grid">
            {[['Нэвтрэлт',dashboard.access],['Шалгалт өгсөн',dashboard.tested],['Тэнцэлт',dashboard.pass],['Дүүргэлт',dashboard.completion]].map(([label,value])=><div className="donut" key={label} style={{'--value':clamp(value)}}><span>{clamp(value)}%</span><small>{label}</small></div>)}
          </div>
        </section>
        <section className="analytics-box funnel-panel"><h3>Сургалтын урсгал</h3><p>Суралцагчаас шалгалт дүүргэлт хүртэлх төлөв</p>
          <div className="funnel-steps">
            <div style={{'--w':'100%'}}><b>{dashboard.registered}</b><span>Шүүлтүүрт таарсан</span></div>
            <div style={{'--w':`${Math.max(12,dashboard.access)}%`}}><b>{dashboard.accessed}</b><span>Нэвтэрсэн</span></div>
            <div style={{'--w':`${Math.max(12,dashboard.tested)}%`}}><b>{dashboard.testedUsers}</b><span>Шалгалт өгсөн</span></div>
            <div style={{'--w':`${Math.max(12,dashboard.completion)}%`}}><b>{dashboard.completion}%</b><span>Нийт дүүргэлт</span></div>
          </div>
        </section>
      </div>
      <div className="analytics-metrics">
        <div><span>Сүүлийн 7 хоног</span><strong>{data.summary.active7}</strong><small>Нэвтэрсэн суралцагч</small></div>
        <div><span>Нийт нэвтрэлт</span><strong>{data.summary.logins}</strong><small>Амжилттай login</small></div>
        <div><span>Шалгалтын оролдлого</span><strong>{dashboard.attempts}</strong><small>Шүүлтүүрт таарсан</small></div>
        <div><span>Дундаж хамрагдалт</span><strong>{dashboard.coverage}%</strong><small>Нээсэн хичээл / боломжит хичээл</small></div>
      </div>
      <div className="bi-grid bi-grid-main">
        <section className="analytics-box bi-wide"><h3><Activity size={16}/> Өдрийн хандалтын өөрчлөлт</h3><p>Сүүлийн 7 өдөр нэвтэрсэн давхардалгүй суралцагч</p>
          <ActivityTrend daily={data.daily}/>
        </section>
        <section className="analytics-box"><h3><BarChart3 size={16}/> Онооны тархалт</h3><p>Шалгалтын бүх оролдлогыг онооны бүлгээр</p><ScoreDistribution users={users}/>
        </section>
        <section className="analytics-box bi-wide"><h3><BarChart3 size={16}/> Хичээл тус бүрийн хамрагдалт</h3><p>Цэнхэр: нээсэн · Нил ягаан: шалгалт өгсөн · Ногоон: дүүргэсэн</p>
          <CourseBars courses={dashboard.topCourses} total={dashboard.registered}/>
        </section>
        <section className="analytics-box"><h3><Target size={16}/> Анхаарах суралцагч</h3><p>Унасан шалгалт, дуусаагүй хичээлээр эрэмбэлэв</p><AttentionList users={users}/>
        </section>
      </div>
      <div className="analytics-legend"><span><i/> Нээсэн</span><span><i/> Шалгалт</span><span><i/> Тэнцсэн</span><span><Target size={14}/> Босго 50%</span><span><TrendingUp size={14}/> Илүү өндөр хувь сайн</span></div>
    </>}
    <AuditLog request={request}/>
  </section>
}
