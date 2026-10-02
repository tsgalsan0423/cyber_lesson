import bcrypt from 'bcryptjs'
import {canResetPassword,filterProgressUsers} from '../server/org-scope.js'
import {STATIC_ASSETS} from './.generated-assets.js'

const jsonHeaders={'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
const securityHeaders={
  'x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'no-referrer',
  'permissions-policy':'camera=(), microphone=(), geolocation=()',
  'content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self'; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
}
const enc=new TextEncoder(),dec=new TextDecoder()
const loginAttempts=new Map(),LOCK_MS=15*60*1000,LOGIN_LIMIT=5
const decodedAssets=new Map()

const response=(body,status=200,headers={})=>new Response(body,{status,headers:{...securityHeaders,...headers}})
const json=(body,status=200,headers={})=>response(JSON.stringify(body),status,{...jsonHeaders,...headers})
const clean=value=>String(value??'').trim()
const parseJson=(value,fallback)=>{try{return JSON.parse(value||'')}catch{return fallback}}
const fromBase64=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0))
const assetMime=path=>path.endsWith('.html')?'text/html; charset=utf-8':path.endsWith('.js')?'text/javascript; charset=utf-8':path.endsWith('.css')?'text/css; charset=utf-8':path.endsWith('.svg')?'image/svg+xml':path.endsWith('.png')?'image/png':path.endsWith('.jpg')||path.endsWith('.jpeg')?'image/jpeg':path.endsWith('.webp')?'image/webp':path.endsWith('.mp4')?'video/mp4':'application/octet-stream'
function staticAsset(request){
  const url=new URL(request.url),key=STATIC_ASSETS[url.pathname]?url.pathname:'/index.html',encoded=STATIC_ASSETS[key]
  if(!encoded)return json({message:'Файл олдсонгүй.'},404)
  let bytes=decodedAssets.get(key);if(!bytes){bytes=fromBase64(encoded);decodedAssets.set(key,bytes)}
  const headers={'content-type':assetMime(key),'cache-control':key==='/index.html'?'no-cache':'public, max-age=31536000, immutable','accept-ranges':'bytes',...securityHeaders}
  const range=request.headers.get('range')?.match(/^bytes=(\d*)-(\d*)$/)
  if(range){const start=range[1]?Number(range[1]):0,end=range[2]?Math.min(Number(range[2]),bytes.length-1):bytes.length-1;if(start> end||start>=bytes.length)return response(null,416,{'content-range':`bytes */${bytes.length}`});headers['content-range']=`bytes ${start}-${end}/${bytes.length}`;headers['content-length']=String(end-start+1);return response(bytes.slice(start,end+1),206,headers)}
  headers['content-length']=String(bytes.length);return response(request.method==='HEAD'?null:bytes,200,headers)
}
const toBase64Url=value=>{
  const bytes=value instanceof Uint8Array?value:enc.encode(value)
  let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000))
  return btoa(binary).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')
}
const fromBase64Url=value=>{
  const input=value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'=')
  return fromBase64(input)
}
const timingSafeEqual=(a,b)=>{
  const x=enc.encode(String(a||'')),y=enc.encode(String(b||''));let diff=x.length^y.length
  for(let i=0;i<Math.max(x.length,y.length);i++)diff|=(x[i%x.length]||0)^(y[i%y.length]||0)
  return diff===0
}

async function jwtKey(secret){return crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])}
async function signToken(user,secret){
  const header=toBase64Url(JSON.stringify({alg:'HS256',typ:'JWT'}))
  const payload=toBase64Url(JSON.stringify({id:user.id,session_version:Number(user.session_version)||0,iss:'securelab',aud:'securelab-web',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+28800}))
  const signature=await crypto.subtle.sign('HMAC',await jwtKey(secret),enc.encode(`${header}.${payload}`))
  return `${header}.${payload}.${toBase64Url(new Uint8Array(signature))}`
}
async function verifyToken(token,secret){
  const [header,payload,signature]=String(token||'').split('.')
  if(!header||!payload||!signature)throw new Error('bad token')
  const ok=await crypto.subtle.verify('HMAC',await jwtKey(secret),fromBase64Url(signature),enc.encode(`${header}.${payload}`))
  if(!ok)throw new Error('bad signature')
  const claims=JSON.parse(dec.decode(fromBase64Url(payload)))
  if(claims.iss!=='securelab'||claims.aud!=='securelab-web'||claims.exp<=Date.now()/1000)throw new Error('expired')
  return claims
}

const schema=`
CREATE TABLE IF NOT EXISTS system_meta (key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP,username TEXT,role TEXT NOT NULL DEFAULT 'student',session_version INTEGER NOT NULL DEFAULT 0,surname TEXT,department TEXT,position TEXT,phone TEXT,must_change_password INTEGER NOT NULL DEFAULT 0);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users(username) WHERE username IS NOT NULL;
CREATE TABLE IF NOT EXISTS lessons (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,description TEXT NOT NULL,duration TEXT NOT NULL,level TEXT NOT NULL,category TEXT NOT NULL,video_url TEXT NOT NULL DEFAULT '',accent TEXT NOT NULL,content_json TEXT NOT NULL DEFAULT '[]',quiz_json TEXT NOT NULL DEFAULT '[]',image_url TEXT,cases_json TEXT,objectives_json TEXT,summary_json TEXT);
CREATE TABLE IF NOT EXISTS progress (user_id INTEGER NOT NULL,lesson_id INTEGER NOT NULL,completed INTEGER DEFAULT 0,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(user_id,lesson_id));
CREATE TABLE IF NOT EXISTS exam_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,lesson_id INTEGER NOT NULL,score INTEGER NOT NULL,passed INTEGER NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS login_events (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS login_events_user ON login_events(user_id,created_at);
CREATE TABLE IF NOT EXISTS lesson_views (user_id INTEGER NOT NULL,lesson_id INTEGER NOT NULL,first_viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,last_viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,opens INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(user_id,lesson_id));
CREATE TABLE IF NOT EXISTS analytics_metadata (started_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT,actor_id INTEGER NOT NULL,actor_name TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS news (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,body TEXT NOT NULL,author TEXT NOT NULL,category TEXT NOT NULL,filename TEXT,pdf BLOB,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,mime_type TEXT,external_url TEXT,news_type TEXT NOT NULL DEFAULT 'organization',source_name TEXT,ai_generated INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT,type TEXT NOT NULL,title TEXT NOT NULL,message TEXT NOT NULL,target_url TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS notification_reads (notification_id INTEGER NOT NULL,user_id INTEGER NOT NULL,read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(notification_id,user_id));
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
`
let schemaPromise
const ensureSchema=env=>schemaPromise||(schemaPromise=(async()=>{
  await env.DB.exec(schema)
  const columns=(await env.DB.prepare('PRAGMA table_info(news)').all()).results||[]
  if(!columns.some(column=>column.name==='news_type'))await env.DB.exec("ALTER TABLE news ADD COLUMN news_type TEXT NOT NULL DEFAULT 'organization'")
  if(!columns.some(column=>column.name==='source_name'))await env.DB.exec('ALTER TABLE news ADD COLUMN source_name TEXT')
  if(!columns.some(column=>column.name==='ai_generated'))await env.DB.exec('ALTER TABLE news ADD COLUMN ai_generated INTEGER NOT NULL DEFAULT 0')
})())
const all=async(env,sql,values=[])=>(await env.DB.prepare(sql).bind(...values).all()).results||[]
const get=async(env,sql,values=[])=>await env.DB.prepare(sql).bind(...values).first()
const run=async(env,sql,values=[])=>{
  const result=await env.DB.prepare(sql).bind(...values).run()
  return{changes:Number(result.meta?.changes)||0,lastInsertRowid:Number(result.meta?.last_row_id)||0}
}
const bodyJson=async request=>{
  const size=Number(request.headers.get('content-length')||0)
  if(size>12*1024*1024)throw Object.assign(new Error('Файл хэт том байна.'),{status:413})
  try{return await request.json()}catch{throw Object.assign(new Error('Хүсэлтийн мэдээлэл буруу байна.'),{status:400})}
}

async function currentUser(request,env){
  const token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'')
  if(!token)throw Object.assign(new Error('Нэвтрэх шаардлагатай.'),{status:401})
  let claims
  try{claims=await verifyToken(token,env.JWT_SECRET)}catch{throw Object.assign(new Error('Нэвтрэх хугацаа дууссан.'),{status:401})}
  const user=await get(env,'SELECT id,name,username,email,role,session_version,surname,department,position,phone,must_change_password FROM users WHERE id=?',[claims.id])
  if(!user)throw Object.assign(new Error('Хэрэглэгч олдсонгүй.'),{status:401})
  if((Number(claims.session_version)||0)!==(Number(user.session_version)||0))throw Object.assign(new Error('Нууц үг шинэчлэгдсэн. Дахин нэвтэрнэ үү.'),{status:401})
  return user
}
const requireAdmin=user=>{if(user.role!=='admin')throw Object.assign(new Error('Админ эрх шаардлагатай.'),{status:403})}
const safeUser=user=>({id:user.id,name:user.name,email:user.email,username:user.username,role:user.role,session_version:Number(user.session_version)||0,surname:user.surname||'',department:user.department||'',position:user.position||'',phone:user.phone||'',must_change_password:!!user.must_change_password})
const passwordError=password=>{
  if(typeof password!=='string'||enc.encode(password).length>72||password.length<12)return 'Нууц үг 12–72 тэмдэгт байна.'
  if(!/[a-z]/.test(password)||!/[A-Z]/.test(password)||!/[0-9]/.test(password)||!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?`~]/.test(password))return 'Нууц үг том, жижиг үсэг, тоо, тусгай тэмдэгт агуулна.'
  return ''
}
const learningList=value=>(Array.isArray(value)?value:[]).map(x=>clean(x).slice(0,1500)).filter(Boolean).slice(0,10)
const legacyCases=content=>(Array.isArray(content)?content:[]).filter(step=>step?.example).map(step=>({title:step.title,text:step.example,explanation:step.text,task:step.task||'',icon:step.icon||'shield'}))
function lessonPayload(row){
  const content=parseJson(row.content_json,[]),quiz=parseJson(row.quiz_json,[]),explicit=row.cases_json?parseJson(row.cases_json,[]):null
  const objectives=learningList(parseJson(row.objectives_json,[])),summary=learningList(parseJson(row.summary_json,[]))
  return{...row,objectives:objectives.length?objectives:content.slice(0,3).map(s=>`${s.title} — эрсдэлийг таньж, хамгаалах аргыг хэрэглэх.`),summary:summary.length?summary:quiz.slice(0,5).map(q=>q.explain).filter(Boolean),content,cases:Array.isArray(explicit)?explicit:legacyCases(content),quiz}
}
function normalizeLessonInput(body){
  const trimmed=(value,limit)=>clean(value).slice(0,limit)
  const lesson={title:trimmed(body.title,160),description:trimmed(body.description,600),duration:trimmed(body.duration,80),level:['Анхан','Дунд','Хүнд'].includes(body.level)?body.level:trimmed(body.level,80),category:trimmed(body.category,120),accent:/^#[0-9a-f]{6}$/i.test(body.accent||'')?body.accent:'#2563eb',image_url:clean(body.image_url)}
  if(![lesson.title,lesson.description,lesson.duration,lesson.level,lesson.category].every(Boolean))throw new Error('Хичээлийн үндсэн мэдээллийг бүрэн бөглөнө үү.')
  if(lesson.image_url&&!lesson.image_url.startsWith('/images/topic-')&&!/^https?:\/\//i.test(lesson.image_url)&&!/^data:image\/(png|jpe?g|webp|svg\+xml);base64,/i.test(lesson.image_url))throw new Error('Зураг буруу байна.')
  if(lesson.image_url.length>2500000)throw new Error('Зураг хэт том байна.')
  lesson.content=Array.isArray(body.content)?body.content.map(x=>({title:trimmed(x.title,160),text:trimmed(x.text,7000),task:trimmed(x.task,1000),icon:trimmed(x.icon,30)||'shield'})):[]
  lesson.cases=Array.isArray(body.cases)?body.cases.map(x=>({title:trimmed(x.title,160),text:trimmed(x.text,5000),explanation:trimmed(x.explanation,5000),task:trimmed(x.task,1000),icon:trimmed(x.icon,30)||'search'})):[]
  lesson.quiz=Array.isArray(body.quiz)?body.quiz.map(q=>({question:trimmed(q.question,700),options:(Array.isArray(q.options)?q.options:[]).map(x=>trimmed(x,500)).filter(Boolean),answer:Number(q.answer),explain:trimmed(q.explain,1200)})):[]
  if(!lesson.content.length||lesson.content.some(x=>!x.title||!x.text))throw new Error('Онол хэсгийг бүрэн бөглөнө үү.')
  if(!lesson.cases.length||lesson.cases.some(x=>!x.title||!x.text||!x.explanation))throw new Error('Дадлага ажлыг бүрэн бөглөнө үү.')
  if(!lesson.quiz.length||lesson.quiz.some(q=>!q.question||q.options.length<2||!Number.isInteger(q.answer)||q.answer<0||q.answer>=q.options.length||!q.explain))throw new Error('Шалгалтын мэдээллийг бүрэн бөглөнө үү.')
  lesson.objectives=learningList(body.objectives);lesson.summary=learningList(body.summary)
  return lesson
}
async function notification(env,type,title,message,targetUrl){await run(env,'INSERT INTO notifications(type,title,message,target_url) VALUES(?,?,?,?)',[type,title.slice(0,160),message.slice(0,500),targetUrl])}

const newsOutputSchema={type:'object',additionalProperties:false,properties:{items:{type:'array',items:{type:'object',additionalProperties:false,properties:{title:{type:'string'},summary:{type:'string'},source:{type:'string'},url:{type:'string'},date:{type:'string'}},required:['title','summary','source','url','date']}}},required:['items']}
const extractResponseText=data=>(data.output||[]).flatMap(item=>item.content||[]).find(item=>item.type==='output_text')?.text||''
async function refreshInternationalNews(env,{force=false}={}){
  if(!env.OPENAI_API_KEY)return{configured:false,added:0,message:'AI мэдээний OPENAI_API_KEY тохируулаагүй байна.'}
  const now=Math.floor(Date.now()/1000),last=Number((await get(env,"SELECT value FROM system_meta WHERE key='international_news_last_sync'")||{}).value)||0
  if(!force&&now-last<6*60*60)return{configured:true,skipped:true,added:0,message:'Гадаад мэдээг сүүлийн 6 цагт шинэчилсэн байна.',last_synced_at:new Date(last*1000).toISOString()}
  const lockToken=`${now}:${crypto.randomUUID()}`
  await run(env,"INSERT INTO system_meta(key,value) VALUES('international_news_sync_lock',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(substr(system_meta.value,1,10) AS INTEGER)<?",[lockToken,now-900])
  const lock=String((await get(env,"SELECT value FROM system_meta WHERE key='international_news_sync_lock'")||{}).value||'')
  if(lock!==lockToken)return{configured:true,skipped:true,added:0,message:'Мэдээ шинэчлэх ажил аль хэдийн эхэлсэн байна.'}
  try{
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${env.OPENAI_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({model:env.OPENAI_NEWS_MODEL||'gpt-5-mini',store:false,tools:[{type:'web_search'}],text:{format:{type:'json_schema',name:'international_cyber_news',strict:true,schema:newsOutputSchema}},instructions:'Та олон улсын кибер аюулгүй байдлын мэдээг Монгол хэлээр редакторлодог. Нээлттэй вэб хайлтаар сүүлийн 7 хоногт дэлхийн хэмжээнд нийтлэгдсэн, бодит эх сурвалжтай 5 хүртэлх чухал мэдээ ол. Албан байгууллага, үндэсний CERT, судалгааны төв эсвэл танигдсан хэвлэл мэдээллийн шууд нийтлэлийг сонго. Хайсан мэдээлэл хуучирсан, давхардсан, эсвэл эх сурвалж тодорхой биш бол бүү оруул. Гарчгийг Монгол хэлээр товч орчуул; summary-д 2-3 өгүүлбэрээр баримтыг өөрийн үгээр хураангуйл. Зөвхөн эх сурвалжаар батлагдсан зүйл бич, зөвлөгөө эсвэл таамаг нэмж болохгүй. url нь тухайн нийтлэлийн HTTPS хаяг байна. Огноог ISO 8601 хэлбэрээр өг; тогтоох боломжгүй бол хоосон тэмдэгт өг.',input:'Хамгийн сүүлийн үеийн олон улсын кибер аюулгүй байдлын мэдээг хайж, Монгол хэл дээрх гарчиг ба хураангуйг буцаа. Нэг сэдвийг давтан бүү оруул.'})})
    if(!response.ok){const detail=await response.json().catch(()=>({}));throw Object.assign(new Error(detail.error?.message||'AI мэдээ хайх хүсэлт амжилтгүй.'),{status:502})}
    const data=await response.json(),text=extractResponseText(data);let parsed
    try{parsed=JSON.parse(text)}catch{throw Object.assign(new Error('AI мэдээний хариу уншигдахгүй байна.'),{status:502})}
    const citations=new Set((data.output||[]).flatMap(item=>item.content||[]).flatMap(content=>content.annotations||[]).filter(item=>item.type==='url_citation').map(item=>item.url).filter(Boolean))
    let added=0
    for(const item of (parsed.items||[]).slice(0,5)){
      const title=clean(item.title).slice(0,200),body=clean(item.summary).slice(0,3000),source=clean(item.source).slice(0,160),externalUrl=clean(item.url),date=Date.parse(item.date)
      if(!title||!body||!source||!externalUrl.startsWith('https://')||!citations.has(externalUrl)||!Number.isFinite(date))continue
      if(date<Date.now()-7*86400000||date>Date.now()+86400000)continue
      if(await get(env,"SELECT id FROM news WHERE news_type='international' AND external_url=?",[externalUrl]))continue
      await run(env,"INSERT INTO news(title,body,author,category,external_url,news_type,source_name,ai_generated) VALUES(?,?,?,'Кибер аюулгүй байдал',?,'international',?,1)",[title,body,source,externalUrl,source]);added++
    }
    await run(env,"INSERT INTO system_meta(key,value) VALUES('international_news_last_sync',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",[String(now)])
    await run(env,"UPDATE system_meta SET value='0' WHERE key='international_news_sync_lock' AND value=?",[lockToken])
    if(added)await notification(env,'news_new',`${added} шинэ гадаад мэдээ нэмэгдлээ`,'Олон улсын кибер аюулгүй байдлын мэдээг AI-аар хураангуйлж орууллаа.','#news')
    return{configured:true,added,last_synced_at:new Date(now*1000).toISOString()}
  }catch(error){await run(env,"UPDATE system_meta SET value='0' WHERE key='international_news_sync_lock' AND value=?",[lockToken]);throw error}
}
async function audit(env,user,action,target){await run(env,'INSERT INTO audit_logs(actor_id,actor_name,action,target) VALUES(?,?,?,?)',[user.id,user.username||user.name||String(user.id),action,target])}

async function bootstrap(request,env){
  if(!env.BOOTSTRAP_SECRET||!timingSafeEqual(request.headers.get('x-bootstrap-secret'),env.BOOTSTRAP_SECRET))return json({message:'Зөвшөөрөлгүй.'},403)
  if(await get(env,"SELECT value FROM system_meta WHERE key='bootstrap_complete'"))return json({message:'Өгөгдөл аль хэдийн шилжсэн.'},409)
  const payload=await bodyJson(request),tables=payload.tables||{}
  const definitions={
    users:['id','name','email','password_hash','created_at','username','role','session_version','surname','department','position','phone','must_change_password'],
    lessons:['id','title','description','duration','level','category','video_url','accent','content_json','quiz_json','image_url','cases_json','objectives_json','summary_json'],
    progress:['user_id','lesson_id','completed','updated_at'],exam_attempts:['id','user_id','lesson_id','score','passed','created_at'],
    login_events:['id','user_id','created_at'],lesson_views:['user_id','lesson_id','first_viewed_at','last_viewed_at','opens'],analytics_metadata:['started_at'],
    audit_logs:['id','actor_id','actor_name','action','target','created_at'],news:['id','title','body','author','category','filename','pdf','created_at','updated_at','mime_type','external_url'],
    notifications:['id','type','title','message','target_url','created_at'],notification_reads:['notification_id','user_id','read_at']
  }
  for(const [table,columns] of Object.entries(definitions)){
    const rows=Array.isArray(tables[table])?tables[table]:[]
    for(let offset=0;offset<rows.length;offset+=40){
      const statements=rows.slice(offset,offset+40).map(row=>{
        const values=columns.map(column=>column==='pdf'&&row[column]?fromBase64(row[column]):row[column]??null)
        return env.DB.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`).bind(...values)
      })
      if(statements.length)await env.DB.batch(statements)
    }
  }
  if(!(tables.analytics_metadata||[]).length)await run(env,'INSERT INTO analytics_metadata(started_at) VALUES(CURRENT_TIMESTAMP)')
  await run(env,"INSERT INTO system_meta(key,value) VALUES('bootstrap_complete',CURRENT_TIMESTAMP)")
  return json({ok:true,counts:Object.fromEntries(Object.keys(definitions).map(key=>[key,(tables[key]||[]).length]))})
}

async function progressReports(env){
  const users=await all(env,'SELECT id,name,surname,username,email,department,position,role FROM users ORDER BY name,id')
  const lessons=await all(env,'SELECT id,title FROM lessons ORDER BY id'),views=await all(env,'SELECT * FROM lesson_views'),attempts=await all(env,'SELECT id,user_id,lesson_id,score,passed,created_at FROM exam_attempts ORDER BY id DESC'),completions=await all(env,'SELECT user_id,lesson_id FROM progress WHERE completed=1')
  const key=(u,l)=>u+':'+l,viewMap=new Map(views.map(v=>[key(v.user_id,v.lesson_id),v])),attemptMap=new Map(),completed=new Set(completions.map(p=>key(p.user_id,p.lesson_id)))
  for(const attempt of attempts){const k=key(attempt.user_id,attempt.lesson_id);if(!attemptMap.has(k))attemptMap.set(k,[]);attemptMap.get(k).push(attempt)}
  const reports=users.map(user=>{
    const courses=lessons.map(lesson=>{const k=key(user.id,lesson.id),view=viewMap.get(k),history=attemptMap.get(k)||[];return{id:lesson.id,title:lesson.title,opened:!!view,opens:Number(view?.opens)||0,last_viewed:view?.last_viewed_at||null,attempts:history.length,last_score:history[0]?.score??null,best_score:history.length?Math.max(...history.map(a=>a.score)):null,last_exam:history[0]?.created_at||null,completed:completed.has(k),history}})
    const scores=courses.filter(c=>c.last_score!==null).map(c=>Number(c.last_score));return{...user,courses,viewed:courses.filter(c=>c.opened).length,tested:scores.length,completed:courses.filter(c=>c.completed).length,average:scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):null}
  })
  return{reports,lessons,attempts}
}

async function handleApi(request,env,ctx){
  await ensureSchema(env)
  const url=new URL(request.url),path=url.pathname,method=request.method
  if(method==='POST'&&path==='/api/internal/bootstrap')return bootstrap(request,env)
  if(method==='GET'&&path==='/api/health')return json({ok:true,database:!!await get(env,"SELECT value FROM system_meta WHERE key='bootstrap_complete'")})
  if(method==='POST'&&path==='/api/auth/register')return json({message:'Нийтийн бүртгэл хаалттай. Хэрэглэгчийг админ үүсгэнэ.'},403)
  if(method==='POST'&&path==='/api/auth/login'){
    const body=await bodyJson(request),identifier=clean(body.identifier||body.email).slice(0,160),password=typeof body.password==='string'&&enc.encode(body.password).length<=72?body.password:''
    const ip=request.headers.get('cf-connecting-ip')||'unknown',key=`${ip}|${identifier.toLowerCase()}`,record=loginAttempts.get(key)
    if(record?.lockedUntil>Date.now())return json({message:'Олон удаа буруу оролдсон байна. 15 минутын дараа дахин оролдоно уу.'},429,{'retry-after':'900'})
    const user=await get(env,'SELECT * FROM users WHERE lower(email)=lower(?) OR lower(username)=lower(?)',[identifier,identifier])
    const valid=user?await bcrypt.compare(password,user.password_hash):false
    if(!user||!valid){const failures=(record?.failures||0)+1;loginAttempts.set(key,{failures,lockedUntil:failures>=LOGIN_LIMIT?Date.now()+LOCK_MS:0});return json({message:'Нэвтрэх нэр эсвэл нууц үг буруу байна.'},failures>=LOGIN_LIMIT?429:401)}
    loginAttempts.delete(key);await run(env,'INSERT INTO login_events(user_id) VALUES(?)',[user.id])
    return json({user:safeUser(user),token:await signToken(user,env.JWT_SECRET)})
  }
  const user=await currentUser(request,env)
  const idMatch=pattern=>path.match(pattern)

  if(method==='POST'&&path==='/api/auth/password'){
    const body=await bodyJson(request),error=passwordError(body.password);if(error)return json({message:error},400)
    if(body.password!==body.confirmation)return json({message:'Шинэ нууц үг давтан оруулсантай таарахгүй байна.'},400)
    const account=await get(env,'SELECT password_hash FROM users WHERE id=?',[user.id])
    if(!await bcrypt.compare(body.currentPassword||'',account.password_hash))return json({message:'Одоогийн нууц үг буруу байна.'},400)
    if(await bcrypt.compare(body.password,account.password_hash))return json({message:'Шинэ нууц үг өмнөхөөсөө өөр байх ёстой.'},400)
    await run(env,'UPDATE users SET password_hash=?,must_change_password=0,session_version=session_version+1 WHERE id=?',[await bcrypt.hash(body.password,12),user.id]);return json({ok:true})
  }
  if(method==='PATCH'&&path==='/api/auth/profile'){
    const body=await bodyJson(request),name=clean(body.name),surname=clean(body.surname),email=clean(body.email).toLowerCase()
    if(!name||name.length>120||surname.length>120||email.length>160||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({message:'Нэр болон зөв и-мэйл хаяг оруулна уу.'},400)
    if(await get(env,'SELECT id FROM users WHERE id<>? AND (lower(username)=lower(?) OR lower(email)=lower(?))',[user.id,email,email]))return json({message:'И-мэйл өөр хэрэглэгч дээр бүртгэлтэй байна.'},409)
    await run(env,'UPDATE users SET name=?,surname=?,username=?,email=? WHERE id=?',[name,surname,email,email,user.id]);return json({user:await get(env,'SELECT id,name,email,username,role,session_version,surname,department,position,phone,must_change_password FROM users WHERE id=?',[user.id])})
  }
  if(method==='GET'&&path==='/api/lessons'){
    const rows=await all(env,`SELECT l.*,COALESCE(p.completed,0) completed,(SELECT score FROM exam_attempts WHERE user_id=? AND lesson_id=l.id ORDER BY id DESC LIMIT 1) last_score,(SELECT count(*) FROM exam_attempts WHERE user_id=? AND lesson_id=l.id) attempts FROM lessons l LEFT JOIN progress p ON p.lesson_id=l.id AND p.user_id=? ORDER BY l.id`,[user.id,user.id,user.id])
    return json(rows.map(row=>{const lesson=lessonPayload(row),{quiz_json,content_json,cases_json,objectives_json,summary_json,...safe}=lesson;return{...safe,quiz:lesson.quiz.map(({question,options})=>({question,options}))}}))
  }
  let match=idMatch(/^\/api\/lessons\/(\d+)\/view$/)
  if(method==='POST'&&match){if(!await get(env,'SELECT id FROM lessons WHERE id=?',[match[1]]))return json({message:'Хичээл олдсонгүй.'},404);if(user.role!=='admin')await run(env,`INSERT INTO lesson_views(user_id,lesson_id) VALUES(?,?) ON CONFLICT(user_id,lesson_id) DO UPDATE SET last_viewed_at=CURRENT_TIMESTAMP,opens=lesson_views.opens+1`,[user.id,match[1]]);return json({ok:true})}
  match=idMatch(/^\/api\/lessons\/(\d+)\/progress$/)
  if(method==='POST'&&match){const lesson=await get(env,'SELECT quiz_json FROM lessons WHERE id=?',[match[1]]);if(!lesson)return json({message:'Хичээл олдсонгүй.'},404);const quiz=parseJson(lesson.quiz_json,[]),answers=(await bodyJson(request)).answers;if(!quiz.length||!Array.isArray(answers)||answers.length!==quiz.length||answers.some((a,i)=>!Number.isInteger(a)||a<0||a>=quiz[i].options.length))return json({message:'Бүх асуултад хариулна уу.'},400);const score=Math.round(quiz.filter((q,i)=>q.answer===answers[i]).length/quiz.length*100),completed=score>=50;await run(env,'INSERT INTO exam_attempts(user_id,lesson_id,score,passed) VALUES(?,?,?,?)',[user.id,match[1],score,completed?1:0]);if(completed)await run(env,`INSERT INTO progress(user_id,lesson_id,completed) VALUES(?,?,1) ON CONFLICT(user_id,lesson_id) DO UPDATE SET completed=1,updated_at=CURRENT_TIMESTAMP`,[user.id,match[1]]);return json({score,completed,review:quiz.map(q=>({answer:q.answer,explain:q.explain}))})}

  if(method==='GET'&&path==='/api/notifications'){return json(await all(env,`SELECT n.id,n.type,n.title,n.message,n.target_url,n.created_at,CASE WHEN r.notification_id IS NULL THEN 0 ELSE 1 END is_read FROM notifications n LEFT JOIN notification_reads r ON r.notification_id=n.id AND r.user_id=? WHERE n.created_at>=(SELECT created_at FROM users WHERE id=?) ORDER BY n.id DESC LIMIT 30`,[user.id,user.id]))}
  match=idMatch(/^\/api\/notifications\/(\d+)\/read$/)
  if(method==='POST'&&match){if(!await get(env,'SELECT id FROM notifications WHERE id=?',[match[1]]))return json({message:'Мэдэгдэл олдсонгүй.'},404);await run(env,'INSERT INTO notification_reads(notification_id,user_id) VALUES(?,?) ON CONFLICT(notification_id,user_id) DO NOTHING',[match[1],user.id]);return json({ok:true})}
  if(method==='POST'&&path==='/api/notifications/read-all'){const items=await all(env,'SELECT id FROM notifications WHERE created_at>=(SELECT created_at FROM users WHERE id=?)',[user.id]);if(items.length)await env.DB.batch(items.map(item=>env.DB.prepare('INSERT INTO notification_reads(notification_id,user_id) VALUES(?,?) ON CONFLICT(notification_id,user_id) DO NOTHING').bind(item.id,user.id)));return json({ok:true})}
  if(method==='GET'&&path==='/api/news'){
    if(env.OPENAI_API_KEY&&user.role!=='admin'){const refresh=refreshInternationalNews(env).catch(error=>console.error('international news refresh failed',error.message));if(ctx?.waitUntil)ctx.waitUntil(refresh)}
    return json(await all(env,'SELECT id,title,body,author,category,filename,mime_type,external_url,news_type,source_name,ai_generated,length(pdf) size,created_at,updated_at FROM news ORDER BY id DESC'))
  }
  match=idMatch(/^\/api\/news\/(\d+)\/(file|pdf)$/)
  if(method==='GET'&&match){const item=await get(env,'SELECT filename,mime_type,pdf FROM news WHERE id=?',[match[1]]);if(!item?.pdf)return json({message:'Файл олдсонгүй.'},404);const download=match[2]==='pdf'||url.searchParams.get('download')==='1';return response(item.pdf,200,{'content-type':item.mime_type||'application/pdf','cache-control':'private, no-store','content-disposition':`${download?'attachment':'inline'}; filename*=UTF-8''${encodeURIComponent(item.filename||'file')}`})}
  if(method==='GET'&&path==='/api/progress-scope'){const data=await progressReports(env),filtered=filterProgressUsers(data.reports,user);return json({scope:filtered.scope,lesson_count:data.lessons.length,users:filtered.users.map(item=>({...item,can_reset_password:canResetPassword(user,item)}))})}
  match=idMatch(/^\/api\/managed-users\/(\d+)\/password$/)
  if(method==='POST'&&match){const body=await bodyJson(request),error=passwordError(body.password);if(error)return json({message:error},400);const target=await get(env,'SELECT id,name,username,email,role,department,position FROM users WHERE id=?',[match[1]]);if(!target)return json({message:'Хэрэглэгч олдсонгүй.'},404);if(!canResetPassword(user,target))return json({message:'Энэ хэрэглэгчийн нууц үгийг шинэчлэх эрхгүй байна.'},403);await run(env,'UPDATE users SET password_hash=?,must_change_password=1,session_version=session_version+1 WHERE id=?',[await bcrypt.hash(body.password,12),target.id]);await audit(env,user,'POST',`/api/managed-users/${target.id}/password`);return json({ok:true})}

  requireAdmin(user)
  if(method==='GET'&&path==='/api/admin/news/status'){
    const last=Number((await get(env,"SELECT value FROM system_meta WHERE key='international_news_last_sync'")||{}).value)||0
    return json({configured:!!env.OPENAI_API_KEY,last_synced_at:last?new Date(last*1000).toISOString():null,model:env.OPENAI_NEWS_MODEL||'gpt-5-mini'})
  }
  if(method==='POST'&&path==='/api/admin/news/refresh-international'){
    try{const result=await refreshInternationalNews(env);return json(result,result.configured?200:503)}
    catch(error){return json({message:error.message||'Гадаад мэдээ шинэчлэхэд алдаа гарлаа.'},error.status||502)}
  }
  if(method==='GET'&&path==='/api/admin/overview'){const users=await all(env,'SELECT id,name,username,email,role,created_at,surname,department,position,phone,must_change_password FROM users ORDER BY created_at DESC'),lessons=await all(env,'SELECT * FROM lessons ORDER BY id');return json({stats:{users:Number((await get(env,"SELECT count(*) count FROM users WHERE role='student'")).count),lessons:Number((await get(env,'SELECT count(*) count FROM lessons')).count),completions:Number((await get(env,'SELECT count(*) count FROM progress WHERE completed=1')).count)},users,lessons:lessons.map(lessonPayload)})}
  if(method==='GET'&&path==='/api/admin/audit-logs')return json(await all(env,'SELECT * FROM audit_logs ORDER BY id DESC LIMIT 200'))
  match=idMatch(/^\/api\/admin\/users\/(\d+)\/details$/)
  if(method==='GET'&&match){const account=await get(env,'SELECT id,name,surname,username,email,role,created_at,department,position,phone FROM users WHERE id=?',[match[1]]);if(!account)return json({message:'Хэрэглэгч олдсонгүй.'},404);const login=await get(env,'SELECT max(created_at) last_login,count(*) login_count FROM login_events WHERE user_id=?',[account.id]),lastLesson=await get(env,'SELECT l.title,v.last_viewed_at FROM lesson_views v JOIN lessons l ON l.id=v.lesson_id WHERE v.user_id=? ORDER BY v.last_viewed_at DESC LIMIT 1',[account.id]),courses=await all(env,`SELECT l.id,l.title,COALESCE((SELECT opens FROM lesson_views WHERE user_id=? AND lesson_id=l.id),0) opens,(SELECT last_viewed_at FROM lesson_views WHERE user_id=? AND lesson_id=l.id) last_viewed_at,(SELECT count(*) FROM exam_attempts WHERE user_id=? AND lesson_id=l.id) attempts,(SELECT score FROM exam_attempts WHERE user_id=? AND lesson_id=l.id ORDER BY id DESC LIMIT 1) last_score,(SELECT max(score) FROM exam_attempts WHERE user_id=? AND lesson_id=l.id) best_score,(SELECT count(*) FROM progress WHERE user_id=? AND lesson_id=l.id AND completed=1) completed FROM lessons l ORDER BY l.id`,Array(6).fill(account.id));const normalized=courses.map(c=>({...c,opens:Number(c.opens)||0,attempts:Number(c.attempts)||0,completed:Number(c.completed)>0})),scores=normalized.filter(c=>c.last_score!==null).map(c=>Number(c.last_score));return json({user:account,last_login:login?.last_login||null,login_count:Number(login?.login_count)||0,last_lesson:lastLesson||null,summary:{viewed:normalized.filter(c=>c.opens>0).length,tested:normalized.filter(c=>c.attempts>0).length,completed:normalized.filter(c=>c.completed).length,average:scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):null},courses:normalized})}
  match=idMatch(/^\/api\/admin\/users\/(\d+)\/password$/)
  if(method==='POST'&&match){const body=await bodyJson(request),error=passwordError(body.password);if(error)return json({message:error},400);if(!(await run(env,'UPDATE users SET password_hash=?,must_change_password=1,session_version=session_version+1 WHERE id=?',[await bcrypt.hash(body.password,12),match[1]])).changes)return json({message:'Хэрэглэгч олдсонгүй.'},404);await audit(env,user,'POST',path);return json({ok:true})}
  match=idMatch(/^\/api\/admin\/users\/(\d+)\/role$/)
  if(method==='PATCH'&&match){if(Number(match[1])===Number(user.id))return json({message:'Өөрийн админ эрхийг өөрчлөх боломжгүй.'},400);const body=await bodyJson(request);await run(env,'UPDATE users SET role=? WHERE id=?',[body.role==='admin'?'admin':'student',match[1]]);await audit(env,user,'PATCH',path);return json({ok:true})}
  match=idMatch(/^\/api\/admin\/users\/(\d+)\/reset-progress$/)
  if(method==='POST'&&match){await env.DB.batch(['DELETE FROM lesson_views WHERE user_id=?','DELETE FROM exam_attempts WHERE user_id=?','DELETE FROM progress WHERE user_id=?'].map(sql=>env.DB.prepare(sql).bind(match[1])));await audit(env,user,'POST',path);return json({ok:true})}
  match=idMatch(/^\/api\/admin\/users\/(\d+)$/)
  if(method==='DELETE'&&match){if(Number(match[1])===Number(user.id))return json({message:'Өөрийн бүртгэлийг устгах боломжгүй.'},400);await env.DB.batch(['DELETE FROM login_events WHERE user_id=?','DELETE FROM lesson_views WHERE user_id=?','DELETE FROM exam_attempts WHERE user_id=?','DELETE FROM progress WHERE user_id=?','DELETE FROM notification_reads WHERE user_id=?','DELETE FROM users WHERE id=?'].map(sql=>env.DB.prepare(sql).bind(match[1])));await audit(env,user,'DELETE',path);return json({ok:true})}
  if(method==='POST'&&path==='/api/admin/users'){const body=await bodyJson(request),email=clean(body.email).toLowerCase(),error=passwordError(body.password);if(!clean(body.name)||!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||error)return json({message:error||'Нэр болон зөв и-мэйл хаяг оруулна уу.'},400);if(await get(env,'SELECT id FROM users WHERE lower(username)=lower(?) OR lower(email)=lower(?)',[email,email]))return json({message:'Username эсвэл и-мэйл бүртгэлтэй байна.'},409);const result=await run(env,'INSERT INTO users(name,surname,department,position,phone,username,email,password_hash,role,must_change_password) VALUES(?,?,?,?,?,?,?,?,?,1)',[clean(body.name),clean(body.surname),clean(body.department),clean(body.position),clean(body.phone),email,email,await bcrypt.hash(body.password,12),body.role==='admin'?'admin':'student']);await audit(env,user,'POST',`${path}/${result.lastInsertRowid}`);return json({id:result.lastInsertRowid})}
  if(method==='POST'&&path==='/api/admin/lessons'){try{const lesson=normalizeLessonInput(await bodyJson(request)),result=await run(env,"INSERT INTO lessons(title,description,duration,level,category,video_url,accent,content_json,cases_json,quiz_json,image_url,objectives_json,summary_json) VALUES(?,?,?,?,?,'',?,?,?,?,?,?,?)",[lesson.title,lesson.description,lesson.duration,lesson.level,lesson.category,lesson.accent,JSON.stringify(lesson.content),JSON.stringify(lesson.cases),JSON.stringify(lesson.quiz),lesson.image_url,JSON.stringify(lesson.objectives),JSON.stringify(lesson.summary)]);await notification(env,'lesson_new','Шинэ хичээл нэмэгдлээ',lesson.title,'#lessons');await audit(env,user,'POST',`${path}/${result.lastInsertRowid}`);return json({id:result.lastInsertRowid})}catch(error){return json({message:error.message},400)}}
  match=idMatch(/^\/api\/admin\/lessons\/(\d+)$/)
  if(method==='PUT'&&match){try{const lesson=normalizeLessonInput(await bodyJson(request)),result=await run(env,'UPDATE lessons SET title=?,description=?,duration=?,level=?,category=?,accent=?,image_url=?,content_json=?,cases_json=?,quiz_json=?,objectives_json=?,summary_json=? WHERE id=?',[lesson.title,lesson.description,lesson.duration,lesson.level,lesson.category,lesson.accent,lesson.image_url,JSON.stringify(lesson.content),JSON.stringify(lesson.cases),JSON.stringify(lesson.quiz),JSON.stringify(lesson.objectives),JSON.stringify(lesson.summary),match[1]]);if(!result.changes)return json({message:'Хичээл олдсонгүй.'},404);await notification(env,'lesson_updated','Хичээл шинэчлэгдлээ',lesson.title,'#lessons');await audit(env,user,'PUT',path);return json({ok:true})}catch(error){return json({message:error.message},400)}}
  if(method==='DELETE'&&match){const lesson=await get(env,'SELECT title FROM lessons WHERE id=?',[match[1]]);await env.DB.batch(['DELETE FROM exam_attempts WHERE lesson_id=?','DELETE FROM lesson_views WHERE lesson_id=?','DELETE FROM progress WHERE lesson_id=?','DELETE FROM lessons WHERE id=?'].map(sql=>env.DB.prepare(sql).bind(match[1])));if(lesson)await notification(env,'lesson_deleted','Хичээл хасагдлаа',lesson.title,'#lessons');await audit(env,user,'DELETE',path);return json({ok:true})}
  const newsMatch=idMatch(/^\/api\/admin\/news(?:\/(\d+))?$/)
  if((method==='POST'||method==='PUT')&&newsMatch){const body=await bodyJson(request),existing=newsMatch[1]?await get(env,'SELECT * FROM news WHERE id=?',[newsMatch[1]]):null;if(newsMatch[1]&&!existing)return json({message:'Мэдээ олдсонгүй.'},404);if(![body.title,body.body,body.author,body.category].every(v=>typeof v==='string'&&v.trim()))return json({message:'Мэдээний мэдээллийг бүрэн бөглөнө үү.'},400);let pdf=body.removeFile?null:existing?.pdf||null,filename=body.removeFile?null:existing?.filename||null,mime=body.removeFile?null:existing?.mime_type||null;if(body.file){pdf=fromBase64(body.file.base64);filename=clean(body.file.name).replace(/[\r\n/\\]/g,'_').slice(0,180);mime=filename.toLowerCase().endsWith('.pdf')?'application/pdf':filename.toLowerCase().endsWith('.png')?'image/png':filename.toLowerCase().match(/\.jpe?g$/)?'image/jpeg':'image/webp';if(pdf.length>8*1024*1024)return json({message:'Файл 8 MB хүртэл байна.'},400)}const type=body.news_type==='international'?'international':'organization',sourceName=clean(body.source_name)||null,values=[clean(body.title),clean(body.body),clean(body.author),clean(body.category),filename,pdf,mime,clean(body.external_url)||null,type,sourceName];if(existing){await run(env,'UPDATE news SET title=?,body=?,author=?,category=?,filename=?,pdf=?,mime_type=?,external_url=?,news_type=?,source_name=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[...values,existing.id]);await notification(env,'news_updated','Мэдээ шинэчлэгдлээ',values[0],'#news');await audit(env,user,'PUT',path);return json({ok:true})}const result=await run(env,'INSERT INTO news(title,body,author,category,filename,pdf,mime_type,external_url,news_type,source_name) VALUES(?,?,?,?,?,?,?,?,?,?)',values);await notification(env,'news_new','Шинэ мэдээ нийтлэгдлээ',values[0],'#news');await audit(env,user,'POST',`${path}/${result.lastInsertRowid}`);return json({id:result.lastInsertRowid},201)}
  if(method==='DELETE'&&newsMatch?.[1]){const item=await get(env,'SELECT title FROM news WHERE id=?',[newsMatch[1]]),result=await run(env,'DELETE FROM news WHERE id=?',[newsMatch[1]]);if(!result.changes)return json({message:'Мэдээ олдсонгүй.'},404);await notification(env,'news_deleted','Мэдээ хасагдлаа',item?.title||'','#news');await audit(env,user,'DELETE',path);return json({ok:true})}
  if(method==='GET'&&path==='/api/admin/analytics'){const data=await progressReports(env),loginRows=await all(env,'SELECT user_id,count(*) logins,max(created_at) last_login FROM login_events GROUP BY user_id'),loginMap=new Map(loginRows.map(x=>[x.user_id,x])),users=data.reports.map(item=>({...item,logins:Number(loginMap.get(item.id)?.logins)||0,last_login:loginMap.get(item.id)?.last_login||null})),students=users.filter(x=>x.role==='student'),studentIds=new Set(students.map(x=>x.id)),attempts=data.attempts.filter(x=>studentIds.has(x.user_id)),daily=[];for(let i=6;i>=0;i--){const day=new Date(Date.now()-i*86400000).toISOString().slice(0,10),ids=new Set((await all(env,"SELECT DISTINCT e.user_id FROM login_events e JOIN users u ON u.id=e.user_id WHERE u.role='student' AND date(e.created_at)=?",[day])).map(x=>x.user_id));daily.push({day,users:ids.size})}const active7=Number((await get(env,"SELECT count(DISTINCT e.user_id) n FROM login_events e JOIN users u ON u.id=e.user_id WHERE u.role='student' AND e.created_at>=datetime('now','-7 days')")).n);return json({started_at:(await get(env,'SELECT started_at FROM analytics_metadata LIMIT 1'))?.started_at||null,summary:{registered:students.length,accessed:students.filter(x=>x.logins>0).length,logins:students.reduce((n,x)=>n+x.logins,0),active7,viewed:students.reduce((n,x)=>n+x.viewed,0),tested:students.filter(x=>x.tested>0).length,attempts:attempts.length,pass_rate:attempts.length?Math.round(attempts.filter(x=>x.passed).length/attempts.length*100):null},daily,users,courses:data.lessons.map(lesson=>({...lesson,viewed:students.filter(x=>x.courses.find(c=>c.id===lesson.id)?.opened).length,tested:students.filter(x=>x.courses.find(c=>c.id===lesson.id)?.attempts>0).length,completed:students.filter(x=>x.courses.find(c=>c.id===lesson.id)?.completed).length}))})}
  return json({message:'API зам олдсонгүй.'},404)
}

export default{
  async fetch(request,env,ctx){
    try{
      const url=new URL(request.url)
      if(url.pathname.startsWith('/api/'))return await handleApi(request,env,ctx)
      if(request.method==='GET'||request.method==='HEAD')return staticAsset(request)
      return json({message:'Зам олдсонгүй.'},404)
    }catch(error){console.error(error);return json({message:error?.message||'Серверийн алдаа гарлаа.'},error?.status||500)}
  }
}
