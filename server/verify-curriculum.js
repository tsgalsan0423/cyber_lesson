import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { curriculum } from './curriculum.js'

const directory = mkdtempSync(path.join(tmpdir(), 'securelab-check-'))
const port = 3197
const server = spawn(process.execPath, ['server/index.js'], {
  env: {...process.env, PORT: String(port), DATABASE_PATH: path.join(directory,'test.db')},
  stdio: ['ignore','pipe','pipe']
})
let token
async function call(route, body) {
  return fetch('http://127.0.0.1:'+port+'/api'+route,{
    method:body?'POST':'GET',
    headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  })
}
try {
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Server startup timeout')),5000)
    server.once('exit',code=>{clearTimeout(timer);reject(new Error('Server exited: '+code))})
    server.stdout.once('data',()=>{clearTimeout(timer);resolve()})
    server.stderr.on('data',data=>process.stderr.write(data))
  })
  const login = await call('/auth/login',{identifier:'Galsan',password:'Galsan0423'})
  assert.equal(login.status,200)
  token=(await login.json()).token
  let lessons=await (await call('/lessons')).json()
  assert.equal(lessons.length,10)
  for(const lesson of lessons){assert.equal(lesson.content.length,6);assert.equal(lesson.quiz.length,4)}
  for(const lesson of lessons.slice(6)){
    assert.equal(lesson.content.filter(s=>s.example&&s.task).length,5)
    assert.ok(lesson.image_url.startsWith('/images/topic-'))
    const correct=lesson.quiz.map(q=>q.answer)
    assert.deepEqual(await (await call('/lessons/'+lesson.id+'/progress',{answers:correct})).json(),{score:100,completed:true})
  }
  const answers=curriculum[1].quiz.map(q=>q.answer)
  const wrong=curriculum[1].quiz.map(q=>(q.answer+1)%q.options.length)
  assert.equal((await call('/lessons/1/progress',{completed:true})).status,400)
  assert.equal((await (await call('/lessons/1/progress',{answers:wrong})).json()).completed,false)
  const below=[...wrong]; below[0]=answers[0]
  assert.deepEqual(await (await call('/lessons/1/progress',{answers:below})).json(),{score:25,completed:false})
  const partial=[...answers]; partial[0]=wrong[0]; partial[1]=wrong[1]
  assert.deepEqual(await (await call('/lessons/1/progress',{answers:partial})).json(),{score:50,completed:true})
  assert.deepEqual(await (await call('/lessons/1/progress',{answers})).json(),{score:100,completed:true})
  await call('/lessons/1/progress',{answers:wrong})
  lessons=await (await call('/lessons')).json()
  assert.equal(lessons[0].completed,1,'A failed retry must not erase completion')
  assert.equal(lessons[0].last_score,0)
  assert.equal(lessons[0].attempts,5)
  assert.equal((await call('/lessons/9999/progress',{answers})).status,404)
  const adminToken=token
  assert.equal((await call('/admin/users',{name:'Dashboard Test',username:'dashboard-test',email:'dashboard@example.test',password:'test-password'})).status,200)
  await call('/admin/users',{name:'Never Logged In',username:'no-login',email:'no-login@example.test',password:'test-password'})
  await call('/lessons/1/view',{})
  let report=await (await call('/admin/analytics')).json()
  assert.equal(report.summary.registered,2)
  assert.equal(report.summary.accessed,0)
  assert.equal(report.summary.viewed,0,'Admin previews are excluded')
  token=(await (await call('/auth/login',{identifier:'dashboard-test',password:'test-password'})).json()).token
  assert.equal((await call('/admin/analytics')).status,403)
  await call('/lessons/1/view',{})
  await call('/lessons/1/view',{})
  await call('/lessons/2/view',{})
  assert.equal((await call('/lessons/9999/view',{})).status,404)
  await call('/lessons/1/progress',{answers:wrong})
  await call('/lessons/1/progress',{answers})
  token=adminToken
  report=await (await call('/admin/analytics')).json()
  assert.equal(report.summary.accessed,1)
  assert.equal(report.summary.logins,1)
  assert.equal(report.summary.viewed,2)
  assert.equal(report.summary.tested,1)
  assert.equal(report.summary.attempts,2)
  assert.equal(report.summary.pass_rate,50)
  assert.equal(report.daily.length,7)
  const learner=report.users.find(u=>u.username==='dashboard-test')
  assert.equal(learner.viewed,2)
  assert.equal(learner.average,100)
  assert.equal(learner.courses[0].opens,2)
  assert.equal(learner.courses[0].last_score,100)
  assert.equal(learner.courses[0].history.length,2)
  console.log('PASS: dashboard totals, student isolation, unique views, login count, history and admin authorization')
  assert.equal((await call('/admin/users/'+learner.id+'/password',{password:'short'})).status,400)
  const oldStudent=(await (await call('/auth/login',{identifier:'dashboard-test',password:'test-password'})).json()).token
  assert.equal((await call('/admin/users/'+learner.id+'/password',{password:'new-test-password'})).status,200)
  assert.equal((await call('/auth/login',{identifier:'dashboard-test',password:'test-password'})).status,401)
  token=oldStudent
  assert.equal((await call('/lessons')).status,401)
  const newStudent=(await (await call('/auth/login',{identifier:'dashboard-test',password:'new-test-password'})).json()).token
  token=newStudent
  assert.equal((await call('/lessons')).status,200)
  assert.equal((await call('/admin/news',{title:'Unauthorized'})).status,403)
  token=adminToken
  const metadata={title:'Оны төлөвлөгөө',body:'Хэрэгжүүлэх ажлын төлөвлөгөө',author:'Мэргэжилтэн',category:'Оны төлөвлөгөө'}
  assert.equal((await call('/admin/news',{...metadata,file:{name:'bad.pdf',base64:Buffer.from('not a pdf').toString('base64')}})).status,400)
  const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF')
  const created=await call('/admin/news',{...metadata,file:{name:'Төлөвлөгөө.pdf',base64:pdf.toString('base64')}})
  assert.equal(created.status,201)
  const newsId=(await created.json()).id
  token=newStudent
  const news=await (await call('/news')).json()
  assert.equal(news[0].title,metadata.title)
  assert.equal(news[0].filename,'Төлөвлөгөө.pdf')
  const download=await call('/news/'+newsId+'/pdf')
  assert.equal(download.headers.get('content-type'),'application/pdf')
  assert.deepEqual(Buffer.from(await download.arrayBuffer()),pdf)
  token=null
  assert.equal((await call('/news/'+newsId+'/pdf')).status,401)
  token=adminToken
  const changed=await fetch('http://127.0.0.1:'+port+'/api/admin/news/'+newsId,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({...metadata,title:'Зассан гарчиг'})})
  assert.equal(changed.status,200)
  assert.equal((await (await call('/news')).json())[0].filename,'Төлөвлөгөө.pdf')
  const deleted=await fetch('http://127.0.0.1:'+port+'/api/admin/news/'+newsId,{method:'DELETE',headers:{Authorization:'Bearer '+token}})
  assert.equal(deleted.status,200)
  assert.equal((await call('/news/'+newsId+'/pdf')).status,404)
  console.log('PASS: password reset, old-session revocation, PDF validation, protected download, news create/edit/delete')
  token=null
  assert.equal((await call('/auth/password',{currentPassword:'new-test-password',password:'self-changed-password',confirmation:'self-changed-password'})).status,401)
  token=newStudent
  const change={currentPassword:'new-test-password',password:'self-changed-password',confirmation:'self-changed-password'}
  assert.equal((await call('/auth/password',{...change,currentPassword:'wrong-password'})).status,400)
  assert.equal((await call('/auth/password',{...change,confirmation:'mismatch-password'})).status,400)
  assert.equal((await call('/auth/password',{...change,password:'short',confirmation:'short'})).status,400)
  assert.equal((await call('/auth/password',{...change,password:'a'.repeat(73),confirmation:'a'.repeat(73)})).status,400)
  assert.equal((await call('/auth/password',{...change,password:'new-test-password',confirmation:'new-test-password'})).status,400)
  assert.equal((await call('/lessons')).status,200,'Invalid changes must not invalidate sessions')
  // A supplied target id cannot change someone else's password.
  assert.equal((await call('/auth/password',{...change,id:1,user_id:1})).status,200)
  assert.equal((await call('/lessons')).status,401)
  assert.equal((await call('/auth/login',{identifier:'dashboard-test',password:'new-test-password'})).status,401)
  const selfLogin=await call('/auth/login',{identifier:'dashboard-test',password:'self-changed-password'})
  assert.equal(selfLogin.status,200)
  token=(await selfLogin.json()).token
  assert.equal((await call('/lessons')).status,200)
  token=adminToken
  assert.equal((await call('/admin/analytics')).status,200,'Other users remain signed in')
  assert.equal((await call('/auth/login',{identifier:'Galsan',password:'Galsan0423'})).status,200)
  const dataImage='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect width="16" height="9" fill="#2563eb"/></svg>').toString('base64')
  const authoredLesson={
    title:'Админы гараар үүсгэсэн сургалт',
    description:'Онол, кейс, шалгалтыг админ бүрэн бичиж хадгалах шалгалт.',
    duration:'18 мин',
    level:'Дунд',
    category:'Редактор тест',
    accent:'#2563eb',
    image_url:dataImage,
    content:[{title:'Онолын үндэс',text:'Нэгдүгээр ойлголт. Хоёрдугаар ойлголт. Гуравдугаар ойлголт.',task:'Гурван эрсдэл бич.',icon:'shield'}],
    cases:[{title:'Кейсийн нөхцөл',text:'Ажилтан танихгүй холбоос дээр дарах гэж байна.',explanation:'Эх сурвалж, домэйн, үйлдлийн зорилгыг шалгана.',task:'Шалгах хоёр алхам нэрлэ.',icon:'search'}],
    quiz:[{question:'Ямар үйлдэл зөв вэ?',options:['Шууд дарах','Эх сурвалжийг шалгах','Нууц үгээ оруулах'],answer:1,explain:'Эх сурвалжийг шалгах нь эрсдэлийг бууруулна.'}]
  }
  const createdLesson=await call('/admin/lessons',authoredLesson)
  assert.equal(createdLesson.status,200)
  const authoredId=(await createdLesson.json()).id
  const malformed=await call('/admin/lessons',{...authoredLesson,quiz:[{question:'Дутуу',options:['A'],answer:0,explain:''}]})
  assert.equal(malformed.status,400)
  const updatedLesson={...authoredLesson,title:'Зассан сургалт',content:[{...authoredLesson.content[0],title:'Зассан онол'}],cases:[{...authoredLesson.cases[0],explanation:'Зассан тайлбар хадгалагдсан.'}],quiz:[{...authoredLesson.quiz[0],options:['Буруу','Зөв'],answer:1}]}
  const updated=await fetch('http://127.0.0.1:'+port+'/api/admin/lessons/'+authoredId,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(updatedLesson)})
  assert.equal(updated.status,200)
  token=(await (await call('/auth/login',{identifier:'dashboard-test',password:'self-changed-password'})).json()).token
  const studentLessons=await (await call('/lessons')).json()
  const authored=studentLessons.find((lesson)=>lesson.id===authoredId)
  assert.equal(authored.title,'Зассан сургалт')
  assert.equal(authored.content[0].title,'Зассан онол')
  assert.equal(authored.cases[0].explanation,'Зассан тайлбар хадгалагдсан.')
  assert.equal(authored.image_url,dataImage)
  assert.deepEqual(await (await call('/lessons/'+authoredId+'/progress',{answers:[1]})).json(),{score:100,completed:true})
  token=adminToken
  console.log('PASS: admin lesson authoring, full content update, validation, student delivery and scoring')
  console.log('PASS: self-service password verification, validation, user isolation, session revocation and re-login')
  console.log('PASS: expanded theory, 0/25/50/100% scores, attempt count, latest score, persistent completion')
} finally {
  server.kill()
  await new Promise(resolve=>server.exitCode!==null?resolve():server.once('exit',resolve))
  rmSync(directory,{recursive:true,force:true})
}
