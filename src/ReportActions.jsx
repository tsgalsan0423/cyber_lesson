import React,{useEffect,useState} from 'react'
export function ReportActions({users}) {
  const exportCsv=()=>{
    const rows=[['Хэрэглэгч','Username','Хичээл','Нээсэн','Оролдлого','Сүүлийн оноо','Шилдэг оноо','Тэнцсэн'],...users.flatMap(u=>u.courses.map(c=>[u.name,u.username,c.title,c.opened?'Тийм':'Үгүй',c.attempts,c.last_score??'',c.best_score??'',c.completed?'Тийм':'Үгүй']))]
    const cell=value=>'"'+String(value).replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"'
    const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}))
    const a=document.createElement('a');a.href=url;a.download='training-progress.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  return <><div className="report-actions"><button onClick={exportCsv}>CSV / Excel-д нээх</button><button onClick={()=>window.print()}>PDF / Хэвлэх</button><small>Одоогийн хэрэглэгчийн шүүлтүүрээр экспортлоно. PDF: “Save as PDF” сонгоно.</small></div><div className="report-print"><h1>Сургалтын ахицын тайлан</h1><p>{new Date().toLocaleDateString('mn-MN')} · {users.length} хэрэглэгч</p><table><thead><tr><th>Хэрэглэгч</th><th>Хичээл</th><th>Оролдлого</th><th>Сүүлийн оноо</th><th>Шилдэг оноо</th><th>Дүүргэсэн</th></tr></thead><tbody>{users.flatMap(u=>u.courses.map(c=><tr key={`${u.id}-${c.id}`}><td>{u.name} (@{u.username})</td><td>{c.title}</td><td>{c.attempts}</td><td>{c.last_score??'—'}</td><td>{c.best_score??'—'}</td><td>{c.completed?'Тийм':'Үгүй'}</td></tr>))}</tbody></table></div></>
}
export function AuditLog({request}) {
  const [logs,setLogs]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(false)
  const load=async()=>{setLoading(true);setError('');try{setLogs(await request('/admin/audit-logs'))}catch(e){setError(e.message)}finally{setLoading(false)}}
  useEffect(()=>{load()},[])
  const action={POST:'Үүсгэх / үйлдэл',PUT:'Засварлах',PATCH:'Эрх өөрчлөх',DELETE:'Устгах'}
  const target=path=>path.replace('/api/admin/','').replace('reset-progress','Ахиц цэвэрлэх').replace('password','Нууц үг шинэчлэх').replace('lessons','Хичээл').replace('users','Хэрэглэгч').replace('news','Мэдээ')
  return <section className="audit-log"><div className="admin-title"><div><h2>Админы үйлдлийн түүх</h2><p>Сүүлийн 200 амжилттай үйлдэл</p></div><button disabled={loading} onClick={load}>Шинэчлэх</button></div>{error&&<p role="alert">{error}</p>}<div className="admin-table-wrap"><table><thead><tr><th>Огноо</th><th>Админ</th><th>Үйлдэл</th><th>Объект / ID</th></tr></thead><tbody>{logs.map(log=><tr key={log.id}><td>{new Date(log.created_at.includes('T')?log.created_at:log.created_at.replace(' ','T')+'Z').toLocaleString('mn-MN')}</td><td>{log.actor_name}</td><td>{action[log.action]||log.action}</td><td>{target(log.target)}</td></tr>)}</tbody></table></div>{!logs.length&&!loading&&<p>Одоогоор бүртгэгдсэн үйлдэл алга.</p>}</section>
}
