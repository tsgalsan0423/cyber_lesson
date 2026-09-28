import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowRight, BookOpen, Check, CheckCircle2, Clock3, Edit3, Eye, EyeOff, GraduationCap, LayoutGrid, LockKeyhole, LogOut, Menu, Moon, Play, PlayCircle, Plus, Search, Shield, ShieldCheck, Sparkles, Sun, Trash2, User, Users, Video, X, Zap } from 'lucide-react'
import './styles.css'
import TheoryContent from './TheoryContent.jsx'
import AdminAnalytics from './AdminAnalytics.jsx'
import News from './News.jsx'
import PasswordReset from './PasswordReset.jsx'
import LessonEditor from './LessonEditor.jsx'
import { mockRequest } from './mockApi.js'

const API = '/api'
const tokenKey = 'securelab-token'
const userKey = 'securelab-user'

async function request(path, options = {}) {
  try {
    const res = await fetch(`${API}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}), ...(localStorage.getItem(tokenKey) ? { Authorization: `Bearer ${localStorage.getItem(tokenKey)}` } : {}) } })
    const type=res.headers.get('content-type')||''
    if(!type.includes('application/json')) return mockRequest(path,options)
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Алдаа гарлаа')
    return data
  } catch (error) {
    if(!(error instanceof TypeError) && error.message && !error.message.includes('Unexpected token')) throw error
    return mockRequest(path,options)
  }
}

function Brand() {
  return null
}

function ThemeToggle({ theme, toggleTheme }) {
  const dark = theme === 'dark'
  return <button type="button" className="theme-toggle" onClick={toggleTheme} title={dark?'Light mode':'Dark mode'} aria-label={dark?'Light mode руу солих':'Dark mode руу солих'}>{dark?<Sun size={17}/>:<Moon size={17}/>}<span>{dark?'Light':'Dark'}</span></button>
}

function Auth({ onAuth, adminOnly=false, notice, theme, toggleTheme }) {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ identifier: '', password: '' })

  const submit = async (e) => {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const data=await request('/auth/login', { method: 'POST', body: JSON.stringify(form) })
      if(adminOnly&&data.user.role!=='admin') throw new Error('Энэ хуудас зөвхөн админд зориулагдсан. Хэрэглэгчийн нэвтрэх хуудсыг ашиглана уу.')
      if(!adminOnly&&data.user.role==='admin') throw new Error('Админ хэрэглэгч /admin/login хаягаар нэвтэрнэ үү.')
      onAuth(data)
    }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return <main className="auth-page">
    <div className="glow glow-one"/><div className="glow glow-two"/>
    <section className="auth-intro">
      <Brand/>
      <div className="eyebrow"><Sparkles size={14}/> МЭДЛЭГ БОЛ ТАНЫ ХАМГААЛАЛТ</div>
      <h1>Дижитал орчинд<br/><em>аюулгүй</em> амьдар.</h1>
      <p>Кибер халдлагаас өөрийгөө болон байгууллагаа хамгаалах мэдлэгийг бодит жишээ, практик дасгал, нөхцөлт сорилоор эзэмшээрэй.</p>
      <div className="auth-stats"><div><strong>{adminOnly?'Admin':'10'}</strong><span>{adminOnly?'Бүрэн удирдлага':'Интерактив сэдэв'}</span></div><div><strong>{adminOnly?'24/7':'1000'}</strong><span>{adminOnly?'Системийн хяналт':'Цуглуулах XP'}</span></div><div><strong>100%</strong><span>Монгол хэлээр</span></div></div>
      <div className="signal-card"><span><Zap size={17}/></span><div><b>Өнөөдрийн санамж</b><p>Танихгүй холбоос дээр дарахаасаа өмнө хаягийг нь шалгаарай.</p></div></div>
    </section>
    <section className="auth-panel">
      <div className="mobile-brand"><Brand/></div>
      <div className="auth-card">
        <div className="auth-theme"><ThemeToggle theme={theme} toggleTheme={toggleTheme}/></div>
        <div className="auth-icon">{adminOnly?<ShieldCheck/>:<LockKeyhole/>}</div>
        <h2>{adminOnly?'Админ нэвтрэх':'Тавтай морил'}</h2>
        <p>{adminOnly?'Сургалт системийн удирдлагын хэсэг':'Сургалтаа үргэлжлүүлэхийн тулд нэвтэрнэ үү.'}</p>
        {adminOnly&&<div className="admin-login-label"><Shield/> Зөвхөн эрх бүхий админ</div>}
        {!adminOnly&&<div className="login-spacer"/>}
        {notice&&<p className="success-notice" role="status">{notice}</p>}
        <form onSubmit={submit}>
          <label>Username<div className="input-wrap"><User size={18}/><input required autoComplete="username" placeholder="Username" value={form.identifier} onChange={e=>setForm({...form,identifier:e.target.value})}/></div></label>
          <label>Нууц үг<div className="input-wrap"><LockKeyhole size={18}/><input type={showPassword ? 'text' : 'password'} required minLength="6" placeholder="••••••••" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/><button type="button" className="eye" title={showPassword?'Нууц үг нуух':'Нууц үг харуулах'} aria-label={showPassword?'Нууц үг нуух':'Нууц үг харуулах'} onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
          {error && <div className="error">{error}</div>}
          <button className="primary auth-submit" disabled={loading}>{loading ? 'Түр хүлээнэ үү...' : adminOnly?'Админ панел руу':'Нэвтрэх'}<ArrowRight size={18}/></button>
        </form>
        <p className="fine"><Shield size={14}/> Таны мэдээлэл найдвартай хамгаалагдана</p>
      </div>
    </section>
  </main>
}

const stepEmoji={mail:'📨',search:'🔎',shield:'🛡️',key:'🔑',lock:'🔐',spark:'✨',wifi:'📡',eye:'👀',bug:'🦠',save:'💾',alert:'🚨',user:'🕵️',settings:'⚙️',share:'📱',unplug:'🔌',phone:'📞'}
function LessonModal({ lesson, onClose, onComplete }) {
  const [page,setPage]=useState(0), [answers,setAnswers]=useState([]), [checked,setChecked]=useState(false)
  const [result,setResult]=useState(null), [saving,setSaving]=useState(false), [error,setError]=useState('')
  useEffect(()=>{setPage(0);setAnswers([]);setChecked(false);setResult(null);setError('')},[lesson?.id])
  useEffect(()=>{
    if (!lesson) return
    const previous=document.body.style.overflow
    document.body.style.overflow='hidden'
    const escape=e=>{if(e.key==='Escape')onClose()}
    window.addEventListener('keydown',escape)
    return()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',escape)}
  },[lesson?.id,onClose])
  if (!lesson) return null
  const theory=lesson.content||[]
  const cases=(Array.isArray(lesson.cases)&&lesson.cases.length?lesson.cases:theory.filter(s=>s.example).map(s=>({...s,title:s.title,text:s.example,explanation:s.text,example:null}))).map(s=>({...s,case:true}))
  const steps=[...theory,...cases]
  const phase=page<theory.length?'Онол':page<steps.length?'Дадлага ажил':'Шалгалт'
  const questions=Array.isArray(lesson.quiz)?lesson.quiz:lesson.quiz?.question?[lesson.quiz]:[]
  const index=page-steps.length, isQuiz=index>=0, quiz=questions[index], story=steps[page]
  const finish=async()=>{
    setSaving(true);setError('')
    try{
      const score=Math.round(questions.filter((q,i)=>q.answer===answers[i]).length/questions.length*100)
      const saved=await onComplete(lesson,answers)
      setResult(saved||{score,completed:score>=50})
    }catch(e){setError(e.message)}finally{setSaving(false)}
  }
  const next=()=>{setPage(p=>p+1);setChecked(false)}
  return <div className="modal-bg lesson-modal-bg"><div className="interactive-modal expanded-lesson" role="dialog" aria-modal="true" aria-label={lesson.title} style={{'--lesson-accent':lesson.accent}}>
    <button className="modal-close" aria-label="Хаах" onClick={onClose}><X/></button>
    <div className="lesson-modal-top"><span>{lesson.category} · {phase} · {questions.length} асуулт</span><h2>{lesson.title}</h2><div className="lesson-dots">{[...steps,...questions].map((_,i)=><i key={i} className={i<=page?'active':''}/>)}</div></div>
    <div className="lesson-phases" aria-label="Хичээлийн бүтэц">{['Онол','Дадлага ажил','Шалгалт'].map((label,i)=><button key={label} className={phase===label?'active':''} disabled={saving||result!==null} onClick={()=>{setPage(i===0?0:i===1?theory.length:steps.length);setChecked(false)}}>{i+1}. {label}</button>)}</div>
    <div className="lesson-scroll">
    {result?<div className="quiz-page"><div className="story-visual">{result.completed?'🏆':'📚'}</div><h3>{result.score}% — {result.completed?'Тэнцсэн':'Тэнцсэнгүй'}</h3><p>{result.completed?'Энэ сэдвийн 100 XP таны ахицад тооцогдоно. Давтан үзэхэд XP нэмэгдэхгүй.':'Дүүргэх босго 50%. Тайлангаа уншаад сорилоо дахин өгөөрэй.'}</p>{questions.map((q,i)=><div key={i} className="answer-review"><b>{answers[i]===q.answer?'✓':'✗'} {q.question}</b><p>Таны хариулт: {q.options[answers[i]]}</p><p>Зөв: {q.options[q.answer]}</p><p>{q.explain}</p></div>)}</div>
    :story?<div className="story-page"><img className="topic-banner" src={lesson.image_url||`/images/topic-${((lesson.id-1)%6)+1}.svg`} alt={lesson.title}/><div className="story-count">{phase.toUpperCase()} {story.case?page-theory.length+1:page+1} / {story.case?cases.length:theory.length}</div><h3>{stepEmoji[story.icon]||'🛡️'} {story.title}</h3>{story.case?<p>{story.text}</p>:<TheoryContent story={story}/>}{story.case&&<details className="lesson-example"><summary>Дадлага ажлын тайлбар харах</summary><TheoryContent story={{title:story.title,text:story.explanation||story.solution||''}}/></details>}<div className="mission-tip"><Zap/><span><b>Өөрөө хийж үзээрэй</b>{story.task||'Энэ зөвлөгөөг өөрийн ажил, өдөр тутмын амьдралд хэрхэн хэрэглэхээ бодоорой.'}</span></div><details className="lesson-reflection"><summary>Дасгалын тэмдэглэл бичих</summary><textarea key={page} aria-label="Хувийн тэмдэглэл" placeholder="Нууц үг, хувийн мэдээлэл бүү бич. Тэмдэглэл хадгалагдахгүй."/></details></div>
    :quiz?<div className="quiz-page"><div className="quiz-badge">АСУУЛТ {index+1} / {questions.length} · БОСГО 50%</div><h3>{quiz.question}</h3><div className="quiz-options">{quiz.options.map((option,i)=><button key={i} disabled={checked} onClick={()=>setAnswers(a=>{const copy=[...a];copy[index]=i;return copy})} className={`${answers[index]===i?'selected':''} ${checked&&i===quiz.answer?'correct':''} ${checked&&answers[index]===i&&i!==quiz.answer?'wrong':''}`}><span>{String.fromCharCode(65+i)}</span>{option}</button>)}</div>{checked&&<div className="quiz-result success"><b>{answers[index]===quiz.answer?'Зөв хариуллаа!':'Зөв хариултын тайлбар'}</b><p>{quiz.explain}</p></div>}</div>
    :<div className="quiz-page"><h3>Агуулга бэлтгэгдэж байна</h3><p>Энэ хичээлийн сорил хараахан нэмэгдээгүй байна.</p></div>}
    {error&&<div role="alert" className="error">{error}</div>}
    </div>
    <div className="lesson-nav">
    {result?<><button className="back" onClick={()=>{setPage(0);setResult(null);setAnswers([]);setChecked(false)}}>Дахин унших</button><button className="primary" onClick={result.completed?onClose:()=>{setPage(steps.length);setResult(null);setAnswers([]);setChecked(false)}}>{result.completed?'Дуусгах':'Сорил дахин өгөх'}</button></>
    :!isQuiz?<><button className="back" disabled={page===0} onClick={()=>setPage(p=>p-1)}>← Өмнөх</button><button className="primary" onClick={next}>{page===steps.length-1?'Сорил эхлүүлэх':'Дараагийн хэсэг'} <ArrowRight/></button></>
    :quiz?<><span>{index+1} / {questions.length}</span><button className="primary" disabled={answers[index]===undefined||saving} onClick={!checked?()=>setChecked(true):index===questions.length-1?finish:next}>{saving?'Хадгалж байна…':!checked?'Хариулт шалгах':index===questions.length-1?'Үр дүн харах':'Дараагийн асуулт'}</button></>
    :<button className="primary" onClick={onClose}>Хаах</button>}
    </div>
  </div></div>
}

function Dashboard({ user, logout, onAdminReturn, theme, toggleTheme }) {
  const [passwordOpen,setPasswordOpen]=useState(false)
  const [view,setView]=useState('all')
  const [newsCount,setNewsCount]=useState(0)
  const [lessons, setLessons] = useState([]), [selected, setSelected] = useState(null), [search, setSearch] = useState(''), [filter, setFilter] = useState('Бүгд'), [menu, setMenu] = useState(false)
  useEffect(()=>{ request('/lessons').then(setLessons).catch(()=>logout()) }, [])
  useEffect(()=>{ request('/news').then(items=>setNewsCount(items.length)).catch(()=>{}) }, [])
  const [viewError,setViewError]=useState('')
  useEffect(()=>{
    if(!selected || onAdminReturn) return
    setViewError('')
    request(`/lessons/${selected.id}/view`,{method:'POST',body:'{}'}).catch(e=>setViewError('Хичээл нээсэн түүх хадгалагдсангүй: '+e.message))
  },[selected?.id])
  const completeCount = lessons.filter(l=>l.completed).length
  const filtered = useMemo(()=>lessons.filter(l => (view!=='completed'||l.attempts>0||l.completed) && (filter === 'Бүгд' || l.category === filter) && (l.title+l.description+l.category).toLowerCase().includes(search.toLowerCase())),[lessons,search,filter,view])
  const categories = ['Бүгд', ...new Set(lessons.map(l=>l.category))]
  const toggleComplete = async (lesson, answers) => {
    const result = await request(`/lessons/${lesson.id}/progress`, {method:'POST',body:JSON.stringify({answers})})
    setLessons(ls=>ls.map(l=>l.id===lesson.id?{...l,completed:result.completed?1:l.completed,last_score:result.score,attempts:(l.attempts||0)+1}:l))
    setSelected(s=>s?.id===lesson.id?{...s,completed:result.completed?1:s.completed,last_score:result.score}:s)
    return result
  }
  return <div className="app-shell">
    <aside className={menu?'open':''}><div className="side-top"><Brand/><button className="side-close" aria-label="Цэс хаах" title="Цэс хаах" onClick={()=>setMenu(false)}><X/></button></div><nav>{onAdminReturn&&<button className="admin-return" onClick={onAdminReturn}><ShieldCheck/>Админ панел руу</button>}<a className={view==='all'?'active':''} onClick={()=>{setView('all');setFilter('Бүгд');setSearch('')}} href="#top"><LayoutGrid/>Нүүр</a><a href="#lessons" onClick={()=>{setView('all');setFilter('Бүгд');setSearch('')}}><BookOpen/>Миний хичээлүүд <span>{lessons.length}</span></a><a className={view==='completed'?'active':''} href="#lessons" onClick={()=>{setView('completed');setFilter('Бүгд');setSearch('');setMenu(false)}}><CheckCircle2/>Дуусгасан <span>{lessons.filter(l=>l.attempts>0||l.completed).length}</span></a><a className={view==='news'?'active':''} href="#news" onClick={()=>{setView('news');setMenu(false)}}><BookOpen/>Мэдээ мэдээлэл <span>{newsCount}</span></a></nav><div className="side-bottom"><div className="mini-shield"><ShieldCheck/><div><b>Сургалт</b><small>Аюулгүй суралц</small></div></div><button title="Өөрийн нууц үгийг солих" onClick={()=>{setPasswordOpen(true);setMenu(false)}}><LockKeyhole/>Нууц үг солих</button><button onClick={logout}><LogOut/>Гарах</button></div></aside>
    {menu&&<div className="aside-overlay" onClick={()=>setMenu(false)}/>} 
    <div className="main-area">
      <header><button className="menu-btn" aria-label="Цэс нээх" title="Цэс нээх" onClick={()=>setMenu(true)}><Menu/></button><div className="search"><Search/><input placeholder="Хичээл хайх..." value={search} onChange={e=>setSearch(e.target.value)}/><kbd>⌘ K</kbd></div><div className="header-user"><div className="profile"><div className="avatar">{user.name[0].toUpperCase()}</div><div><b>{user.name}</b><span>Суралцагч</span></div></div><ThemeToggle theme={theme} toggleTheme={toggleTheme}/></div></header>
      <main className="dashboard" id="top">{viewError&&<p className="error" role="alert">{viewError}</p>}
        {view==='news'?<News request={request} onCountChange={setNewsCount}/>:<><section className="welcome"><div><div className="eyebrow"><Sparkles/> ТАНЫ СУРАЛЦАХ ОРОН ЗАЙ</div><h1>Сайн байна уу, {user.name.split(' ')[0]} 👋</h1><p>Өнөөдөр нэг алхам урагшилж, дижитал хамгаалалтаа бэхжүүлцгээе.</p><button className="primary" onClick={()=>lessons[0]&&setSelected(lessons.find(l=>!l.completed)||lessons[0])}><Play size={18} fill="currentColor"/>Хичээлээ үргэлжлүүлэх</button></div><div className="orb"><div className="orbit"><ShieldCheck/></div><span className="dot d1"/><span className="dot d2"/><span className="dot d3"/></div></section>
        <section className="progress-row"><div className="progress-copy"><span className="progress-icon"><Zap/></span><div><b>Таны ахиц</b><small>{completeCount === lessons.length && lessons.length ? 'Бүх хичээлийг амжилттай дуусгалаа!' : 'Тууштай байгаарай, та сайн явж байна!'}</small></div></div><div className="progress-main"><div className="progress-label"><span>Нийт гүйцэтгэл</span><b>{lessons.length?Math.round(completeCount/lessons.length*100):0}%</b></div><div className="progress-track"><span style={{width:`${lessons.length?completeCount/lessons.length*100:0}%`}}/></div></div><div className="count"><b>{completeCount}</b><span>/ {lessons.length} хичээл</span></div></section>
        <div className="section-head" id="lessons"><div><span>СОРИЛТОД БЭЛЭН ҮҮ?</span><h2>{view==='completed'?'Шалгалт өгсөн хичээлүүд':'Онол · Дадлага ажил · Шалгалт'}</h2></div><div className="filter-mobile"><Search size={18}/><input placeholder="Хайх" value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
        <div className="filters">{categories.map(c=><button key={c} className={filter===c?'active':''} onClick={()=>setFilter(c)}>{c}</button>)}</div>
        <div className="lesson-grid">{filtered.map((l,i)=><article className="lesson-card" key={l.id} onClick={()=>setSelected(l)}><div className="thumb" style={{'--accent':l.accent}}><img className="topic-image" src={l.image_url||`/images/topic-${((l.id-1)%6)+1}.svg`} alt={l.title}/><span className="lesson-no">СЭДЭВ {l.id}</span>{l.completed ? <span className="status done"><Check/> +100 XP</span>:<span className="status"><Sparkles/> Эхлэх</span>}</div><div className="lesson-body"><div className="meta"><span>{l.category}</span><span><Clock3/> {l.duration}</span></div><h3>{l.title}</h3><p>{l.description}</p>{l.completed&&!l.attempts&&<div className="exam-status passed"><b>Өмнө дүүргэсэн</b><span>Хуучин шалгалтын оноо хадгалагдаагүй.</span></div>}{l.attempts>0&&<div className={l.last_score>=50?'exam-status passed':'exam-status failed'}><b>{l.last_score}% · {l.last_score>=50?'Тэнцсэн':'Тэнцсэнгүй'}</b><span>{l.attempts} оролдлого · Сүүлийн үр дүн</span></div>}<div className="lesson-foot"><span className={`level ${l.level}`}>{l.level}</span><button>{l.attempts>0?'Давтан үзэх':'Хичээл эхлэх'} <ArrowRight/></button></div></div></article>)}</div>
        {!filtered.length&&<div className="empty"><Search/><h3>{view==='completed'?'Шалгалт өгсөн хичээл алга байна':'Хичээл олдсонгүй'}</h3><p>{view==='completed'?'Шалгалтаа дуусгахад оноо, үр дүн энд харагдана.':'Хайлтын үгээ өөрчлөөд үзээрэй.'}</p></div>}
      </>}</main><footer><Brand/><span>© 2026 Нийтийн мэдээллийн дэд бүтэц, Нээлттэй өгөгдлийн газар</span><span>Мэдлэгтэй бол Аюулгүй</span></footer>
    </div>
    {passwordOpen&&<PasswordReset self user={user} request={request} onClose={()=>setPasswordOpen(false)} onSaved={()=>logout('Нууц үг амжилттай солигдлоо. Шинэ нууц үгээрээ дахин нэвтэрнэ үү.')}/>}
    <LessonModal lesson={selected} onClose={()=>setSelected(null)} onComplete={toggleComplete}/>
  </div>
}

const emptyUser = { name:'', username:'', email:'', password:'', role:'student' }

function AdminPanel({ user, logout, onLearnerView, theme, toggleTheme }) {
  const [data,setData]=useState({stats:{users:0,lessons:0,completions:0},users:[],lessons:[]})
  const [newsCount,setNewsCount]=useState(0)
  const [editingLesson,setEditingLesson]=useState(null), [showForm,setShowForm]=useState(false), [error,setError]=useState('')
  const [showUserForm,setShowUserForm]=useState(false), [userForm,setUserForm]=useState(emptyUser), [previewLesson,setPreviewLesson]=useState(null)
  const [passwordUser,setPasswordUser]=useState(null),[notice,setNotice]=useState('')
  const load=()=>request('/admin/overview').then(setData).catch(e=>setError(e.message))
  useEffect(()=>{load()},[])
  useEffect(()=>{request('/news').then(items=>setNewsCount(items.length)).catch(()=>{})},[])
  const openForm=(lesson=null)=>{setEditingLesson(lesson);setShowForm(true);setError('')}
  const remove=async lesson=>{if(!confirm(`“${lesson.title}” хичээлийг устгах уу?`))return;await request(`/admin/lessons/${lesson.id}`,{method:'DELETE'});load()}
  const userAction=async(id,action,body)=>{try{await request(`/admin/users/${id}/${action}`,{method:action==='role'?'PATCH':'POST',body:JSON.stringify(body||{})});load()}catch(e){setError(e.message)}}
  const deleteUser=async u=>{if(!confirm(`${u.name} хэрэглэгчийг бүх явцтай нь устгах уу?`))return;try{await request(`/admin/users/${u.id}`,{method:'DELETE'});load()}catch(e){setError(e.message)}}
  const createUser=async e=>{e.preventDefault();setError('');try{await request('/admin/users',{method:'POST',body:JSON.stringify(userForm)});setShowUserForm(false);setUserForm(emptyUser);load()}catch(e){setError(e.message)}}
  const preview=l=>setPreviewLesson({...l,content:JSON.parse(l.content_json||'[]'),cases:JSON.parse(l.cases_json||'[]'),quiz:JSON.parse(l.quiz_json||'[]'),completed:0})
  return <div className="admin-shell">
    <aside className="admin-side"><Brand/><div className="admin-badge"><ShieldCheck/> Админ удирдлага</div><nav><a className="active" href="#admin-top"><LayoutGrid/>Хяналтын самбар</a><button className="learner-view" onClick={onLearnerView}><BookOpen/>Хичээл рүү орох</button><a href="#admin-lessons"><Zap/>Интерактив хичээлүүд <span>{data.stats.lessons}</span></a><a href="#admin-users"><Users/>Хэрэглэгчид <span>{data.stats.users}</span></a><a href="#news"><BookOpen/>Мэдээ мэдээлэл <span>{newsCount}</span></a></nav><div className="side-bottom"><div className="mini-shield"><div className="avatar">G</div><div><b>{user.name}</b><small>Системийн админ</small></div></div><button onClick={logout}><LogOut/>Гарах</button></div></aside>
    <div className="admin-main"><header><div><small>СУРГАЛТЫН УДИРДЛАГА</small><h2>Админ панел</h2></div><div className="admin-header-actions"><div className="profile admin-top-profile"><div className="avatar">{user.name[0].toUpperCase()}</div><div><b>{user.name}</b><span>Админ</span></div></div><ThemeToggle theme={theme} toggleTheme={toggleTheme}/><button className="preview-btn" onClick={onLearnerView}><BookOpen/>Хичээл үзэх</button><button className="primary" onClick={()=>openForm()}><Plus/>Шинэ хичээл</button></div></header>
      <main className="admin-content" id="admin-top"><div className="admin-welcome"><div><span>СИСТЕМИЙН ТОЙМ</span><h1>Сайн байна уу, {user.name}</h1><p>Сургалтын контент болон хэрэглэгчдийн мэдээллийг нэг дороос удирдана.</p></div><ShieldCheck/></div>
        {notice&&<p className="success-notice" role="status">{notice}</p>}<AdminAnalytics request={request}/>
        {error&&<div className="error">{error}</div>}
        <section className="admin-section" id="admin-lessons"><div className="admin-title"><div><span>КОНТЕНТ</span><h2>Интерактив хичээлүүд</h2></div><button onClick={()=>openForm()}><Plus/> Нэмэх</button></div><div className="admin-table-wrap"><table><thead><tr><th>Хичээл</th><th>Ангилал</th><th>Түвшин</th><th>Хугацаа</th><th>Үйлдэл</th></tr></thead><tbody>{data.lessons.map(l=><tr key={l.id}><td><i style={{background:l.accent}}><Zap/></i><b>{l.title}</b></td><td>{l.category}</td><td><span className="table-pill">{l.level}</span></td><td>{l.duration}</td><td><button aria-label="Хичээл үзэх" title="Хичээл үзэх" onClick={()=>preview(l)}><Eye/></button><button aria-label="Засах" title="Засах" onClick={()=>openForm(l)}><Edit3/></button><button aria-label="Устгах" title="Устгах" className="danger" onClick={()=>remove(l)}><Trash2/></button></td></tr>)}</tbody></table></div></section>
        <section className="admin-section" id="admin-users"><div className="admin-title"><div><span>БҮРЭН УДИРДЛАГА</span><h2>Хэрэглэгчид</h2></div><button onClick={()=>{setUserForm(emptyUser);setError('');setShowUserForm(true)}}><Plus/> Хэрэглэгч үүсгэх</button></div><div className="admin-table-wrap"><table><thead><tr><th>Хэрэглэгч</th><th>Username / И-мэйл</th><th>Эрх</th><th>Бүртгүүлсэн</th><th>Удирдах</th></tr></thead><tbody>{data.users.map(u=><tr key={u.id}><td><div className="user-cell"><span>{u.name[0]}</span><b>{u.name}</b></div></td><td><b className="username-text">@{u.username||'username-гүй'}</b><br/>{u.email}</td><td><span className={`role ${u.role}`}>{u.role==='admin'?'Админ':'Суралцагч'}</span></td><td>{new Date(u.created_at).toLocaleDateString('mn-MN')}</td><td className="user-actions"><button title="Нууц үг шинэчлэх" aria-label={`${u.name}: нууц үг шинэчлэх`} onClick={()=>{setPasswordUser(u);setNotice('')}}><LockKeyhole/></button>{u.id!==user.id&&<><button aria-label="Эрх солих" title="Эрх солих" onClick={()=>userAction(u.id,'role',{role:u.role==='admin'?'student':'admin'})}><Shield/></button><button aria-label="Явц тэглэх" title="Явц тэглэх" onClick={()=>userAction(u.id,'reset-progress')}><Zap/></button><button aria-label="Устгах" title="Устгах" className="danger" onClick={()=>deleteUser(u)}><Trash2/></button></>}</td></tr>)}</tbody></table></div></section>
        <News request={request} admin onCountChange={setNewsCount}/>
      </main>
    </div>
    {passwordUser&&<PasswordReset user={passwordUser} request={request} onClose={()=>setPasswordUser(null)} onSaved={()=>{const self=passwordUser.id===user.id;setPasswordUser(null);if(self)logout();else setNotice('Нууц үг шинэчлэгдлээ. Хэрэглэгч шинэ нууц үгээр дахин нэвтэрнэ.')}}/>}
    {showForm&&<LessonEditor lesson={editingLesson} request={request} onClose={()=>setShowForm(false)} onSaved={()=>{setShowForm(false);setEditingLesson(null);load()}} onPreview={lesson=>setPreviewLesson(lesson)}/>}
    {showUserForm&&<div className="modal-bg"><form className="lesson-form" onSubmit={createUser}><button type="button" className="modal-close" title="Хаах" aria-label="Хаах" onClick={()=>setShowUserForm(false)}><X/></button><span>ХЭРЭГЛЭГЧИЙН УДИРДЛАГА</span><h2>Шинэ хэрэглэгч үүсгэх</h2><label>Бүтэн нэр<input required placeholder="Бат Болд" value={userForm.name} onChange={e=>setUserForm({...userForm,name:e.target.value})}/></label><label>Username<input required autoComplete="off" placeholder="batbold" value={userForm.username} onChange={e=>setUserForm({...userForm,username:e.target.value})}/></label><label>И-мэйл<input required type="email" placeholder="user@example.com" value={userForm.email} onChange={e=>setUserForm({...userForm,email:e.target.value})}/></label><div className="form-row"><label>Нууц үг<input required minLength="6" type="password" placeholder="6-аас дээш тэмдэгт" value={userForm.password} onChange={e=>setUserForm({...userForm,password:e.target.value})}/></label><label>Эрхийн түвшин<select value={userForm.role} onChange={e=>setUserForm({...userForm,role:e.target.value})}><option value="student">Суралцагч</option><option value="admin">Админ</option></select></label></div>{error&&<div className="error">{error}</div>}<button className="primary"><Plus/> Хэрэглэгч үүсгэх</button></form></div>}
    <LessonModal lesson={previewLesson} onClose={()=>setPreviewLesson(null)} onComplete={()=>{}}/>
  </div>
}

function App(){
  const [authNotice,setAuthNotice]=useState('')
  const [user,setUser]=useState(()=>{try{return JSON.parse(localStorage.getItem(userKey))}catch{return null}})
  const [theme,setTheme]=useState(()=>localStorage.getItem('securelab-theme') || 'light')
  const [route,setRoute]=useState(window.location.pathname)
  useEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem('securelab-theme',theme)},[theme])
  const toggleTheme=()=>setTheme(current=>current==='dark'?'light':'dark')
  const navigate=(path,replace=false)=>{window.history[replace?'replaceState':'pushState']({},'',path);setRoute(path);window.scrollTo(0,0)}
  useEffect(()=>{const pop=()=>setRoute(window.location.pathname);window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop)},[])
  useEffect(()=>{
    if(!user&&!['/login','/admin/login'].includes(route)) navigate('/login',true)
    if(user?.role==='admin'&&['/login','/admin/login'].includes(route)) navigate('/admin',true)
    if(user?.role!=='admin'&&user&&['/login','/admin/login','/admin'].includes(route)) navigate('/lessons',true)
  },[user,route])
  const onAuth=data=>{setAuthNotice('');localStorage.setItem(tokenKey,data.token);localStorage.setItem(userKey,JSON.stringify(data.user));setUser(data.user);navigate(data.user.role==='admin'?'/admin':'/lessons',true)}
  const logout=(message)=>{setAuthNotice(typeof message==='string'?message:'');const path=user?.role==='admin'?'/admin/login':'/login';localStorage.removeItem(tokenKey);localStorage.removeItem(userKey);setUser(null);navigate(path,true)}
  if(!user) return <Auth notice={authNotice} key={route} adminOnly={route==='/admin/login'} onAuth={onAuth} theme={theme} toggleTheme={toggleTheme}/>
  if(user.role==='admin') return route==='/admin/preview'?<Dashboard user={user} logout={logout} onAdminReturn={()=>navigate('/admin')} theme={theme} toggleTheme={toggleTheme}/>:<AdminPanel user={user} logout={logout} onLearnerView={()=>navigate('/admin/preview')} theme={theme} toggleTheme={toggleTheme}/>
  return <Dashboard user={user} logout={logout} theme={theme} toggleTheme={toggleTheme}/>
}

createRoot(document.getElementById('root')).render(<App/>)
