import { curriculum } from '../server/curriculum.js'
import { foundations } from '../server/foundations.js'
import { additionalCourses } from '../server/additional-courses.js'

const storeKey='securelab-static-store-v1'
const now=()=>new Date().toISOString()
const baseLessons=[
  [1,'Фишинг халдлагыг таних нь','Хуурамч имэйл, холбоос болон яаралтай үйлдэл шаардах мессежийг хэрхэн таних вэ?','25–30 мин','Анхан','Сошиал инженерчлэл','#8b5cf6','/images/topic-1.svg'],
  [2,'Хүчирхэг нууц үг ба MFA','Нууц үгийн зөв дадал, password manager болон олон шатлалт баталгаажуулалт.','25–30 мин','Анхан','Бүртгэл хамгаалалт','#22d3a7','/images/topic-2.svg'],
  [3,'Нийтийн Wi‑Fi-ийн эрсдэл','Нээлттэй сүлжээнд мэдээллээ алдахгүй байхад VPN ба HTTPS хэрхэн тусалдаг вэ?','25–30 мин','Дунд','Сүлжээний аюулгүй байдал','#38bdf8','/images/topic-3.svg'],
  [4,'Ransomware-ээс сэргийлэх нь','Хорт програм хэрхэн тархдаг, backup яагаад хэрэгтэй, халдлагын үед юу хийх вэ?','25–30 мин','Дунд','Хортой програм','#fb7185','/images/topic-4.svg'],
  [5,'Өгөгдөл ба хувийн нууц','Хуваалцаж буй мэдээллээ хянаж, төхөөрөмжийн privacy тохиргоог зөв хийх нь.','25–30 мин','Анхан','Хувийн мэдээлэл','#fbbf24','/images/topic-5.svg'],
  [6,'Инцидент мэдээлэх алхам','Сэжигтэй үйлдэл илэрвэл баримтжуулах, тусгаарлах, мэдээлэх дараалал.','25–30 мин','Ахисан','Инцидент хариу','#f97316','/images/topic-6.svg']
]
const legacyCases=content=>(Array.isArray(content)?content:[]).filter(s=>s.example).map(s=>({title:s.title,text:s.example,explanation:s.text,task:s.task||'',icon:s.icon||'shield'}))
const initialLessons=()=>[
  ...baseLessons.map(([id,title,description,duration,level,category,accent,image_url])=>{
    const pack=curriculum[id], content=[{...foundations[id],icon:'book'},...pack.steps]
    return {id,title,description,duration,level,category,video_url:'',accent,image_url,content_json:JSON.stringify(content),cases_json:JSON.stringify(legacyCases(content)),quiz_json:JSON.stringify(pack.quiz)}
  }),
  ...additionalCourses.map((c,i)=>({id:7+i,title:c.title,description:c.description,duration:'25–30 мин',level:'Анхан',category:c.category,video_url:'',accent:c.accent,image_url:c.image,content_json:JSON.stringify(c.content),cases_json:JSON.stringify(legacyCases(c.content)),quiz_json:JSON.stringify(c.quiz)}))
]
function read(){
  try{const saved=JSON.parse(localStorage.getItem(storeKey)||'null');if(saved?.users?.length)return saved}catch{}
  const seed={users:[{id:1,name:'Galsan',username:'Galsan',email:'admin@securelab.mn',password:'Galsan0423',role:'admin',created_at:now()}],lessons:initialLessons(),progress:[],attempts:[],views:[],logins:[],news:[],next:{user:2,lesson:initialLessons().length+1,news:1,attempt:1}}
  localStorage.setItem(storeKey,JSON.stringify(seed));return seed
}
const write=s=>localStorage.setItem(storeKey,JSON.stringify(s))
const cleanUser=u=>({id:u.id,name:u.name,username:u.username,email:u.email,role:u.role,created_at:u.created_at})
const tokenFor=id=>'static-'+id+'-'+Date.now()
const userFromToken=s=>{const id=Number((localStorage.getItem('securelab-token')||'').split('-')[1]);return s.users.find(u=>u.id===id)}
const json=lesson=>({...lesson,content:JSON.parse(lesson.content_json||'[]'),cases:JSON.parse(lesson.cases_json||'[]'),quiz:JSON.parse(lesson.quiz_json||'[]')})
const lessonFor=(s,u,l)=>{
  const p=s.progress.find(p=>p.user_id===u.id&&p.lesson_id===l.id), history=s.attempts.filter(a=>a.user_id===u.id&&a.lesson_id===l.id).sort((a,b)=>b.id-a.id)
  return {...json(l),completed:p?.completed?1:0,last_score:history[0]?.score??null,attempts:history.length}
}
const requireUser=s=>{const u=userFromToken(s);if(!u)throw new Error('Нэвтрэх шаардлагатай.');return u}
const requireAdmin=u=>{if(u.role!=='admin')throw new Error('Админ эрх шаардлагатай.')}

export async function mockRequest(path,options={}){
  await new Promise(r=>setTimeout(r,80))
  const s=read(), method=(options.method||'GET').toUpperCase(), body=options.body?JSON.parse(options.body):{}
  if(path==='/auth/login'&&method==='POST'){
    const u=s.users.find(x=>(x.username===body.identifier||x.email===body.identifier)&&x.password===body.password)
    if(!u)throw new Error('Нэвтрэх нэр эсвэл нууц үг буруу байна.')
    s.logins.push({user_id:u.id,created_at:now()});write(s);return {token:tokenFor(u.id),user:cleanUser(u)}
  }
  const u=requireUser(s)
  if(path==='/auth/password'&&method==='POST'){if(u.password!==body.currentPassword)throw new Error('Одоогийн нууц үг буруу байна.');u.password=body.password;write(s);return {ok:true}}
  if(path==='/lessons'&&method==='GET')return s.lessons.map(l=>lessonFor(s,u,l))
  let m=path.match(/^\/lessons\/(\d+)\/view$/);if(m&&method==='POST'){if(u.role!=='admin'){const row=s.views.find(v=>v.user_id===u.id&&v.lesson_id===+m[1]);row?(row.opens++,row.last_viewed_at=now()):s.views.push({user_id:u.id,lesson_id:+m[1],opens:1,first_viewed_at:now(),last_viewed_at:now()});write(s)}return {ok:true}}
  m=path.match(/^\/lessons\/(\d+)\/progress$/);if(m&&method==='POST'){
    const lesson=s.lessons.find(l=>l.id===+m[1]);if(!lesson)throw new Error('Хичээл олдсонгүй.')
    const quiz=JSON.parse(lesson.quiz_json||'[]'), answers=body.answers||[]
    const correct=quiz.reduce((n,q,i)=>n+(Number(answers[i])===Number(q.answer)?1:0),0), score=quiz.length?Math.round(correct/quiz.length*100):0, passed=score>=50
    s.attempts.push({id:s.next.attempt++,user_id:u.id,lesson_id:lesson.id,score,passed:passed?1:0,created_at:now()})
    const p=s.progress.find(p=>p.user_id===u.id&&p.lesson_id===lesson.id);p?p.completed=passed?1:p.completed:s.progress.push({user_id:u.id,lesson_id:lesson.id,completed:passed?1:0,updated_at:now()});write(s);return {score,completed:passed}
  }
  if(path==='/news'&&method==='GET')return [...s.news].sort((a,b)=>b.id-a.id)
  if(path==='/admin/overview'&&method==='GET'){requireAdmin(u);return {stats:{users:s.users.length,lessons:s.lessons.length,completions:s.progress.filter(p=>p.completed).length},users:s.users.map(cleanUser),lessons:s.lessons}}
  if(path==='/admin/analytics'&&method==='GET'){requireAdmin(u);return analytics(s)}
  if(path==='/admin/users'&&method==='POST'){requireAdmin(u);if(s.users.some(x=>x.username===body.username||x.email===body.email))throw new Error('Username эсвэл и-мэйл бүртгэлтэй байна.');s.users.push({id:s.next.user++,name:body.name,username:body.username,email:body.email,password:body.password,role:body.role||'student',created_at:now()});write(s);return {ok:true}}
  m=path.match(/^\/admin\/users\/(\d+)\/(role|reset-progress|password)$/);if(m){requireAdmin(u);const target=s.users.find(x=>x.id===+m[1]);if(!target)throw new Error('Хэрэглэгч олдсонгүй.');if(m[2]==='role')target.role=body.role;if(m[2]==='password')target.password=body.password;if(m[2]==='reset-progress'){s.progress=s.progress.filter(p=>p.user_id!==target.id);s.attempts=s.attempts.filter(a=>a.user_id!==target.id);s.views=s.views.filter(v=>v.user_id!==target.id)}write(s);return {ok:true}}
  m=path.match(/^\/admin\/users\/(\d+)$/);if(m&&method==='DELETE'){requireAdmin(u);s.users=s.users.filter(x=>x.id!==+m[1]);write(s);return {ok:true}}
  if(path==='/admin/lessons'&&method==='POST'){requireAdmin(u);const id=s.next.lesson++;s.lessons.push({...body,id,video_url:'',content_json:JSON.stringify(body.content||[]),cases_json:JSON.stringify(body.cases||[]),quiz_json:JSON.stringify(body.quiz||[])});write(s);return {id}}
  m=path.match(/^\/admin\/lessons\/(\d+)$/);if(m&&method==='PUT'){requireAdmin(u);const i=s.lessons.findIndex(l=>l.id===+m[1]);if(i<0)throw new Error('Хичээл олдсонгүй.');s.lessons[i]={...s.lessons[i],...body,id:+m[1],content_json:JSON.stringify(body.content||[]),cases_json:JSON.stringify(body.cases||[]),quiz_json:JSON.stringify(body.quiz||[])};write(s);return {ok:true}}
  if(m&&method==='DELETE'){requireAdmin(u);s.lessons=s.lessons.filter(l=>l.id!==+m[1]);write(s);return {ok:true}}
  if(path==='/admin/news'&&method==='POST'){requireAdmin(u);s.news.push({id:s.next.news++,title:body.title,body:body.body,author:body.author,category:body.category,filename:body.file?.name||null,size:body.file?1024:0,created_at:now(),updated_at:now()});write(s);return {ok:true}}
  m=path.match(/^\/admin\/news\/(\d+)$/);if(m&&method==='PUT'){requireAdmin(u);const item=s.news.find(n=>n.id===+m[1]);if(!item)throw new Error('Мэдээ олдсонгүй.');Object.assign(item,{title:body.title,body:body.body,author:body.author,category:body.category,filename:body.removeFile?null:(body.file?.name||item.filename),updated_at:now()});write(s);return {ok:true}}
  if(m&&method==='DELETE'){requireAdmin(u);s.news=s.news.filter(n=>n.id!==+m[1]);write(s);return {ok:true}}
  throw new Error('Static publish fallback: endpoint олдсонгүй.')
}
function analytics(s){
  const students=s.users.filter(u=>u.role==='student'), courses=s.lessons.map(l=>({id:l.id,title:l.title,viewed:0,tested:0,completed:0}))
  const reports=s.users.map(u=>({...cleanUser(u),logins:s.logins.filter(l=>l.user_id===u.id).length,last_login:s.logins.filter(l=>l.user_id===u.id).at(-1)?.created_at||null,courses:s.lessons.map(l=>{const history=s.attempts.filter(a=>a.user_id===u.id&&a.lesson_id===l.id).sort((a,b)=>b.id-a.id), view=s.views.find(v=>v.user_id===u.id&&v.lesson_id===l.id), completed=s.progress.some(p=>p.user_id===u.id&&p.lesson_id===l.id&&p.completed);return {id:l.id,title:l.title,opened:!!view,opens:view?.opens||0,last_viewed:view?.last_viewed_at||null,attempts:history.length,last_score:history[0]?.score??null,best_score:history.length?Math.max(...history.map(a=>a.score)):null,last_exam:history[0]?.created_at||null,completed,history}})}))
  reports.forEach(r=>{r.viewed=r.courses.filter(c=>c.opened).length;r.tested=r.courses.filter(c=>c.attempts).length;r.completed=r.courses.filter(c=>c.completed).length;const scores=r.courses.filter(c=>c.last_score!==null).map(c=>c.last_score);r.average=scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):null})
  courses.forEach(c=>{c.viewed=reports.filter(u=>u.role==='student'&&u.courses.find(x=>x.id===c.id)?.opened).length;c.tested=reports.filter(u=>u.role==='student'&&u.courses.find(x=>x.id===c.id)?.attempts).length;c.completed=reports.filter(u=>u.role==='student'&&u.courses.find(x=>x.id===c.id)?.completed).length})
  const attempts=s.attempts.filter(a=>students.some(u=>u.id===a.user_id)), accessed=students.filter(u=>s.logins.some(l=>l.user_id===u.id)).length
  return {started_at:s.logins[0]?.created_at||now(),summary:{registered:students.length,accessed,logins:s.logins.length,active7:accessed,viewed:s.views.length,tested:students.filter(u=>attempts.some(a=>a.user_id===u.id)).length,attempts:attempts.length,pass_rate:attempts.length?Math.round(attempts.filter(a=>a.passed).length/attempts.length*100):null},daily:Array.from({length:7},(_,i)=>({day:new Date(Date.now()-(6-i)*864e5).toISOString().slice(0,10),users:i===6?accessed:0})),users:reports,courses}
}
