import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { curriculum } from './curriculum.js'
import {plainLessons} from './plain-language.js'
import {randomQuiz,originalAnswers} from '../src/quizOrder.js'

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
  assert.equal(login.headers.get('x-content-type-options'),'nosniff')
  assert.equal(login.headers.get('x-frame-options'),'DENY')
  assert.equal(login.headers.get('cache-control'),'no-store')
  for(let i=0;i<4;i++)assert.equal((await call('/auth/login',{identifier:'rate-limit-target',password:'Wrong-Password-9!'})).status,401)
  const blockedLogin=await call('/auth/login',{identifier:'rate-limit-target',password:'Wrong-Password-9!'})
  assert.equal(blockedLogin.status,429);assert.ok(Number(blockedLogin.headers.get('retry-after'))>0)
  assert.equal((await call('/auth/register',{name:'Public attacker'})).status,403)
  assert.equal((await call('/auth/login',{identifier:"' OR 1=1 --",password:'Wrong-Password-9!'})).status,401)
  const validAdminToken=token;token=token.slice(0,-1)+(token.endsWith('a')?'b':'a')
  assert.equal((await call('/lessons')).status,401);token=validAdminToken
  let lessons=await (await call('/lessons')).json()
  assert.equal(lessons.length,10)
  for(const lesson of lessons){
    assert.ok(lesson.objectives.length>0)
    assert.ok(lesson.summary.length>=3)
    assert.ok(!Object.hasOwn(lesson,'quiz_json'),'Raw quiz data must not be sent to students')
    assert.ok(lesson.quiz.every(q=>!Object.hasOwn(q,'answer')&&!Object.hasOwn(q,'explain')),'Correct answers must not be sent before submission')
    const shuffled=randomQuiz(lesson.quiz),displayed=shuffled.map(()=>0)
    assert.equal(originalAnswers(shuffled,displayed).length,lesson.quiz.length)
  }
  for(const lesson of lessons){assert.equal(lesson.content.length,6);assert.equal(lesson.quiz.length,4)}
  for(const lesson of lessons.slice(6)){
    assert.equal(lesson.content.filter(s=>s.example&&s.task).length,5)
    assert.ok(lesson.image_url.startsWith('/images/topic-'))
    const correct=plainLessons.find(l=>l.id===lesson.id).quiz.map(q=>q.answer)
    const result=await (await call('/lessons/'+lesson.id+'/progress',{answers:correct})).json()
    assert.equal(result.score,100);assert.equal(result.completed,true);assert.equal(result.review.length,4)
  }
  const answers=curriculum[1].quiz.map(q=>q.answer)
  const wrong=curriculum[1].quiz.map(q=>(q.answer+1)%q.options.length)
  assert.equal((await call('/lessons/1/progress',{completed:true})).status,400)
  assert.equal((await (await call('/lessons/1/progress',{answers:wrong})).json()).completed,false)
  const below=[...wrong]; below[0]=answers[0]
  let progressResult=await (await call('/lessons/1/progress',{answers:below})).json();assert.equal(progressResult.score,25);assert.equal(progressResult.completed,false)
  const partial=[...answers]; partial[0]=wrong[0]; partial[1]=wrong[1]
  progressResult=await (await call('/lessons/1/progress',{answers:partial})).json();assert.equal(progressResult.score,50);assert.equal(progressResult.completed,true)
  progressResult=await (await call('/lessons/1/progress',{answers})).json();assert.equal(progressResult.score,100);assert.equal(progressResult.completed,true);assert.equal(progressResult.review.length,4)
  await call('/lessons/1/progress',{answers:wrong})
  lessons=await (await call('/lessons')).json()
  assert.equal(lessons[0].completed,1,'A failed retry must not erase completion')
  assert.equal(lessons[0].last_score,0)
  assert.equal(lessons[0].attempts,5)
  assert.equal((await call('/lessons/9999/progress',{answers})).status,404)
  const adminToken=token
  assert.equal((await call('/admin/users',{name:'Weak Password',username:'weak-password',email:'weak@example.test',password:'password'})).status,400)
  assert.equal((await call('/admin/users',{name:'Dashboard Test',username:'dashboard-test',email:'dashboard@example.test',password:'Test-Password-9!'})).status,200)
  await call('/admin/users',{name:'Never Logged In',username:'no-login',email:'no-login@example.test',password:'Test-Password-9!'})
  await call('/lessons/1/view',{})
  let report=await (await call('/admin/analytics')).json()
  assert.equal(report.summary.registered,2)
  assert.equal(report.summary.accessed,0)
  assert.equal(report.summary.viewed,0,'Admin previews are excluded')
  token=(await (await call('/auth/login',{identifier:'dashboard-test',password:'Test-Password-9!'})).json()).token
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
  const oldStudent=(await (await call('/auth/login',{identifier:'dashboard-test',password:'Test-Password-9!'})).json()).token
  assert.equal((await call('/admin/users/'+learner.id+'/password',{password:'New-Test-Password-9!'})).status,200)
  assert.equal((await call('/auth/login',{identifier:'dashboard-test',password:'Test-Password-9!'})).status,401)
  token=oldStudent
  assert.equal((await call('/lessons')).status,401)
  const newStudent=(await (await call('/auth/login',{identifier:'dashboard-test',password:'New-Test-Password-9!'})).json()).token
  token=newStudent
  assert.equal((await call('/lessons')).status,200)
  const profileUpdate=await fetch('http://127.0.0.1:'+port+'/api/auth/profile',{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({name:'Dashboard Updated',username:'dashboard-updated',email:'dashboard-updated@example.test'})})
  assert.equal(profileUpdate.status,200)
  const updatedProfile=(await profileUpdate.json()).user
  assert.equal(updatedProfile.name,'Dashboard Updated')
  assert.equal(updatedProfile.username,'dashboard-updated')
  assert.equal((await call('/auth/login',{identifier:'dashboard-test',password:'New-Test-Password-9!'})).status,401)
  assert.equal((await call('/auth/login',{identifier:'dashboard-updated',password:'New-Test-Password-9!'})).status,200)
  const duplicateProfile=await fetch('http://127.0.0.1:'+port+'/api/auth/profile',{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({name:'Dashboard Updated',username:'Galsan',email:'dashboard-updated@example.test'})})
  assert.equal(duplicateProfile.status,409)
  assert.equal((await call('/admin/news',{title:'Unauthorized'})).status,403)
  token=adminToken
  const metadata={title:'Оны төлөвлөгөө',body:'Хэрэгжүүлэх ажлын төлөвлөгөө',author:'Мэргэжилтэн',category:'Гараар бичсэн шинэ ангилал',external_url:'https://example.com/plan'}
  const audit=await (await call('/admin/audit-logs')).json()
  assert.ok(audit.some(a=>a.target.endsWith('/password')))
  assert.ok(audit.every(a=>a.actor_name==='Galsan'))
  assert.ok(!JSON.stringify(audit).includes('New-Test-Password-9!'))
  assert.equal((await call('/admin/news',{...metadata,external_url:'javascript:alert(1)'})).status,400)
  assert.equal((await call('/admin/news',{...metadata,file:{name:'bad.pdf',base64:Buffer.from('not a pdf').toString('base64')}})).status,400)
  const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF')
  const created=await call('/admin/news',{...metadata,file:{name:'Төлөвлөгөө.pdf',base64:pdf.toString('base64')}})
  assert.equal(created.status,201)
  const newsId=(await created.json()).id
  token=newStudent
  const news=await (await call('/news')).json()
  assert.equal(news[0].title,metadata.title)
  assert.equal(news[0].filename,'Төлөвлөгөө.pdf')
  assert.equal(news[0].category,metadata.category)
  assert.equal(news[0].external_url,metadata.external_url)
  assert.equal(news[0].mime_type,'application/pdf')
  const inline=await call('/news/'+newsId+'/file')
  assert.equal(inline.headers.get('content-disposition').startsWith('inline;'),true)
  assert.deepEqual(Buffer.from(await inline.arrayBuffer()),pdf)
  const download=await call('/news/'+newsId+'/pdf')
  assert.equal(download.headers.get('content-type'),'application/pdf')
  assert.deepEqual(Buffer.from(await download.arrayBuffer()),pdf)
  token=null
  assert.equal((await call('/news/'+newsId+'/pdf')).status,401)
  token=adminToken
  const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.from('test-image')])
  const imageCreated=await call('/admin/news',{...metadata,title:'Зурагтай мэдээ',file:{name:'зураг.png',base64:png.toString('base64')}})
  assert.equal(imageCreated.status,201)
  const imageId=(await imageCreated.json()).id
  const imageInline=await call('/news/'+imageId+'/file')
  assert.equal(imageInline.headers.get('content-type'),'image/png')
  assert.deepEqual(Buffer.from(await imageInline.arrayBuffer()),png)
  await fetch('http://127.0.0.1:'+port+'/api/admin/news/'+imageId,{method:'DELETE',headers:{Authorization:'Bearer '+token}})
  const changed=await fetch('http://127.0.0.1:'+port+'/api/admin/news/'+newsId,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({...metadata,title:'Зассан гарчиг'})})
  assert.equal(changed.status,200)
  assert.equal((await (await call('/news')).json())[0].filename,'Төлөвлөгөө.pdf')
  const deleted=await fetch('http://127.0.0.1:'+port+'/api/admin/news/'+newsId,{method:'DELETE',headers:{Authorization:'Bearer '+token}})
  assert.equal(deleted.status,200)
  assert.equal((await call('/news/'+newsId+'/pdf')).status,404)
  console.log('PASS: password reset, protected PDF/image preview and download, free category, link, news edit/delete')
  token=null
  assert.equal((await call('/auth/password',{currentPassword:'New-Test-Password-9!',password:'Self-Changed-Password-9!',confirmation:'Self-Changed-Password-9!'})).status,401)
  token=newStudent
  const change={currentPassword:'New-Test-Password-9!',password:'Self-Changed-Password-9!',confirmation:'Self-Changed-Password-9!'}
  assert.equal((await call('/auth/password',{...change,currentPassword:'wrong-password'})).status,400)
  assert.equal((await call('/auth/password',{...change,confirmation:'mismatch-password'})).status,400)
  assert.equal((await call('/auth/password',{...change,password:'short',confirmation:'short'})).status,400)
  assert.equal((await call('/auth/password',{...change,password:'a'.repeat(73),confirmation:'a'.repeat(73)})).status,400)
  assert.equal((await call('/auth/password',{...change,password:'New-Test-Password-9!',confirmation:'New-Test-Password-9!'})).status,400)
  assert.equal((await call('/lessons')).status,200,'Invalid changes must not invalidate sessions')
  // A supplied target id cannot change someone else's password.
  assert.equal((await call('/auth/password',{...change,id:1,user_id:1})).status,200)
  assert.equal((await call('/lessons')).status,401)
  assert.equal((await call('/auth/login',{identifier:'dashboard-updated',password:'New-Test-Password-9!'})).status,401)
  const selfLogin=await call('/auth/login',{identifier:'dashboard-updated',password:'Self-Changed-Password-9!'})
  assert.equal(selfLogin.status,200)
  token=(await selfLogin.json()).token
  assert.equal((await call('/lessons')).status,200)
  token=adminToken
  assert.equal((await call('/admin/analytics')).status,200,'Other users remain signed in')
  assert.equal((await call('/auth/login',{identifier:'Galsan',password:'Galsan0423'})).status,200)
  const dataImage='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect width="16" height="9" fill="#2563eb"/></svg>').toString('base64')
  const authoredLesson={
    title:'Админы гараар үүсгэсэн сургалт',
    objectives:['Эх сурвалжийг шалгаж сурах'],
    summary:['Холбоос шалгах','Нууц үг хамгаалах','Сэжигтэй хүсэлтийг мэдээлэх'],
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
  token=(await (await call('/auth/login',{identifier:'dashboard-updated',password:'Self-Changed-Password-9!'})).json()).token
  const studentLessons=await (await call('/lessons')).json()
  const authored=studentLessons.find((lesson)=>lesson.id===authoredId)
  assert.equal(authored.title,'Зассан сургалт')
  assert.deepEqual(authored.objectives,authoredLesson.objectives)
  assert.deepEqual(authored.summary,authoredLesson.summary)
  assert.equal((await call('/admin/audit-logs')).status,403)
  assert.equal(authored.content[0].title,'Зассан онол')
  assert.equal(authored.cases[0].explanation,'Зассан тайлбар хадгалагдсан.')
  assert.equal(authored.image_url,dataImage)
  progressResult=await (await call('/lessons/'+authoredId+'/progress',{answers:[1]})).json();assert.equal(progressResult.score,100);assert.equal(progressResult.completed,true)
  token=adminToken
  console.log('PASS: admin lesson authoring, full content update, validation, student delivery and scoring')
  console.log('PASS: self-service password verification, validation, user isolation, session revocation and re-login')
  console.log('PASS: expanded theory, 0/25/50/100% scores, attempt count, latest score, persistent completion')
  console.log('PASS: security headers, forged token rejection, SQL injection resistance, login throttling, password policy and quiz-answer secrecy')
} finally {
  server.kill()
  await new Promise(resolve=>server.exitCode!==null?resolve():server.once('exit',resolve))
  rmSync(directory,{recursive:true,force:true})
}
