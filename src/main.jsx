import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowRight, BookOpen, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Edit3, Eye, EyeOff, GraduationCap, LayoutGrid, LockKeyhole, LogOut, Menu, Moon, Play, PlayCircle, Plus, Search, Shield, ShieldCheck, Sparkles, Sun, Trash2, User, Users, Video, X, Zap } from 'lucide-react'
import './styles.css'
import TheoryContent,{RichText} from './TheoryContent.jsx'
import AdminAnalytics from './AdminAnalytics.jsx'
import News from './News.jsx'
import PasswordReset from './PasswordReset.jsx'
import LessonEditor from './LessonEditor.jsx'
import ProfileEdit from './ProfileEdit.jsx'
import ProgressScope from './ProgressScope.jsx'
import Notifications from './Notifications.jsx'
import UserDetailModal from './UserDetailModal.jsx'
import './home-media.css'
import './sidebar-toggle.css'
import {randomQuiz,originalAnswers} from './quizOrder.js'
import {activeDepartments,compareDepartments,compareStaff} from './staffOrder.js'

const API = '/api'
const tokenKey = 'securelab-token'
const userKey = 'securelab-user'
const requireInitialPasswordChange = import.meta.env.VITE_REQUIRE_INITIAL_PASSWORD_CHANGE !== 'false'

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}), ...(localStorage.getItem(tokenKey) ? { Authorization: `Bearer ${localStorage.getItem(tokenKey)}` } : {}) } })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Алдаа гарлаа')
  return data
}

function Brand({compact=false}) {
  return <OrganizationLogo compact={compact}/>
}

function OrganizationLogo({compact=false}) {
  return <div className={`organization-logo${compact?' compact':''}`}><img src="/images/khurdan-logo-v2.png" alt="ХУРДАН лого"/></div>
}

function ThemeToggle({ theme, toggleTheme }) {
  const dark = theme === 'dark'
  return <button type="button" className="theme-toggle" onClick={toggleTheme} title={dark?'Light mode':'Dark mode'} aria-label={dark?'Light mode руу солих':'Dark mode руу солих'}>{dark?<Sun size={17}/>:<Moon size={17}/>}<span>{dark?'Light':'Dark'}</span></button>
}

const dailyTips = [
  'Төхөөрөмж, аппликейшнаа тогтмол шинэчилцгээе.',
  'Танихгүй холбоос дээр дарахаасаа өмнө хаягийг шалгацгаая.',
  'Нууц үгээ хэнд ч хуваалцахгүй байцгаая.',
  'Ажлын төхөөрөмжөө орхихдоо дэлгэцээ түгжицгээе.',
  'Хавсралт нээхээс өмнө файлын төрлийг шалгацгаая.',
  'MFA хүсэлтийг өөрөө илгээгээгүй бол зөвшөөрөхгүй байцгаая.',
  'Олон нийтийн Wi‑Fi ашиглахдаа нууц мэдээлэлд болгоомжтой хандацгаая.'
]

function Auth({ onAuth, adminOnly=false, notice, theme, toggleTheme }) {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ identifier: '', password: '' })
  const todayTip = dailyTips[new Date().getDay()]

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
      <div className="eyebrow"><Sparkles size={14}/> КИБЕР АЮУЛААС УРЬДЧИЛАН СЭРГИЙЛЬЕ</div>
      <h1>Цахим орчинд<br/><em>аюулгүй</em> байцгаая</h1>
      <p>Кибер халдлагаас өөрийгөө болон байгууллагаа хамгаалах мэдлэг, дадлыг бодит жишээ, практик дасгалаар хамтдаа эзэмшцгээе.</p>
      <div className="signal-card"><span><Zap size={17}/></span><div><b>Өнөөдрийн санамж</b><p>{todayTip}</p></div></div>
    </section>
    <section className="auth-panel">
      <div className="mobile-brand"><Brand/></div>
      <div className="auth-card">
        <div className="auth-theme"><ThemeToggle theme={theme} toggleTheme={toggleTheme}/></div>
        <div className="auth-icon">{adminOnly?<ShieldCheck/>:<LockKeyhole/>}</div>
        <h2>{adminOnly?'Админ нэвтрэх':'Тавтай морил'}</h2>
        <p>{adminOnly?'Сургалт системийн удирдлагын хэсэг':'Сургалтаа үргэлжлүүлэхийн тулд нэвтэрнэ үү.'}</p>
        {adminOnly&&<div className="admin-login-label"><Shield/> Зөвхөн эрх бүхий албан хаагч</div>}
        {!adminOnly&&<div className="login-spacer"/>}
        {notice&&<p className="success-notice" role="status">{notice}</p>}
        <form onSubmit={submit}>
          <label>И-мэйл хаяг<div className="input-wrap"><User size={18}/><input required type="email" autoComplete="username" placeholder="name@khurdan.gov.mn" value={form.identifier} onChange={e=>setForm({...form,identifier:e.target.value})}/></div></label>
          <label>Нууц үг<div className="input-wrap"><LockKeyhole size={18}/><input type={showPassword ? 'text' : 'password'} required minLength="6" placeholder="••••••••" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/><button type="button" className="eye" title={showPassword?'Нууц үг нуух':'Нууц үг харуулах'} aria-label={showPassword?'Нууц үг нуух':'Нууц үг харуулах'} onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
          {error && <div className="error">{error}</div>}
          <button className="primary auth-submit" disabled={loading}>{loading ? 'Түр хүлээнэ үү...' : adminOnly?'Админ панел руу':'Нэвтрэх'}<ArrowRight size={18}/></button>
        </form>
        <p className="fine"><Shield size={14}/> Нийтийн мэдээллийн дэд бүтэц, Нээлттэй өгөгдлийн газар</p>
      </div>
    </section>
  </main>
}

const stepEmoji={mail:'📨',search:'🔎',shield:'🛡️',key:'🔑',lock:'🔐',spark:'✨',wifi:'📡',eye:'👀',bug:'🦠',save:'💾',alert:'🚨',user:'🕵️',settings:'⚙️',share:'📱',unplug:'🔌',phone:'📞'}
function LessonModal({ lesson, onClose, onComplete }) {
  const [questions,setQuestions]=useState(()=>randomQuiz(lesson?.quiz||[]))
  const [page,setPage]=useState(0), [answers,setAnswers]=useState([]), [checked,setChecked]=useState(false)
  const [result,setResult]=useState(null), [saving,setSaving]=useState(false), [error,setError]=useState('')
  useEffect(()=>{setPage(0);setAnswers([]);setChecked(false);setResult(null);setError('');setQuestions(randomQuiz(lesson?.quiz||[]))},[lesson?.id])
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
  const steps=[...theory,...cases,{title:'Гол санаа — шалгалтын өмнө давтах',text:(lesson.summary||[]).map(s=>'• '+s).join('\n'),icon:'book',review:true}]
  const theoryStart=1,practiceStart=theoryStart+theory.length,quizStart=1+steps.length
  const phase=page===0?'Хичээлийн тухай':page<practiceStart?'Онол':page<quizStart?'Дадлага ажил':'Шалгалт'
  const index=page-quizStart, isQuiz=index>=0, quiz=questions[index], story=page>0&&page<quizStart?steps[page-1]:null
  const phaseTabs=[['Хичээлийн тухай',0],['Онол',theoryStart],['Дадлага ажил',practiceStart],['Шалгалт',quizStart]]
  const finish=async()=>{
    setSaving(true);setError('')
    try{
      const score=Math.round(questions.filter((q,i)=>q.answer===answers[i]).length/questions.length*100)
      const saved=await onComplete(lesson,originalAnswers(questions,answers))
      setResult(saved||{score,completed:score>=50})
    }catch(e){setError(e.message)}finally{setSaving(false)}
  }
  const next=()=>{setPage(p=>p+1);setChecked(false)}
  return <div className="modal-bg lesson-modal-bg"><div className="interactive-modal expanded-lesson" role="dialog" aria-modal="true" aria-label={lesson.title} style={{'--lesson-accent':lesson.accent}}>
    <button className="modal-close" aria-label="Хаах" onClick={onClose}><X/></button>
    <div className="lesson-modal-top"><span>{lesson.category} · {phase} · {questions.length} асуулт</span><h2>{lesson.title}</h2><div className="lesson-dots">{[null,...steps,...questions].map((_,i)=><i key={i} className={i<=page?'active':''}/>)}</div></div>
    <div className="lesson-phases four-phases" aria-label="Хичээлийн бүтэц">{phaseTabs.map(([label,target],i)=><button key={label} className={phase===label?'active':''} disabled={saving||result!==null} onClick={()=>{setPage(target);setChecked(false)}}>{i+1}. {label}</button>)}</div>
    <div className="lesson-scroll">
    {result?<div className="quiz-page"><div className="story-visual">{result.completed?'🏆':'📚'}</div><h3>{result.score}% — {result.completed?'Тэнцсэн':'Тэнцсэнгүй'}</h3><p>{result.completed?'Энэ сэдвийн 100 XP таны ахицад тооцогдоно. Давтан үзэхэд XP нэмэгдэхгүй.':'Дүүргэх босго 50%. Тайлангаа уншаад сорилоо дахин өгөөрэй.'}</p>{questions.map((q,i)=>{const review=result.review?.[q.originalIndex];const correct=Number.isInteger(q.answer)&&q.answer>=0?q.answer:q.optionOrder.indexOf(review?.answer);return <div key={i} className="answer-review"><b>{answers[i]===correct?'✓':'✗'} {q.question}</b><p>Таны хариулт: {q.options[answers[i]]}</p><p>Зөв: {q.options[correct]}</p><RichText text={q.explain||review?.explain}/></div>})}</div>
    :page===0?<div className="story-page lesson-about"><img className="topic-banner" src={lesson.image_url||`/images/topic-${((lesson.id-1)%6)+1}.svg`} alt={lesson.title}/><div className="story-count">ХИЧЭЭЛИЙН ТУХАЙ</div><h3>{lesson.title}</h3><p>{lesson.description}</p><div className="lesson-about-meta"><span><b>Ангилал</b>{lesson.category}</span><span><b>Түвшин</b>{lesson.level}</span><span><b>Хугацаа</b>{lesson.duration}</span></div><section className="answer-review"><h3>Энэ хичээлийн дараа та</h3><RichText text={(lesson.objectives||[]).map(s=>'• '+s).join('\n')||'• Энэ сэдвийн гол эрсдэл болон хамгаалах аргыг ойлгоно.'}/></section></div>
    :story?.review?<div className="story-page"><h3>{story.title}</h3><RichText text={story.text}/><p>Эдгээр ойлголтоо давтаад шалгалтаа эхлүүлээрэй.</p></div>
    :story?<div className="story-page"><img className="topic-banner" src={lesson.image_url||`/images/topic-${((lesson.id-1)%6)+1}.svg`} alt={lesson.title}/><div className="story-count">{phase.toUpperCase()} {story.case?page-practiceStart+1:page} / {story.case?cases.length:theory.length}</div><h3>{stepEmoji[story.icon]||'🛡️'} {story.title}</h3>{story.case?<RichText text={story.text}/>:<TheoryContent story={story}/>}{story.case&&<details className="lesson-example"><summary>Дадлага ажлын тайлбар харах</summary><TheoryContent story={{title:story.title,text:story.explanation||story.solution||''}}/></details>}</div>
    :quiz?<div className="quiz-page"><div className="quiz-badge">АСУУЛТ {index+1} / {questions.length} · БОСГО 50%</div><h3>{quiz.question}</h3><div className="quiz-options">{quiz.options.map((option,i)=><button key={i} disabled={checked} onClick={()=>setAnswers(a=>{const copy=[...a];copy[index]=i;return copy})} className={`${answers[index]===i?'selected':''} ${checked&&i===quiz.answer?'correct':''} ${checked&&answers[index]===i&&i!==quiz.answer?'wrong':''}`}><span>{String.fromCharCode(65+i)}</span>{option}</button>)}</div>{checked&&<div className="quiz-result success"><b>{answers[index]===quiz.answer?'Зөв хариуллаа!':'Зөв хариултын тайлбар'}</b><RichText text={quiz.explain}/></div>}</div>
    :<div className="quiz-page"><h3>Агуулга бэлтгэгдэж байна</h3><p>Энэ хичээлийн сорил хараахан нэмэгдээгүй байна.</p></div>}
    {error&&<div role="alert" className="error">{error}</div>}
    </div>
    <div className="lesson-nav">
    {result?<><button className="back" onClick={()=>{setPage(0);setResult(null);setAnswers([]);setChecked(false);setQuestions(randomQuiz(lesson.quiz))}}>Дахин унших</button><button className="primary" onClick={result.completed?onClose:()=>{setPage(quizStart);setResult(null);setAnswers([]);setChecked(false);setQuestions(randomQuiz(lesson.quiz))}}>{result.completed?'Дуусгах':'Сорил дахин өгөх'}</button></>
    :!isQuiz?<><button className="back" disabled={page===0} onClick={()=>setPage(p=>p-1)}>← Өмнөх</button><button className="primary" onClick={next}>{page===quizStart-1?'Сорил эхлүүлэх':'Дараагийн хэсэг'} <ArrowRight/></button></>
    :quiz?<><span>{index+1} / {questions.length}</span><button className="primary" disabled={answers[index]===undefined||saving} onClick={Number.isInteger(quiz.answer)&&quiz.answer>=0?(!checked?()=>setChecked(true):index===questions.length-1?finish:next):(index===questions.length-1?finish:next)}>{saving?'Хадгалж байна…':Number.isInteger(quiz.answer)&&quiz.answer>=0?!checked?'Хариулт шалгах':index===questions.length-1?'Үр дүн харах':'Дараагийн асуулт':index===questions.length-1?'Үр дүн харах':'Дараагийн асуулт'}</button></>
    :<button className="primary" onClick={onClose}>Хаах</button>}
    </div>
  </div></div>
}

function LessonCarousel({lessons,renderLesson}) {
  const trackRef=useRef(null)
  const move=direction=>trackRef.current?.scrollBy({left:direction*trackRef.current.clientWidth,behavior:'smooth'})
  if(!lessons.length)return null
  return <section className="lesson-carousel" aria-label="Хичээлүүд">
    <div className="lesson-carousel-controls" aria-label="Хичээл гүйлгэх"><button type="button" onClick={()=>move(-1)} aria-label="Өмнөх хичээлүүд"><ChevronLeft/></button><button type="button" onClick={()=>move(1)} aria-label="Дараагийн хичээлүүд"><ChevronRight/></button></div>
    <div className="lesson-carousel-track" ref={trackRef}>{lessons.map(renderLesson)}</div>
  </section>
}

function Dashboard({ user, logout, onAdminReturn, theme, toggleTheme, onUserUpdate }) {
  const [passwordOpen,setPasswordOpen]=useState(false)
  const [profileOpen,setProfileOpen]=useState(false),[profileMenu,setProfileMenu]=useState(false)
  const [activeSection,setActiveSection]=useState('top')
  const [newsCount,setNewsCount]=useState(0)
  const [sidebarHidden,setSidebarHidden]=useState(()=>localStorage.getItem('securelab-sidebar-hidden')!=='false')
  const [lessons, setLessons] = useState([]), [selected, setSelected] = useState(null), [search, setSearch] = useState(''), [filter, setFilter] = useState('Бүгд'), [menu, setMenu] = useState(false)
  const searchInputRef=useRef(null)
  useEffect(()=>{ request('/lessons').then(setLessons).catch(()=>logout()) }, [])
  useEffect(()=>{ request('/news').then(items=>setNewsCount(items.length)).catch(()=>{}) }, [])
  useEffect(()=>{localStorage.setItem('securelab-sidebar-hidden',String(sidebarHidden))},[sidebarHidden])
  useEffect(()=>{
    const onShortcut=e=>{
      if(e.key.toLowerCase()!=='k'||!(e.metaKey||e.ctrlKey)||e.altKey) return
      const target=e.target
      const editing=target instanceof HTMLElement&&(target.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      if(editing&&target!==searchInputRef.current) return
      e.preventDefault()
      searchInputRef.current?.focus()
    }
    window.addEventListener('keydown',onShortcut)
    return()=>window.removeEventListener('keydown',onShortcut)
  },[])
  useEffect(()=>{
    const sections=['top','lessons','completed','news','progress']
    const onScroll=()=>{
      let current=sections.reduce((active,id)=>{
        const element=document.getElementById(id)
        return element&&element.getBoundingClientRect().top<=145?id:active
      },'top')
      const atPageEnd=window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-8
      if(atPageEnd&&document.getElementById('progress'))current='progress'
      setActiveSection(current)
    }
    onScroll();window.addEventListener('scroll',onScroll,{passive:true})
    return()=>window.removeEventListener('scroll',onScroll)
  },[])
  const [viewError,setViewError]=useState('')
  useEffect(()=>{
    if(!selected || onAdminReturn) return
    setViewError('')
    request(`/lessons/${selected.id}/view`,{method:'POST',body:'{}'}).catch(e=>setViewError('Хичээл нээсэн түүх хадгалагдсангүй: '+e.message))
  },[selected?.id])
  const completeCount = lessons.filter(l=>l.completed).length
  const levelFilters = ['Бүгд','Анхан','Дунд','Хүнд']
  const matchingLessons = useMemo(()=>lessons.filter(l => {
    const level=l.level==='Ахисан'?'Хүнд':l.level
    return (filter==='Бүгд'||level===filter)&&(l.title+l.description+l.category+level).toLowerCase().includes(search.toLowerCase())
  }),[lessons,search,filter])
  const filtered = useMemo(()=>matchingLessons.filter(l=>!l.completed&&!l.attempts),[matchingLessons])
  const completedLessons = useMemo(()=>matchingLessons.filter(l=>l.attempts>0||l.completed),[matchingLessons])
  const toggleComplete = async (lesson, answers) => {
    const result = await request(`/lessons/${lesson.id}/progress`, {method:'POST',body:JSON.stringify({answers})})
    setLessons(ls=>ls.map(l=>l.id===lesson.id?{...l,completed:result.completed?1:l.completed,last_score:result.score,attempts:(l.attempts||0)+1}:l))
    setSelected(s=>s?.id===lesson.id?{...s,completed:result.completed?1:s.completed,last_score:result.score}:s)
    return result
  }
  const lessonCard=l=>{const level=l.level==='Ахисан'?'Хүнд':l.level;return <article className="lesson-card" key={l.id} onClick={()=>setSelected(l)}><div className="thumb" style={{'--accent':l.accent}}><img className="topic-image" src={l.image_url||`/images/topic-${((l.id-1)%6)+1}.svg`} alt={l.title}/><span className="lesson-no">СЭДЭВ {l.id}</span>{l.completed ? <span className="status done"><Check/> +100 XP</span>:<span className="status"><Sparkles/> Эхлэх</span>}</div><div className="lesson-body"><div className="meta"><span>{l.category}</span><span><Clock3/> {l.duration}</span></div><h3>{l.title}</h3><p>{l.description}</p>{Boolean(l.completed)&&!l.attempts&&<div className="exam-status passed"><b>Өмнө дүүргэсэн</b><span>Хуучин шалгалтын оноо хадгалагдаагүй.</span></div>}{l.attempts>0&&<div className={l.last_score>=50?'exam-status passed':'exam-status failed'}><b>{l.last_score}% · {l.last_score>=50?'Тэнцсэн':'Тэнцсэнгүй'}</b><span>{l.attempts} оролдлого · Сүүлийн үр дүн</span></div>}<div className="lesson-foot"><span className={`level ${level}`}>{level}</span><button>{l.attempts>0?'Давтан үзэх':'Хичээл эхлэх'} <ArrowRight/></button></div></div></article>}
  return <div className={`app-shell ${sidebarHidden?'sidebar-hidden':''}`}>
    <aside className={menu?'open':''}><div className="side-top"><OrganizationLogo/><button className="side-close" aria-label="Цэс хаах" title="Цэс хаах" onClick={()=>setMenu(false)}><X/></button></div><nav>{onAdminReturn&&<button className="admin-return" onClick={onAdminReturn}><ShieldCheck/>Админ панел руу</button>}<a className={activeSection==='top'?'active':''} onClick={()=>setMenu(false)} href="#top"><LayoutGrid/>Нүүр</a><a className={activeSection==='lessons'?'active':''} href="#lessons" onClick={()=>setMenu(false)}><BookOpen/>Миний хичээлүүд <span>{lessons.length}</span></a><a className={activeSection==='completed'?'active':''} href="#completed" onClick={()=>setMenu(false)}><CheckCircle2/>Дуусгасан <span>{lessons.filter(l=>l.attempts>0||l.completed).length}</span></a><a className={activeSection==='news'?'active':''} href="#news" onClick={()=>setMenu(false)}><BookOpen/>Мэдээ мэдээлэл <span>{newsCount}</span></a><a className={activeSection==='progress'?'active':''} href="#progress" onClick={()=>{setActiveSection('progress');setMenu(false)}}><GraduationCap/>Явц</a></nav><div className="side-bottom"><div className="mini-shield"><ShieldCheck/><div><b>Сургалт</b><small>Аюулгүй суралц</small></div></div></div></aside>
    {menu&&<div className="aside-overlay" onClick={()=>setMenu(false)}/>} 
    <div className="main-area">
      <header><button className="menu-btn" aria-label={sidebarHidden?'Цэс харуулах':'Цэс нуух'} title={sidebarHidden?'Цэс харуулах':'Цэс нуух'} onClick={()=>{if(window.matchMedia('(max-width:760px)').matches)setMenu(true);else setSidebarHidden(value=>!value)}}><Menu/></button><div className="search"><Search/><input ref={searchInputRef} placeholder="Хичээл хайх..." value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="header-user"><Notifications request={request}/><div className="profile-wrap"><button type="button" className="profile profile-button" aria-haspopup="menu" aria-expanded={profileMenu} onClick={()=>setProfileMenu(v=>!v)}><div className="avatar">{user.name[0].toUpperCase()}</div><div><b>{user.name}</b><span>Суралцагч</span></div></button>{profileMenu&&<div className="profile-menu" role="menu"><button role="menuitem" onClick={()=>{setPasswordOpen(true);setProfileMenu(false)}}><LockKeyhole size={16}/>Нууц үг солих</button><button role="menuitem" onClick={()=>{setProfileOpen(true);setProfileMenu(false)}}><User size={16}/>Мэдээлэл солих</button><button role="menuitem" onClick={()=>{setProfileMenu(false);logout()}}><LogOut size={16}/>Гарах</button></div>}</div><ThemeToggle theme={theme} toggleTheme={toggleTheme}/></div></header>
      <div className="home-video-cover" aria-hidden="true"><video autoPlay muted loop playsInline preload="auto" tabIndex="-1"><source src="/media/phishing.mp4" type="video/mp4"/></video></div>
      <main className="dashboard" id="top">{viewError&&<p className="error" role="alert">{viewError}</p>}
        <section className="welcome"><div><div className="eyebrow"><Sparkles/> ТАНЫ СУРАЛЦАХ ОРОН ЗАЙ</div><h1>Сайн байна уу, {user.name.split(' ')[0]} 👋</h1><p>Өнөөдөр нэг алхам урагшилж, цахим хамгаалалтаа бэхжүүлцгээе.</p><button className="primary" onClick={()=>lessons[0]&&setSelected(lessons.find(l=>!l.completed)||lessons[0])}><Play size={18} fill="currentColor"/>Хичээлээ үргэлжлүүлэх</button></div><div className="orb"><div className="orbit"><ShieldCheck/></div><span className="dot d1"/><span className="dot d2"/><span className="dot d3"/></div></section>
        <section className="progress-row"><div className="progress-copy"><span className="progress-icon"><Zap/></span><div><b>Таны ахиц</b><small>{completeCount === lessons.length && lessons.length ? 'Бүх хичээлийг амжилттай дуусгалаа!' : 'Тууштай байгаарай, та сайн явж байна!'}</small></div></div><div className="progress-main"><div className="progress-label"><span>Нийт гүйцэтгэл</span><b>{lessons.length?Math.round(completeCount/lessons.length*100):0}%</b></div><div className="progress-track"><span style={{width:`${lessons.length?completeCount/lessons.length*100:0}%`}}/></div></div><div className="count"><b>{completeCount}</b><span>/ {lessons.length} хичээл</span></div></section>
        <div className="section-head" id="lessons"><div><span>СОРИЛТОД БЭЛЭН ҮҮ?</span><h2>Онол · Дадлага ажил · Шалгалт</h2></div><div className="filter-mobile"><Search size={18}/><input placeholder="Хайх" value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
        <div className="filters level-filters">{levelFilters.map(level=><button key={level} className={filter===level?'active':''} onClick={()=>setFilter(level)}>{level}</button>)}</div>
        <LessonCarousel lessons={filtered} renderLesson={lessonCard}/>
        {!filtered.length&&<div className="empty"><Search/><h3>Хичээл олдсонгүй</h3><p>Хайлтын үгээ өөрчлөөд үзээрэй.</p></div>}
        <section className="page-section" id="completed"><div className="section-head"><div><span>ТАНЫ ҮР ДҮН</span><h2>Дуусгасан болон шалгалт өгсөн хичээлүүд</h2></div></div><div className="lesson-grid">{completedLessons.map(lessonCard)}</div>{!completedLessons.length&&<div className="empty"><CheckCircle2/><h3>Шалгалт өгсөн хичээл алга байна</h3><p>Шалгалтаа дуусгахад оноо, үр дүн энд харагдана.</p></div>}</section>
        <section className="page-section"><News request={request} onCountChange={setNewsCount}/></section>
        <ProgressScope request={request}/>
      </main><footer><Brand compact/><span>© 2026 Нийтийн мэдээллийн дэд бүтэц, Нээлттэй өгөгдлийн газар</span><span>Мэдлэгтэй бол Аюулгүй</span></footer>
    </div>
    {passwordOpen&&<PasswordReset self user={user} request={request} onClose={()=>setPasswordOpen(false)} onSaved={()=>logout('Нууц үг амжилттай солигдлоо. Шинэ нууц үгээрээ дахин нэвтэрнэ үү.')}/>}
    {profileOpen&&<ProfileEdit user={user} request={request} onClose={()=>setProfileOpen(false)} onSaved={(updated)=>{onUserUpdate(updated);setProfileOpen(false)}}/>}
    <LessonModal lesson={selected} onClose={()=>setSelected(null)} onComplete={toggleComplete}/>
  </div>
}

const emptyUser = { surname:'',name:'',department:'',position:'',phone:'',email:'',password:'',role:'student' }

function AdminPanel({ user, logout, onLearnerView, theme, toggleTheme, onUserUpdate }) {
  const [data,setData]=useState({stats:{users:0,lessons:0,completions:0},users:[],lessons:[]})
  const [profileOpen,setProfileOpen]=useState(false),[profileMenu,setProfileMenu]=useState(false)
  const [newsCount,setNewsCount]=useState(0)
  const [adminActive,setAdminActive]=useState('admin-top')
  const [editingLesson,setEditingLesson]=useState(null), [showForm,setShowForm]=useState(false), [error,setError]=useState('')
  const [showUserForm,setShowUserForm]=useState(false), [userForm,setUserForm]=useState(emptyUser), [showUserPassword,setShowUserPassword]=useState(false), [previewLesson,setPreviewLesson]=useState(null)
  const [passwordUser,setPasswordUser]=useState(null),[notice,setNotice]=useState('')
  const [userDetail,setUserDetail]=useState(null)
  const [userSearch,setUserSearch]=useState(''),[userPage,setUserPage]=useState(1)
  const load=()=>request('/admin/overview').then(setData).catch(e=>setError(e.message))
  useEffect(()=>{load()},[])
  useEffect(()=>{request('/news').then(items=>setNewsCount(items.length)).catch(()=>{})},[])
  useEffect(()=>{
    const sections=['admin-top','admin-lessons','admin-users','news']
    const onScroll=()=>{
      const pageBottom=window.scrollY+window.innerHeight
      const documentBottom=document.documentElement.scrollHeight
      if(pageBottom>=documentBottom-8){
        const lastSection=[...sections].reverse().find(id=>document.getElementById(id))
        if(lastSection){setAdminActive(lastSection);return}
      }
      const activationLine=Math.min(220,Math.max(120,window.innerHeight*.25))
      const current=sections.reduce((active,id)=>{
        const element=document.getElementById(id)
        return element&&element.getBoundingClientRect().top<=activationLine?id:active
      },'admin-top')
      setAdminActive(current)
    }
    onScroll();window.addEventListener('scroll',onScroll,{passive:true})
    return()=>window.removeEventListener('scroll',onScroll)
  },[])
  const openForm=(lesson=null)=>{setEditingLesson(lesson);setShowForm(true);setError('')}
  const remove=async lesson=>{if(!confirm(`“${lesson.title}” хичээлийг устгах уу?`))return;await request(`/admin/lessons/${lesson.id}`,{method:'DELETE'});load()}
  const userAction=async(id,action,body)=>{try{await request(`/admin/users/${id}/${action}`,{method:action==='role'?'PATCH':'POST',body:JSON.stringify(body||{})});load()}catch(e){setError(e.message)}}
  const deleteUser=async u=>{if(!confirm(`${u.name} хэрэглэгчийг бүх явцтай нь устгах уу?`))return;try{await request(`/admin/users/${u.id}`,{method:'DELETE'});load()}catch(e){setError(e.message)}}
  const createUser=async e=>{e.preventDefault();setError('');try{await request('/admin/users',{method:'POST',body:JSON.stringify(userForm)});setShowUserForm(false);setUserForm(emptyUser);load()}catch(e){setError(e.message)}}
  const openUserDetail=async selectedUser=>{setUserDetail({data:null,loading:true,error:''});try{const details=await request(`/admin/users/${selectedUser.id}/details`);setUserDetail({data:details,loading:false,error:''})}catch(e){setUserDetail({data:null,loading:false,error:e.message})}}
  const preview=l=>setPreviewLesson({...l,content:JSON.parse(l.content_json||'[]'),cases:JSON.parse(l.cases_json||'[]'),quiz:JSON.parse(l.quiz_json||'[]'),completed:0})
  const filteredUsers=useMemo(()=>{
    const terms=userSearch.trim().toLocaleLowerCase('mn-MN').split(/\s+/).filter(Boolean)
    return data.users.filter(u=>{
      const searchable=[u.surname,u.name,u.email,u.phone,u.department,u.position,u.role==='admin'?'админ':'суралцагч'].filter(Boolean).join(' ').toLocaleLowerCase('mn-MN')
      return !terms.length||terms.every(term=>searchable.includes(term))
    }).sort(compareStaff)
  },[data.users,userSearch])
  const departments=useMemo(()=>[...new Set([...activeDepartments,...data.users.map(u=>u.department?.trim()).filter(Boolean)])].sort(compareDepartments),[data.users])
  const usersPerPage=10
  const userPageCount=Math.max(1,Math.ceil(filteredUsers.length/usersPerPage))
  useEffect(()=>setUserPage(page=>Math.min(page,userPageCount)),[userPageCount])
  const pagedUsers=filteredUsers.slice((userPage-1)*usersPerPage,userPage*usersPerPage)
  return <div className="admin-shell">
    <aside className="admin-side"><div className="side-top admin-side-top"><OrganizationLogo/></div><div className="admin-badge"><ShieldCheck/> Админ удирдлага</div><nav><a className={adminActive==='admin-top'?'active':''} href="#admin-top" onClick={()=>setAdminActive('admin-top')}><LayoutGrid/>Хяналтын самбар</a><button className="learner-view" onClick={onLearnerView}><BookOpen/>Хичээл рүү орох</button><a className={adminActive==='admin-lessons'?'active':''} href="#admin-lessons" onClick={()=>setAdminActive('admin-lessons')}><Zap/>Интерактив хичээлүүд <span>{data.stats.lessons}</span></a><a className={adminActive==='admin-users'?'active':''} href="#admin-users" onClick={()=>setAdminActive('admin-users')}><Users/>Хэрэглэгчид <span>{data.stats.users}</span></a><a className={adminActive==='news'?'active':''} href="#news" onClick={()=>setAdminActive('news')}><BookOpen/>Мэдээ мэдээлэл <span>{newsCount}</span></a></nav><div className="side-bottom"><div className="mini-shield"><div className="avatar">G</div><div><b>{user.name}</b><small>Системийн админ</small></div></div></div></aside>
    <div className="admin-main"><header><div><small>СУРГАЛТЫН УДИРДЛАГА</small><h2>Админ панел</h2></div><div className="admin-header-actions"><div className="profile-wrap"><button type="button" className="profile admin-top-profile profile-button" aria-haspopup="menu" aria-expanded={profileMenu} onClick={()=>setProfileMenu(v=>!v)}><div className="avatar">{user.name[0].toUpperCase()}</div><div><b>{user.name}</b><span>Админ</span></div></button>{profileMenu&&<div className="profile-menu" role="menu"><button role="menuitem" onClick={()=>{setPasswordUser(user);setProfileMenu(false)}}><LockKeyhole size={16}/>Нууц үг солих</button><button role="menuitem" onClick={()=>{setProfileOpen(true);setProfileMenu(false)}}><User size={16}/>Мэдээлэл солих</button><button role="menuitem" onClick={()=>{setProfileMenu(false);logout()}}><LogOut size={16}/>Гарах</button></div>}</div><ThemeToggle theme={theme} toggleTheme={toggleTheme}/><button className="preview-btn" onClick={onLearnerView}><BookOpen/>Хичээл үзэх</button><button className="primary" onClick={()=>openForm()}><Plus/>Шинэ хичээл</button></div></header>
      <main className="admin-content" id="admin-top"><div className="admin-welcome"><div><span>СИСТЕМИЙН ТОЙМ</span><h1>Сайн байна уу, {user.name}</h1><p>Сургалтын контент болон хэрэглэгчдийн мэдээллийг нэг дороос удирдана.</p></div><ShieldCheck/></div>
        {notice&&<p className="success-notice" role="status">{notice}</p>}<AdminAnalytics request={request}/>
        {error&&<div className="error">{error}</div>}
        <section className="admin-section" id="admin-lessons"><div className="admin-title"><div><span>КОНТЕНТ</span><h2>Интерактив хичээлүүд</h2></div><button onClick={()=>openForm()}><Plus/> Нэмэх</button></div><div className="admin-table-wrap"><table><thead><tr><th>Хичээл</th><th>Ангилал</th><th>Түвшин</th><th>Хугацаа</th><th>Үйлдэл</th></tr></thead><tbody>{data.lessons.map(l=><tr key={l.id}><td><i style={{background:l.accent}}><Zap/></i><b>{l.title}</b></td><td>{l.category}</td><td><span className="table-pill">{l.level}</span></td><td>{l.duration}</td><td><button aria-label="Хичээл үзэх" title="Хичээл үзэх" onClick={()=>preview(l)}><Eye/></button><button aria-label="Засах" title="Засах" onClick={()=>openForm(l)}><Edit3/></button><button aria-label="Устгах" title="Устгах" className="danger" onClick={()=>remove(l)}><Trash2/></button></td></tr>)}</tbody></table></div></section>
        <section className="admin-section" id="admin-users"><div className="admin-title"><div><span>БҮРЭН УДИРДЛАГА</span><h2>Хэрэглэгчид</h2></div><button onClick={()=>{setUserForm(emptyUser);setShowUserPassword(false);setError('');setShowUserForm(true)}}><Plus/> Хэрэглэгч үүсгэх</button></div><div className="user-table-tools"><label className="admin-user-search"><Search size={18}/><input type="search" value={userSearch} onChange={e=>{setUserSearch(e.target.value);setUserPage(1)}} placeholder="Нэр, и-мэйл, албан тушаал, нэгжээр хайх..." aria-label="Хэрэглэгч хайх"/>{userSearch&&<button type="button" title="Хайлтыг цэвэрлэх" aria-label="Хайлтыг цэвэрлэх" onClick={()=>{setUserSearch('');setUserPage(1)}}><X size={16}/></button>}</label><span>{userSearch?`${filteredUsers.length} хэрэглэгч олдлоо`:`Нийт ${data.users.length} хэрэглэгч`}</span></div><div className="admin-table-wrap"><table><thead><tr><th>Хэрэглэгч</th><th>Нэгж / Албан тушаал</th><th>И-мэйл</th><th>Эрх</th><th>Удирдах</th></tr></thead><tbody>{pagedUsers.map(u=><tr key={u.id}><td><div className="user-cell"><span>{u.name[0]}</span><b>{u.surname?u.surname+' ':''}{u.name}</b></div></td><td>{u.department||'—'}<br/><small>{u.position||'—'}</small></td><td><b className="username-text">{u.email}</b>{u.phone&&<><br/><small>{u.phone}</small></>}</td><td><span className={`role ${u.role}`}>{u.role==='admin'?'Админ':'Суралцагч'}</span></td><td className="user-actions"><button className="user-detail-button" title="Дэлгэрэнгүй мэдээлэл" aria-label={`${u.name}: дэлгэрэнгүй`} onClick={()=>openUserDetail(u)}><Eye/><span>Дэлгэрэнгүй</span></button><button title="Нууц үг шинэчлэх" aria-label={`${u.name}: нууц үг шинэчлэх`} onClick={()=>{setPasswordUser(u);setNotice('')}}><LockKeyhole/></button>{u.id!==user.id&&<><button aria-label="Эрх солих" title="Эрх солих" onClick={()=>userAction(u.id,'role',{role:u.role==='admin'?'student':'admin'})}><Shield/></button><button aria-label="Явц тэглэх" title="Явц тэглэх" onClick={()=>userAction(u.id,'reset-progress')}><Zap/></button><button aria-label="Устгах" title="Устгах" className="danger" onClick={()=>deleteUser(u)}><Trash2/></button></>}</td></tr>)}{!pagedUsers.length&&<tr><td colSpan="5"><div className="user-search-empty"><Search size={22}/><b>Хэрэглэгч олдсонгүй</b><span>Хайлтын үгээ өөрчилж дахин оролдоно уу.</span></div></td></tr>}</tbody></table></div>{filteredUsers.length>usersPerPage&&<nav className="user-pagination" aria-label="Хэрэглэгчийн хуудас"><button type="button" disabled={userPage===1} onClick={()=>setUserPage(page=>page-1)} aria-label="Өмнөх хуудас">‹</button>{Array.from({length:userPageCount},(_,index)=>index+1).map(page=><button type="button" key={page} className={page===userPage?'active':''} aria-current={page===userPage?'page':undefined} onClick={()=>setUserPage(page)}>{page}</button>)}<button type="button" disabled={userPage===userPageCount} onClick={()=>setUserPage(page=>page+1)} aria-label="Дараагийн хуудас">›</button></nav>}<p className="user-page-summary">{filteredUsers.length?`${(userPage-1)*usersPerPage+1}–${Math.min(userPage*usersPerPage,filteredUsers.length)} / ${filteredUsers.length}`:'0 хэрэглэгч'}</p></section>
        <News request={request} admin onCountChange={setNewsCount}/>
      </main>
    </div>
    {passwordUser&&<PasswordReset user={passwordUser} request={request} onClose={()=>setPasswordUser(null)} onSaved={()=>{const self=passwordUser.id===user.id;setPasswordUser(null);if(self)logout();else setNotice('Нууц үг шинэчлэгдлээ. Хэрэглэгч шинэ нууц үгээр дахин нэвтэрнэ.')}}/>}
    {userDetail&&<UserDetailModal data={userDetail.data} loading={userDetail.loading} error={userDetail.error} onClose={()=>setUserDetail(null)}/>}
    {profileOpen&&<ProfileEdit user={user} request={request} onClose={()=>setProfileOpen(false)} onSaved={(updated)=>{onUserUpdate(updated);setProfileOpen(false);load()}}/>}
    {showForm&&<LessonEditor lesson={editingLesson} request={request} onClose={()=>setShowForm(false)} onSaved={()=>{setShowForm(false);setEditingLesson(null);load()}} onPreview={lesson=>setPreviewLesson(lesson)}/>}
    {showUserForm&&<div className="modal-bg"><form className="lesson-form" onSubmit={createUser}>
      <button type="button" className="modal-close" title="Хаах" aria-label="Хаах" onClick={()=>setShowUserForm(false)}><X/></button>
      <span>ХЭРЭГЛЭГЧИЙН УДИРДЛАГА</span><h2>Шинэ хэрэглэгч үүсгэх</h2>
      <div className="form-row"><label>Овог<input maxLength="120" value={userForm.surname} onChange={e=>setUserForm({...userForm,surname:e.target.value})}/></label><label>Нэр<input required maxLength="120" value={userForm.name} onChange={e=>setUserForm({...userForm,name:e.target.value})}/></label></div>
      <label>Нэгж<select required value={userForm.department} onChange={e=>setUserForm({...userForm,department:e.target.value})}><option value="">Нэгж сонгох</option>{departments.map(department=><option key={department} value={department}>{department}</option>)}</select></label>
      <label>Албан тушаал<input maxLength="240" value={userForm.position} onChange={e=>setUserForm({...userForm,position:e.target.value})}/></label>
      <div className="form-row"><label>И-мэйл / нэвтрэх нэр<input required maxLength="160" type="email" value={userForm.email} onChange={e=>setUserForm({...userForm,email:e.target.value})}/></label><label>Утас<input maxLength="20" value={userForm.phone} onChange={e=>setUserForm({...userForm,phone:e.target.value})}/></label></div>
      <div className="form-row"><label>Нууц үг<div className="password-control"><input required minLength="12" maxLength="72" autoComplete="new-password" type={showUserPassword?'text':'password'} placeholder="Том, жижиг үсэг + тоо + тусгай тэмдэгт" value={userForm.password} onChange={e=>setUserForm({...userForm,password:e.target.value})}/><button type="button" title={showUserPassword?'Нууц үг нуух':'Нууц үг харуулах'} aria-label={showUserPassword?'Нууц үг нуух':'Нууц үг харуулах'} onClick={()=>setShowUserPassword(value=>!value)}>{showUserPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label><label>Эрхийн түвшин<select value={userForm.role} onChange={e=>setUserForm({...userForm,role:e.target.value})}><option value="student">Суралцагч</option><option value="admin">Админ</option></select></label></div>
      {error&&<div className="error">{error}</div>}<button className="primary"><Plus/> Хэрэглэгч үүсгэх</button>
    </form></div>}
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
  const updateUser=(updated)=>{const next={...user,...updated};localStorage.setItem(userKey,JSON.stringify(next));setUser(next)}
  const logout=(message)=>{setAuthNotice(typeof message==='string'?message:'');const path=user?.role==='admin'?'/admin/login':'/login';localStorage.removeItem(tokenKey);localStorage.removeItem(userKey);setUser(null);navigate(path,true)}
  if(!user) return <Auth notice={authNotice} key={route} adminOnly={route==='/admin/login'} onAuth={onAuth} theme={theme} toggleTheme={toggleTheme}/>
  if(requireInitialPasswordChange&&user.must_change_password) return <div className="app-shell"><PasswordReset mandatory self user={user} request={request} onClose={()=>{}} onSaved={()=>logout('Нууц үг амжилттай солигдлоо. Шинэ нууц үгээрээ дахин нэвтэрнэ үү.')}/></div>
  if(user.role==='admin') return route==='/admin/preview'?<Dashboard user={user} logout={logout} onAdminReturn={()=>navigate('/admin')} theme={theme} toggleTheme={toggleTheme} onUserUpdate={updateUser}/>:<AdminPanel user={user} logout={logout} onLearnerView={()=>navigate('/admin/preview')} theme={theme} toggleTheme={toggleTheme} onUserUpdate={updateUser}/>
  return <Dashboard user={user} logout={logout} theme={theme} toggleTheme={toggleTheme} onUserUpdate={updateUser}/>
}

createRoot(document.getElementById('root')).render(<App/>)
