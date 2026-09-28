import React, {useEffect,useMemo,useState} from 'react'
import {Activity, Award, BarChart3, Eye, RefreshCw, Target, TrendingUp, UserCheck, Users} from 'lucide-react'
const date=value=>value?new Date(value.replace(' ','T')+'Z').toLocaleString('mn-MN'):'Бүртгэлгүй'
const score=value=>value===null?'—':value+'%'
const pct=(value,total)=>total?Math.round(value/total*100):0
const clamp=value=>Math.max(0,Math.min(100,value||0))

export default function AdminAnalytics({request}) {
  const [data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true)
  const [query,setQuery]=useState(''),[role,setRole]=useState('student')
  const load=async()=>{setLoading(true);setError('');try{setData(await request('/admin/analytics'))}catch(e){setError(e.message)}finally{setLoading(false)}}
  useEffect(()=>{load()},[])
  const users=data?.users.filter(u=>(role==='all'||u.role===role)&&(u.name+' '+(u.username||'')).toLowerCase().includes(query.toLowerCase()))||[]
  const dashboard=useMemo(()=>{
    if(!data)return null
    const totalSlots=Math.max(1,data.summary.registered*data.courses.length)
    const completionSlots=data.courses.reduce((n,c)=>n+c.completed,0)
    return {
      access:pct(data.summary.accessed,data.summary.registered),
      active:pct(data.summary.active7,data.summary.registered),
      coverage:pct(data.summary.viewed,totalSlots),
      completion:pct(completionSlots,totalSlots),
      tested:pct(data.summary.tested,data.summary.registered),
      pass:data.summary.pass_rate??0,
      topCourses:[...data.courses].sort((a,b)=>(b.completed+b.tested+b.viewed)-(a.completed+a.tested+a.viewed)).slice(0,6)
    }
  },[data])
  const kpis=data?[
    {label:'Суралцагч',value:data.summary.registered,hint:'Админ бүртгэл ороогүй',icon:Users,tone:'blue'},
    {label:'Нэвтэрсэн',value:data.summary.accessed,hint:`${dashboard.access}% хэрэглэгч`,icon:UserCheck,tone:'cyan'},
    {label:'Хичээл нээсэн',value:data.summary.viewed,hint:`${dashboard.coverage}% хамрагдалт`,icon:Eye,tone:'violet'},
    {label:'Тэнцэлтийн хувь',value:score(data.summary.pass_rate),hint:'50% ба түүнээс дээш',icon:Award,tone:'green'}
  ]:[]
  return <section className="analytics" id="analytics">
    <div className="admin-title"><div><span>СУРГАЛТЫН ТАЙЛАН</span><h2>Хандалт ба үр дүн</h2></div><button onClick={load} disabled={loading}><RefreshCw size={14}/> {loading?'Уншиж байна…':'Шинэчлэх'}</button></div>
    {error&&<p className="error" role="alert">{error}</p>}
    {!data&&loading&&<p role="status">Тайлан ачаалж байна…</p>}
    {data&&<>
      <p className="analytics-note">Хандалт, хичээл нээсэн түүхийг {date(data.started_at)}-аас бүртгэнэ. Өмнөх шалгалтын оноонууд багтсан. Хичээл нээсэн нь уншиж дуусгасны баталгаа биш.</p>
      <div className="dashboard-kpis">{kpis.map(({label,value,hint,icon:Icon,tone})=><article className={`kpi-card ${tone}`} key={label}><span><Icon size={18}/></span><div><small>{label}</small><strong>{value}</strong><em>{hint}</em></div></article>)}</div>
      <div className="dashboard-graphics">
        <section className="analytics-box progress-panel"><div><h3>Ерөнхий гүйцэтгэл</h3><p>Нэвтрэлт, шалгалт, дүүргэлтийн нэгтгэл</p></div>
          <div className="donut-grid">
            {[['Нэвтрэлт',dashboard.access],['Шалгалт өгсөн',dashboard.tested],['Тэнцэлт',dashboard.pass],['Дүүргэлт',dashboard.completion]].map(([label,value])=><div className="donut" key={label} style={{'--value':clamp(value)}}><span>{clamp(value)}%</span><small>{label}</small></div>)}
          </div>
        </section>
        <section className="analytics-box funnel-panel"><h3>Сургалтын урсгал</h3><p>Суралцагчаас шалгалт дүүргэлт хүртэлх төлөв</p>
          <div className="funnel-steps">
            <div style={{'--w':'100%'}}><b>{data.summary.registered}</b><span>Бүртгэлтэй</span></div>
            <div style={{'--w':`${Math.max(12,dashboard.access)}%`}}><b>{data.summary.accessed}</b><span>Нэвтэрсэн</span></div>
            <div style={{'--w':`${Math.max(12,dashboard.tested)}%`}}><b>{data.summary.tested}</b><span>Шалгалт өгсөн</span></div>
            <div style={{'--w':`${Math.max(12,dashboard.completion)}%`}}><b>{dashboard.completion}%</b><span>Нийт дүүргэлт</span></div>
          </div>
        </section>
      </div>
      <div className="analytics-metrics">
        <div><span>Сүүлийн 7 хоног</span><strong>{data.summary.active7}</strong><small>Нэвтэрсэн суралцагч</small></div>
        <div><span>Нийт нэвтрэлт</span><strong>{data.summary.logins}</strong><small>Амжилттай login</small></div>
        <div><span>Шалгалтын оролдлого</span><strong>{data.summary.attempts}</strong><small>Бүх оролдлого</small></div>
        <div><span>Дундаж хамрагдалт</span><strong>{dashboard.coverage}%</strong><small>Нээсэн хичээл / боломжит хичээл</small></div>
      </div>
      <div className="analytics-columns">
        <section className="analytics-box"><h3><Activity size={16}/> Өдрийн хандалт</h3><p>Давхардалгүй суралцагч · Сүүлийн 7 өдөр · UTC</p>
          <div className="daily-bars">{data.daily.map(d=><div key={d.day}><span>{d.day.slice(5)}</span><div className="bar-track"><i style={{width:(d.users/Math.max(1,...data.daily.map(x=>x.users))*100)+'%'}}/></div><b>{d.users}</b></div>)}</div>
        </section>
        <section className="analytics-box"><h3><BarChart3 size={16}/> Сургалт тус бүрийн хамрагдалт</h3><p>Нээсэн / шалгалт өгсөн / тэнцсэн суралцагч</p>
          {dashboard.topCourses.map(c=><div className="course-metric course-graphic" key={c.id}><span>{c.title}</span><div><i style={{width:`${pct(c.viewed,Math.max(1,data.summary.registered))}%`}}/><i style={{width:`${pct(c.tested,Math.max(1,data.summary.registered))}%`}}/><i style={{width:`${pct(c.completed,Math.max(1,data.summary.registered))}%`}}/></div><b>{c.viewed} / {c.tested} / {c.completed}</b></div>)}
        </section>
      </div>
      <div className="analytics-legend"><span><i/> Нээсэн</span><span><i/> Шалгалт</span><span><i/> Тэнцсэн</span><span><Target size={14}/> Босго 50%</span><span><TrendingUp size={14}/> Илүү өндөр хувь сайн</span></div>
      <div className="admin-title"><div><span>ХЭРЭГЛЭГЧ ТУС БҮРЭЭР</span><h2>Суралцагчийн дэлгэрэнгүй</h2></div></div>
      <div className="analytics-filters"><label>Нэр эсвэл Username<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Хэрэглэгч хайх…"/></label><label>Эрх<select value={role} onChange={e=>setRole(e.target.value)}><option value="student">Суралцагч</option><option value="admin">Админ</option><option value="all">Бүгд</option></select></label></div>
      <p className="analytics-note">Хэрэглэгчийн мөрийг дарж хичээл болон оролдлого тус бүрийн оноог харна. Дундаж нь шалгалт өгсөн хичээлүүдийн сүүлийн онооны дундаж.</p>
      {!users.length&&<p className="analytics-empty">{data.users.some(u=>u.role==='student')?'Тохирох хэрэглэгч олдсонгүй.':'Суралцагч бүртгэгдээгүй байна. Доорх “Хэрэглэгч үүсгэх” товчоор нэмнэ үү.'}</p>}
      {users.map(u=><details className="learner-report" key={u.id}>
        <summary><div><b>{u.name}</b><small>@{u.username||'—'} · {u.role==='admin'?'Админ':'Суралцагч'}</small></div><span>Нээсэн <b>{u.viewed}/{data.courses.length}</b></span><span>Шалгалт <b>{u.tested}</b></span><span>Дүүргэсэн <b>{u.completed}</b></span><span>Дундаж <b>{score(u.average)}</b></span></summary>
        <p className="analytics-note">Нэвтрэлт: {u.logins} · Сүүлийн нэвтрэлт: {date(u.last_login)}</p>
        <div className="admin-table-wrap"><table><thead><tr><th>Хичээл</th><th>Нээсэн</th><th>Сүүлийн оноо</th><th>Шилдэг</th><th>Оролдлого</th><th>Сүүлийн үр дүн</th></tr></thead><tbody>{u.courses.map(c=><tr key={c.id}><td>{c.title}<small className="report-date">{c.last_exam?'Шалгалт: '+date(c.last_exam):c.completed?'Өмнөх дүүргэлттэй, оноо хадгалагдаагүй':''}</small></td><td>{c.opened?c.opens+' удаа':'Бүртгэлгүй'}<small className="report-date">{c.last_viewed?date(c.last_viewed):''}</small></td><td>{score(c.last_score)}</td><td>{score(c.best_score)}</td><td>{c.attempts}</td><td><span className={c.last_score===null?'':c.last_score>=50?'report-pass':'report-fail'}>{c.last_score===null?'Шалгалт өгөөгүй':c.last_score>=50?'Тэнцсэн':'Тэнцсэнгүй'}</span></td></tr>)}</tbody></table></div>
        <details className="attempt-history"><summary>Бүх оролдлогын түүх</summary><div className="admin-table-wrap"><table><thead><tr><th>Хичээл</th><th>Огноо</th><th>Оноо</th><th>Үр дүн</th></tr></thead><tbody>{u.courses.flatMap(c=>c.history.map(a=>({...a,title:c.title}))).sort((a,b)=>b.id-a.id).map(a=><tr key={a.id}><td>{a.title}</td><td>{date(a.created_at)}</td><td>{a.score}%</td><td>{a.passed?'Тэнцсэн':'Тэнцсэнгүй'}</td></tr>)}</tbody></table></div>{!u.tested&&<p>Шалгалтын оролдлого байхгүй.</p>}</details>
      </details>)}
    </>}
  </section>
}
