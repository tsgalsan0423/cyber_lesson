import React from 'react'
import {Award,BookOpen,CheckCircle2,Clock3,LogIn,UserRound,X} from 'lucide-react'
import './user-detail.css'

const date=value=>value?new Date(String(value).includes('T')?value:String(value).replace(' ','T')+'Z').toLocaleString('mn-MN'):'Бүртгэлгүй'

export default function UserDetailModal({data,loading,error,onClose}){
  const user=data?.user
  return <div className="modal-bg"><section className="user-detail-modal" role="dialog" aria-modal="true" aria-label="Хэрэглэгчийн дэлгэрэнгүй">
    <button type="button" className="modal-close" aria-label="Хаах" onClick={onClose}><X/></button>
    <span className="user-detail-eyebrow">ХЭРЭГЛЭГЧИЙН ДЭЛГЭРЭНГҮЙ</span>
    {loading&&<p role="status" className="user-detail-loading">Мэдээлэл уншиж байна…</p>}
    {error&&<p className="error" role="alert">{error}</p>}
    {user&&<>
      <header className="user-detail-person"><div className="user-detail-avatar">{user.name?.[0]||'Х'}</div><div><h2>{user.surname?`${user.surname} `:''}{user.name}</h2><p>{user.department||'Нэгжгүй'} · {user.position||'Албан тушаалгүй'}</p><small>{user.email||user.username}</small></div></header>
      <div className="user-detail-kpis">
        <article><LogIn/><div><small>Сүүлийн нэвтрэлт</small><b>{date(data.last_login)}</b><span>{data.login_count} удаа нэвтэрсэн</span></div></article>
        <article><BookOpen/><div><small>Сүүлийн үзсэн хичээл</small><b>{data.last_lesson?.title||'Одоогоор хичээл нээгээгүй'}</b><span>{date(data.last_lesson?.last_viewed_at)}</span></div></article>
        <article><CheckCircle2/><div><small>Сургалтын явц</small><b>{data.summary.completed}/{data.courses.length} хичээл</b><span>{data.summary.tested} шалгалт · Дундаж {data.summary.average===null?'—':`${data.summary.average}%`}</span></div></article>
      </div>
      <div className="user-detail-table"><table><thead><tr><th>Хичээл</th><th>Сүүлд үзсэн</th><th>Нээлт</th><th>Оролдлого</th><th>Сүүлийн / шилдэг</th><th>Төлөв</th></tr></thead><tbody>{data.courses.map(course=><tr key={course.id}><td><b>{course.title}</b></td><td>{date(course.last_viewed_at)}</td><td>{course.opens}</td><td>{course.attempts}</td><td>{course.last_score===null?'—':`${course.last_score}%`} / {course.best_score===null?'—':`${course.best_score}%`}</td><td><span className={course.completed?'detail-status done':'detail-status'}>{course.completed?'Дууссан':course.attempts?'Шалгалт өгсөн':course.opens?'Үзэж эхэлсэн':'Эхлээгүй'}</span></td></tr>)}</tbody></table></div>
      <div className="user-detail-foot"><span><UserRound/> {user.role==='admin'?'Админ':'Суралцагч'}</span><span><Clock3/> Бүртгүүлсэн: {date(user.created_at)}</span><span><Award/> {data.summary.viewed} хичээл нээсэн</span></div>
    </>}
  </section></div>
}
