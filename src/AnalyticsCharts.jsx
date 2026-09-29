import React from 'react'

export function ActivityTrend({daily=[]}) {
  const width=620,height=220,pad={l:38,r:18,t:18,b:36}
  const max=Math.max(1,...daily.map(d=>Number(d.users)))
  const points=daily.map((d,i)=>({x:pad.l+i*((width-pad.l-pad.r)/Math.max(1,daily.length-1)),y:height-pad.b-(Number(d.users)/max)*(height-pad.t-pad.b),...d}))
  const line=points.map(p=>`${p.x},${p.y}`).join(' ')
  const area=points.length?`${pad.l},${height-pad.b} ${line} ${points.at(-1).x},${height-pad.b}`:''
  return <div className="bi-chart trend-chart"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Сүүлийн долоон өдрийн нэвтэрсэн суралцагчийн график">
    <defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2563eb" stopOpacity=".3"/><stop offset="1" stopColor="#2563eb" stopOpacity="0"/></linearGradient></defs>
    {[0,.25,.5,.75,1].map(n=><g key={n}><line className="chart-grid" x1={pad.l} x2={width-pad.r} y1={pad.t+n*(height-pad.t-pad.b)} y2={pad.t+n*(height-pad.t-pad.b)}/><text className="chart-axis" x={pad.l-8} y={pad.t+n*(height-pad.t-pad.b)+4} textAnchor="end">{Math.round(max*(1-n))}</text></g>)}
    {area&&<polygon points={area} fill="url(#trendFill)"/>}<polyline className="trend-line" points={line}/>
    {points.map(p=><g key={p.day}><circle className="trend-point" cx={p.x} cy={p.y} r="5"/><text className="chart-value" x={p.x} y={p.y-11} textAnchor="middle">{p.users}</text><text className="chart-axis" x={p.x} y={height-12} textAnchor="middle">{p.day.slice(5)}</text><title>{p.day}: {p.users} хэрэглэгч</title></g>)}
  </svg></div>
}

export function CourseBars({courses=[],total=0}) {
  return <div className="bi-course-bars">{courses.map(c=>{
    const viewed=total?Math.round(c.viewed/total*100):0,tested=total?Math.round(c.tested/total*100):0,completed=total?Math.round(c.completed/total*100):0
    return <div className="bi-course-row" key={c.id}><div className="bi-course-label" title={c.title}><b>{c.title}</b><small>{c.completed}/{total} дүүргэсэн</small></div><div className="bi-bar-stack"><span><i style={{width:viewed+'%'}}/><em>{viewed}%</em></span><span><i style={{width:tested+'%'}}/><em>{tested}%</em></span><span><i style={{width:completed+'%'}}/><em>{completed}%</em></span></div></div>
  })}</div>
}

export function ScoreDistribution({users=[]}) {
  const scores=users.flatMap(u=>u.courses.flatMap(c=>c.history.map(a=>Number(a.score))))
  const groups=[{label:'0–49',min:0,max:49,tone:'fail'},{label:'50–69',min:50,max:69,tone:'warn'},{label:'70–89',min:70,max:89,tone:'good'},{label:'90–100',min:90,max:100,tone:'great'}]
  const values=groups.map(g=>({...g,count:scores.filter(s=>s>=g.min&&s<=g.max).length}))
  const max=Math.max(1,...values.map(v=>v.count))
  return <div className="score-distribution">{values.map(v=><div key={v.label} className={v.tone}><div><i style={{height:`${Math.max(v.count?10:0,v.count/max*100)}%`}}><span>{v.count}</span></i></div><b>{v.label}%</b></div>)}</div>
}

export function AttentionList({users=[]}) {
  const rows=users.map(u=>({id:u.id,name:u.name,username:u.username,unfinished:u.courses.filter(c=>!c.completed).length,failed:u.courses.filter(c=>c.last_score!==null&&c.last_score<50).length,average:u.average})).filter(u=>u.unfinished||u.failed).sort((a,b)=>b.failed-a.failed||b.unfinished-a.unfinished).slice(0,6)
  return <div className="attention-list">{rows.length?rows.map(u=><div key={u.id}><span>{u.name}<small>@{u.username||'—'}</small></span><b className={u.failed?'danger':''}>{u.failed?`${u.failed} унасан`:`${u.unfinished} дутуу`}</b><em>{u.average===null?'Оноогүй':u.average+'%'}</em></div>):<p className="analytics-empty">Анхаарах суралцагч алга.</p>}</div>
}
