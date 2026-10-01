import express from 'express'
import { installAnalytics } from './analytics.js'
import { installAudit } from './audit.js'
import { installPlainLanguage } from './plain-language-migration.js'
import { installNews } from './news.js'
import { createNotification,installNotifications } from './notifications.js'
import { curriculum } from './curriculum.js'
import { foundations } from './foundations.js'
import { additionalCourses } from './additional-courses.js'
import { createDatabase } from './db.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const db = createDatabase()
const app = express()
const PORT = process.env.PORT || 3001
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'
const PRODUCTION = process.env.NODE_ENV === 'production'
if(PRODUCTION&&(JWT_SECRET==='dev-secret-change-in-production'||Buffer.byteLength(JWT_SECRET)<32)) throw new Error('Production орчинд 32+ тэмдэгттэй JWT_SECRET тохируулна уу.')

app.disable('x-powered-by')
app.use((req,res,next)=>{
  res.set({
    'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer',
    'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self'; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
  })
  if(req.path.startsWith('/api/'))res.set('Cache-Control','no-store')
  if(req.secure)res.set('Strict-Transport-Security','max-age=31536000; includeSubDomains')
  next()
})

app.use(express.json({limit:'12mb'}))

if (db.dialect === 'postgres') {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      username TEXT,
      role TEXT NOT NULL DEFAULT 'student',
      session_version INTEGER NOT NULL DEFAULT 0
    );
    CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users(username) WHERE username IS NOT NULL;
    CREATE TABLE IF NOT EXISTS lessons (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      duration TEXT NOT NULL,
      level TEXT NOT NULL,
      category TEXT NOT NULL,
      video_url TEXT NOT NULL,
      accent TEXT NOT NULL,
      content_json TEXT NOT NULL DEFAULT '[]',
      quiz_json TEXT NOT NULL DEFAULT '[]',
      image_url TEXT,
      cases_json TEXT
    );
    CREATE TABLE IF NOT EXISTS progress (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      completed INTEGER DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, lesson_id)
    );
  `)
} else {
  await db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS lessons (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    duration TEXT NOT NULL,
    level TEXT NOT NULL,
    category TEXT NOT NULL,
    video_url TEXT NOT NULL,
    accent TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS progress (
    user_id INTEGER NOT NULL,
    lesson_id INTEGER NOT NULL,
    completed INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, lesson_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (lesson_id) REFERENCES lessons(id)
  );
`)
}

// Existing databases are upgraded without deleting user data.
if (db.dialect === 'sqlite') {
  const userColumns = (await db.all('PRAGMA table_info(users)')).map((column) => column.name)
  if (!userColumns.includes('username')) await db.exec('ALTER TABLE users ADD COLUMN username TEXT')
  if (!userColumns.includes('role')) await db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'student'")
  if (!userColumns.includes('session_version')) await db.exec('ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0')
  await db.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users(username) WHERE username IS NOT NULL')
  const lessonColumns = (await db.all('PRAGMA table_info(lessons)')).map((column) => column.name)
  if (!lessonColumns.includes('content_json')) await db.exec("ALTER TABLE lessons ADD COLUMN content_json TEXT NOT NULL DEFAULT '[]'")
  if (!lessonColumns.includes('quiz_json')) await db.exec("ALTER TABLE lessons ADD COLUMN quiz_json TEXT NOT NULL DEFAULT '[]'")
  if (!lessonColumns.includes('image_url')) await db.exec('ALTER TABLE lessons ADD COLUMN image_url TEXT')
  if (!lessonColumns.includes('cases_json')) await db.exec("ALTER TABLE lessons ADD COLUMN cases_json TEXT")
}

// Staff directory fields are kept on the user account for profile and reporting.
for (const [column, definition] of Object.entries({
  surname:'TEXT', department:'TEXT', position:'TEXT', phone:'TEXT', must_change_password:'INTEGER NOT NULL DEFAULT 0'
})) {
  if (db.dialect === 'postgres') await db.exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${column} ${definition}`)
  else if (!(await db.all('PRAGMA table_info(users)')).some(c=>c.name===column)) await db.exec(`ALTER TABLE users ADD COLUMN ${column} ${definition}`)
}

function parseJson(value, fallback) {
  try { return JSON.parse(value || '') } catch { return fallback }
}

for (const column of ['objectives_json','summary_json']) {
  if (db.dialect === 'postgres') await db.exec(`ALTER TABLE lessons ADD COLUMN IF NOT EXISTS ${column} TEXT`)
  else if (!(await db.all('PRAGMA table_info(lessons)')).some(c=>c.name===column)) await db.exec(`ALTER TABLE lessons ADD COLUMN ${column} TEXT`)
}
const learningList = value => (Array.isArray(value)?value:[]).map(x=>String(x).trim().slice(0,1500)).filter(Boolean).slice(0,10)

function legacyCases(content) {
  return (Array.isArray(content) ? content : [])
    .filter((step) => step?.example)
    .map((step) => ({
      title: step.title,
      text: step.example,
      explanation: step.text,
      task: step.task || '',
      icon: step.icon || 'shield'
    }))
}

function lessonPayload(row) {
  const content = parseJson(row.content_json, [])
  const quiz = parseJson(row.quiz_json, [])
  const explicitCases = row.cases_json ? parseJson(row.cases_json, []) : null
  const objectives = learningList(parseJson(row.objectives_json, []))
  const summary = learningList(parseJson(row.summary_json, []))
  return {...row, objectives:objectives.length?objectives:content.slice(0,3).map(s=>`${s.title} — эрсдэлийг таньж, хамгаалах аргыг хэрэглэх.`), summary:summary.length?summary:quiz.slice(0,5).map(q=>q.explain).filter(Boolean), content, cases: Array.isArray(explicitCases) ? explicitCases : legacyCases(content), quiz}
}

function trimmed(value, limit = 5000) {
  return String(value ?? '').trim().slice(0, limit)
}

function normalizeImageUrl(value) {
  const image = String(value ?? '').trim()
  if (!image) return ''
  if (image.startsWith('/images/topic-')) return image.slice(0, 240)
  if (/^https?:\/\/.{1,480}$/i.test(image)) return image
  if (/^data:image\/(png|jpe?g|webp|svg\+xml);base64,[a-z0-9+/=]+$/i.test(image) && image.length <= 2500000) return image
  throw new Error('Зураг буруу байна. JPG, PNG, WEBP, SVG төрлийн 1.8MB хүртэл зураг сонгоно уу.')
}

function normalizeLessonInput(body) {
  const title = trimmed(body.title, 160)
  const description = trimmed(body.description, 600)
  const duration = trimmed(body.duration, 80)
  const level = ['Анхан', 'Дунд', 'Ахисан'].includes(body.level) ? body.level : trimmed(body.level, 80)
  const category = trimmed(body.category, 120)
  const accent = /^#[0-9a-f]{6}$/i.test(body.accent || '') ? body.accent : '#2563eb'
  const image_url = normalizeImageUrl(body.image_url)
  if (![title, description, duration, level, category].every(Boolean)) throw new Error('Хичээлийн үндсэн мэдээллийг бүрэн бөглөнө үү.')

  const content = Array.isArray(body.content) ? body.content.map((step, index) => ({
    title: trimmed(step.title, 160),
    text: trimmed(step.text, 7000),
    task: trimmed(step.task, 1000),
    icon: trimmed(step.icon, 30) || 'shield'
  })) : []
  if (!content.length || content.some((step) => !step.title || !step.text)) throw new Error('Онол хэсэгт дор хаяж нэг гарчиг, агуулгатай блок оруулна уу.')

  const cases = Array.isArray(body.cases) ? body.cases.map((item) => ({
    title: trimmed(item.title, 160),
    text: trimmed(item.text, 5000),
    explanation: trimmed(item.explanation, 5000),
    task: trimmed(item.task, 1000),
    icon: trimmed(item.icon, 30) || 'search'
  })) : []
  if (!cases.length || cases.some((item) => !item.title || !item.text || !item.explanation)) throw new Error('Дадлага ажлын хэсэгт дор хаяж нэг нөхцөл, тайлбар оруулна уу.')

  const quiz = Array.isArray(body.quiz) ? body.quiz.map((question) => {
    const options = Array.isArray(question.options) ? question.options.map((option) => trimmed(option, 500)).filter(Boolean) : []
    const answer = Number(question.answer)
    return {
      question: trimmed(question.question, 700),
      options,
      answer,
      explain: trimmed(question.explain, 1200)
    }
  }) : []
  if (!quiz.length || quiz.some((question) => !question.question || question.options.length < 2 || !Number.isInteger(question.answer) || question.answer < 0 || question.answer >= question.options.length || !question.explain)) {
    throw new Error('Шалгалт хэсэгт асуулт, 2+ сонголт, зөв хариулт, тайлбар бүрэн байх ёстой.')
  }

  return { title, description, duration, level, category, accent, image_url, content, cases, quiz, objectives:learningList(body.objectives), summary:learningList(body.summary) }
}

const lessons = [
  [1, 'Фишинг халдлагыг таних нь', 'Хуурамч имэйл, холбоос болон яаралтай үйлдэл шаардах мессежийг хэрхэн таних вэ?', '08:24', 'Анхан', 'Сошиал инженерчлэл', 'https://www.youtube.com/embed/XBkzBrXlle0', '#8b5cf6'],
  [2, 'Хүчирхэг нууц үг ба MFA', 'Нууц үгийн зөв дадал, password manager болон олон шатлалт баталгаажуулалт.', '11:10', 'Анхан', 'Бүртгэл хамгаалалт', 'https://www.youtube.com/embed/3NjQ9b3pgIg', '#22d3a7'],
  [3, 'Нийтийн Wi-Fi-ийн эрсдэл', 'Нээлттэй сүлжээнд мэдээллээ алдахгүй байхад VPN ба HTTPS хэрхэн тусалдаг вэ?', '09:45', 'Дунд', 'Сүлжээний аюулгүй байдал', 'https://www.youtube.com/embed/Dk-ZqQ-bfy4', '#38bdf8'],
  [4, 'Ransomware-ээс сэргийлэх нь', 'Хорт програм хэрхэн тархдаг, backup яагаад хэрэгтэй, халдлагын үед юу хийх вэ?', '13:32', 'Дунд', 'Хортой програм', 'https://www.youtube.com/embed/8zO7bH9mQ5Y', '#fb7185'],
  [5, 'Өгөгдөл ба хувийн нууц', 'Хуваалцаж буй мэдээллээ хянаж, төхөөрөмжийн privacy тохиргоог зөв хийх нь.', '07:18', 'Анхан', 'Хувийн мэдээлэл', 'https://www.youtube.com/embed/aO858HyFbKI', '#fbbf24'],
  [6, 'Инцидент мэдээлэх алхам', 'Сэжигтэй үйлдэл илэрвэл баримтжуулах, тусгаарлах, мэдээлэх дараалал.', '10:06', 'Ахисан', 'Инцидент хариу', 'https://www.youtube.com/embed/P7f5BC7v32A', '#f97316']
]
for (const lesson of lessons) {
  if (db.dialect === 'postgres') await db.run('INSERT INTO lessons (id, title, description, duration, level, category, video_url, accent) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING', lesson)
  else await db.run('INSERT OR IGNORE INTO lessons (id, title, description, duration, level, category, video_url, accent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', lesson)
}
if (db.dialect === 'postgres') await db.exec("SELECT setval(pg_get_serial_sequence('lessons','id'), (SELECT COALESCE(MAX(id), 1) FROM lessons), true)")

await db.exec('CREATE TABLE IF NOT EXISTS curriculum_migrations (version TEXT PRIMARY KEY)')
if (!await db.get('SELECT version FROM curriculum_migrations WHERE version=?', ['theory-case-v2'])) {
  await db.transaction(async (tx) => {
    for (const [id, content] of Object.entries(curriculum)) {
      await tx.run('UPDATE lessons SET content_json=?, quiz_json=?, duration=?, video_url=? WHERE id=?', [JSON.stringify([{...foundations[id], icon:'book'}, ...content.steps]), JSON.stringify(content.quiz), '25–30 мин', '', id])
    }
    await tx.run('INSERT INTO curriculum_migrations VALUES (?)', ['theory-case-v2'])
  })
}
if (!await db.get('SELECT version FROM curriculum_migrations WHERE version=?', ['additional-topics-v1'])) {
  await db.transaction(async (tx)=>{
    for(const course of additionalCourses) await tx.run("INSERT INTO lessons (title,description,duration,level,category,video_url,accent,content_json,quiz_json,image_url) VALUES (?,?,?,'Анхан',?,'',?,?,?,?)", [course.title,course.description,'25–30 мин',course.category,course.accent,JSON.stringify(course.content),JSON.stringify(course.quiz),course.image])
    await tx.run('INSERT INTO curriculum_migrations VALUES (?)', ['additional-topics-v1'])
  })
  if (db.dialect === 'postgres') await db.exec("SELECT setval(pg_get_serial_sequence('lessons','id'), (SELECT COALESCE(MAX(id), 1) FROM lessons), true)")
}
await installPlainLanguage(db)
const existingAdmin = await db.get("SELECT id,password_hash FROM users WHERE lower(username) = lower('Galsan') OR lower(email) = lower('admin@securelab.mn')")
if (existingAdmin) {
  if(PRODUCTION&&await bcrypt.compare('Galsan0423',existingAdmin.password_hash))throw new Error('Production эхлүүлэхийн өмнө development админы нууц үгийг солино уу.')
} else {
  const initialAdminPassword=process.env.ADMIN_PASSWORD||(PRODUCTION?null:'Galsan0423')
  if(!initialAdminPassword)throw new Error('Анхны админ үүсгэхийн тулд ADMIN_PASSWORD тохируулна уу.')
  const adminPassword = bcrypt.hashSync(initialAdminPassword, 12)
  await db.run("INSERT INTO users (name, username, email, password_hash, role) VALUES ('Galsan', 'Galsan', 'admin@securelab.mn', ?, 'admin')", [adminPassword])
}

const passwordError=password=>{
  if(typeof password!=='string'||Buffer.byteLength(password)>72||password.length<12)return 'Нууц үг 12–72 тэмдэгт байна.'
  if(!/[a-z]/.test(password)||!/[A-Z]/.test(password)||!/[0-9]/.test(password)||!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?`~]/.test(password))return 'Нууц үг том, жижиг үсэг, тоо, тусгай тэмдэгт агуулна.'
  return ''
}
const loginAttempts=new Map(),ipLoginAttempts=new Map(),LOGIN_LIMIT=5,IP_LOGIN_LIMIT=30, LOCK_MS=15*60*1000
const loginKey=(req,identifier)=>`${req.ip}|${identifier.toLowerCase().slice(0,160)}`
const dummyPasswordHash=bcrypt.hashSync('Dummy-Password-Only-9!',12)
const pruneLoginAttempts=()=>{
  const expiry=Date.now()-LOCK_MS
  for(const store of [loginAttempts,ipLoginAttempts]){
    for(const [key,value] of store)if((value.updatedAt||0)<expiry&&(!value.lockedUntil||value.lockedUntil<Date.now()))store.delete(key)
    while(store.size>10000)store.delete(store.keys().next().value)
  }
}

async function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ message: 'Нэвтрэх шаардлагатай.' })
  try {
    const claims=jwt.verify(token, JWT_SECRET,{algorithms:['HS256'],issuer:'securelab',audience:'securelab-web'})
    req.user=await db.get('SELECT id,name,username,email,role,session_version,surname,department,position,phone,must_change_password FROM users WHERE id=?', [claims.id])
    if(!req.user) return res.status(401).json({message:'Хэрэглэгч олдсонгүй.'})
    if((claims.session_version||0)!==req.user.session_version) return res.status(401).json({message:'Нууц үг шинэчлэгдсэн. Дахин нэвтэрнэ үү.'})
    next()
  }
  catch { res.status(401).json({ message: 'Нэвтрэх хугацаа дууссан.' }) }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Админ эрх шаардлагатай.' })
  next()
}

app.post('/api/auth/register', (req, res) => {
  res.status(403).json({ message: 'Нийтийн бүртгэл хаалттай. Хэрэглэгчийг админ үүсгэнэ.' })
})

app.post('/api/auth/login', async (req, res) => {
  const body=req.body||{}
  const identifier = String(body.identifier||body.email||'').trim().slice(0,160)
  const password=typeof body.password==='string'&&Buffer.byteLength(body.password)<=72?body.password:''
  pruneLoginAttempts()
  const key=loginKey(req,identifier),ipKey=req.ip,record=loginAttempts.get(key),ipRecord=ipLoginAttempts.get(ipKey)
  const lockedUntil=Math.max(record?.lockedUntil||0,ipRecord?.lockedUntil||0)
  if(lockedUntil>Date.now()){
    const seconds=Math.ceil((lockedUntil-Date.now())/1000);res.set('Retry-After',String(seconds))
    return res.status(429).json({message:`Олон удаа буруу оролдсон байна. ${Math.ceil(seconds/60)} минутын дараа дахин оролдоно уу.`})
  }
  const user = await db.get('SELECT * FROM users WHERE lower(email) = lower(?) OR lower(username) = lower(?)', [identifier, identifier])
  const valid=await bcrypt.compare(password,user?.password_hash||dummyPasswordHash)
  if (!user || !valid){
    const now=Date.now(),failures=(record?.failures||0)+1,ipFailures=(ipRecord?.failures||0)+1
    const accountLock=failures>=LOGIN_LIMIT?now+LOCK_MS:0,ipLock=ipFailures>=IP_LOGIN_LIMIT?now+LOCK_MS:0
    loginAttempts.set(key,{failures,lockedUntil:accountLock,updatedAt:now});ipLoginAttempts.set(ipKey,{failures:ipFailures,lockedUntil:ipLock,updatedAt:now})
    if(accountLock||ipLock){res.set('Retry-After',String(LOCK_MS/1000));return res.status(429).json({message:'Олон удаа буруу оролдсон байна. 15 минутын дараа дахин оролдоно уу.'})}
    return res.status(401).json({ message: 'Нэвтрэх нэр эсвэл нууц үг буруу байна.' })
  }
  loginAttempts.delete(key);ipLoginAttempts.delete(ipKey)
  if(bcrypt.getRounds(user.password_hash)<12){user.password_hash=await bcrypt.hash(password,12);await db.run('UPDATE users SET password_hash=? WHERE id=?',[user.password_hash,user.id])}
  const safe = { id:user.id,name:user.name,email:user.email,username:user.username,role:user.role,session_version:user.session_version,
    surname:user.surname||'',department:user.department||'',position:user.position||'',phone:user.phone||'',must_change_password:!!user.must_change_password }
  await db.run('INSERT INTO login_events (user_id) VALUES (?)', [user.id])
  res.json({ user: safe, token: jwt.sign({id:user.id,session_version:user.session_version}, JWT_SECRET, {algorithm:'HS256',issuer:'securelab',audience:'securelab-web',expiresIn:'8h'}) })
})

if (db.dialect === 'postgres') {
  await db.exec(`CREATE TABLE IF NOT EXISTS exam_attempts (
    id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    score INTEGER NOT NULL, passed INTEGER NOT NULL, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`)
} else {
  await db.exec(`CREATE TABLE IF NOT EXISTS exam_attempts (
    id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, lesson_id INTEGER NOT NULL,
    score INTEGER NOT NULL, passed INTEGER NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`)
}
await installAudit(app, db, auth, adminOnly)
await installAnalytics(app, db, auth, adminOnly)
await installNotifications(app, db, auth)
await installNews(app, db, auth, adminOnly)
app.post('/api/auth/password',auth,async(req,res)=>{
  const {currentPassword,password,confirmation}=req.body||{}
  if(typeof currentPassword!=='string'||!currentPassword||Buffer.byteLength(currentPassword)>72)
    return res.status(400).json({message:'Одоогийн нууц үгээ зөв оруулна уу.'})
  const policyError=passwordError(password)
  if(policyError)return res.status(400).json({message:policyError})
  if(password!==confirmation) return res.status(400).json({message:'Шинэ нууц үг давтан оруулсантай таарахгүй байна.'})
  const account=await db.get('SELECT password_hash FROM users WHERE id=?', [req.user.id])
  if(!await bcrypt.compare(currentPassword,account.password_hash))
    return res.status(400).json({message:'Одоогийн нууц үг буруу байна.'})
  if(await bcrypt.compare(password,account.password_hash))
    return res.status(400).json({message:'Шинэ нууц үг өмнөхөөсөө өөр байх ёстой.'})
  await db.run('UPDATE users SET password_hash=?,must_change_password=0,session_version=session_version+1 WHERE id=?',
    [await bcrypt.hash(password,12),req.user.id])
  res.json({ok:true})
})

app.patch('/api/auth/profile',auth,async(req,res)=>{
  const name=String(req.body?.name||'').trim()
  const email=String(req.body?.email||'').trim().toLowerCase()
  const surname=String(req.body?.surname||'').trim()
  if(!name||!email||name.length>120||surname.length>120||email.length>160||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({message:'Нэр болон зөв и-мэйл хаяг оруулна уу.'})
  const duplicate=await db.get('SELECT id FROM users WHERE id<>? AND (lower(username)=lower(?) OR lower(email)=lower(?))', [req.user.id,email,email])
  if(duplicate) return res.status(409).json({message:'И-мэйл өөр хэрэглэгч дээр бүртгэлтэй байна.'})
  const result=await db.run('UPDATE users SET name=?,surname=?,username=?,email=? WHERE id=?', [name,surname,email,email,req.user.id])
  if(!result.changes) return res.status(404).json({message:'Хэрэглэгч олдсонгүй.'})
  const user=await db.get('SELECT id,name,email,username,role,session_version,surname,department,position,phone,must_change_password FROM users WHERE id=?', [req.user.id])
  res.json({user})
})

app.post('/api/admin/users/:id/password',auth,adminOnly,async(req,res)=>{
  const password=req.body?.password
  const policyError=passwordError(password)
  if(policyError)return res.status(400).json({message:policyError})
  const result=await db.run('UPDATE users SET password_hash=?,session_version=session_version+1 WHERE id=?', [await bcrypt.hash(password,12),req.params.id])
  if(!result.changes)return res.status(404).json({message:'Хэрэглэгч олдсонгүй.'})
  res.json({ok:true})
})
app.get('/api/lessons', auth, async (req, res) => {
  const rows = await db.all(`SELECT l.*, COALESCE(p.completed, 0) completed, (SELECT score FROM exam_attempts WHERE user_id=? AND lesson_id=l.id ORDER BY id DESC LIMIT 1) last_score, (SELECT count(*) FROM exam_attempts WHERE user_id=? AND lesson_id=l.id) attempts FROM lessons l LEFT JOIN progress p ON p.lesson_id=l.id AND p.user_id=? ORDER BY l.id`, [req.user.id, req.user.id, req.user.id])
  res.json(rows.map(row=>{const lesson=lessonPayload(row);const {quiz_json,content_json,cases_json,objectives_json,summary_json,...safe}=lesson;return {...safe,quiz:lesson.quiz.map(({question,options})=>({question,options}))}}))
})

app.post('/api/lessons/:id/progress', auth, async (req, res) => {
  const lesson = await db.get('SELECT quiz_json FROM lessons WHERE id=?', [req.params.id])
  if (!lesson) return res.status(404).json({ message: 'Хичээл олдсонгүй.' })
  const parsed = parseJson(lesson.quiz_json, [])
  const quiz = Array.isArray(parsed) ? parsed : [parsed]
  const answers = req.body?.answers
  if (!quiz.length || !Array.isArray(answers) || answers.length !== quiz.length || answers.some((a,i) => !Number.isInteger(a) || a < 0 || a >= quiz[i].options.length)) return res.status(400).json({message:'Бүх асуултад хариулна уу.'})
  const score = Math.round(quiz.filter((q,i)=>q.answer===answers[i]).length / quiz.length * 100)
  const completed = score >= 50
  await db.run('INSERT INTO exam_attempts (user_id, lesson_id, score, passed) VALUES (?, ?, ?, ?)', [req.user.id, req.params.id, score, completed ? 1 : 0])
  if (completed) await db.run(`INSERT INTO progress (user_id, lesson_id, completed) VALUES (?, ?, 1) ON CONFLICT(user_id, lesson_id) DO UPDATE SET completed=1, updated_at=CURRENT_TIMESTAMP`, [req.user.id, req.params.id])
  res.json({ score, completed, review:quiz.map(q=>({answer:q.answer,explain:q.explain})) })
})

app.get('/api/admin/overview', auth, adminOnly, async (req, res) => {
  const users = await db.all("SELECT id,name,username,email,role,created_at,surname,department,position,phone,must_change_password FROM users ORDER BY created_at DESC")
  const stats = {
    users: Number((await db.get("SELECT count(*) count FROM users WHERE role='student'")).count),
    lessons: Number((await db.get('SELECT count(*) count FROM lessons')).count),
    completions: Number((await db.get('SELECT count(*) count FROM progress WHERE completed=1')).count)
  }
  const lessons = await db.all('SELECT * FROM lessons ORDER BY id')
  res.json({ stats, users, lessons: lessons.map(lessonPayload) })
})

app.post('/api/admin/lessons', auth, adminOnly, async (req, res) => {
  try {
    const lesson = normalizeLessonInput(req.body || {})
    const result = await db.run("INSERT INTO lessons (title, description, duration, level, category, video_url, accent, content_json, cases_json, quiz_json, image_url) VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?) RETURNING id", [
      lesson.title, lesson.description, lesson.duration, lesson.level, lesson.category, lesson.accent, JSON.stringify(lesson.content), JSON.stringify(lesson.cases), JSON.stringify(lesson.quiz), lesson.image_url
    ])
    await db.run('UPDATE lessons SET objectives_json=?,summary_json=? WHERE id=?',[JSON.stringify(lesson.objectives),JSON.stringify(lesson.summary),Number(result.lastInsertRowid)])
    await createNotification(db,{type:'lesson_new',title:'Шинэ хичээл нэмэгдлээ',message:lesson.title,targetUrl:'#lessons'})
    res.json({ id: Number(result.lastInsertRowid) })
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

app.put('/api/admin/lessons/:id', auth, adminOnly, async (req, res) => {
  try {
    const lesson = normalizeLessonInput(req.body || {})
    const result = await db.run('UPDATE lessons SET title=?, description=?, duration=?, level=?, category=?, accent=?, image_url=?, content_json=?, cases_json=?, quiz_json=? WHERE id=?', [
      lesson.title, lesson.description, lesson.duration, lesson.level, lesson.category, lesson.accent, lesson.image_url, JSON.stringify(lesson.content), JSON.stringify(lesson.cases), JSON.stringify(lesson.quiz), req.params.id
    ])
    if (!result.changes) return res.status(404).json({ message: 'Хичээл олдсонгүй.' })
    await db.run('UPDATE lessons SET objectives_json=?,summary_json=? WHERE id=?',[JSON.stringify(lesson.objectives),JSON.stringify(lesson.summary),req.params.id])
    await createNotification(db,{type:'lesson_updated',title:'Хичээл шинэчлэгдлээ',message:lesson.title,targetUrl:'#lessons'})
    res.json({ ok: true })
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

app.delete('/api/admin/lessons/:id', auth, adminOnly, async (req, res) => {
  const lesson=await db.get('SELECT title FROM lessons WHERE id=?',[req.params.id])
  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM exam_attempts WHERE lesson_id=?', [req.params.id])
    await tx.run('DELETE FROM lesson_views WHERE lesson_id=?', [req.params.id])
    await tx.run('DELETE FROM progress WHERE lesson_id=?', [req.params.id])
    await tx.run('DELETE FROM lessons WHERE id=?', [req.params.id])
  })
  if(lesson)await createNotification(db,{type:'lesson_deleted',title:'Хичээл хасагдлаа',message:lesson.title,targetUrl:'#lessons'})
  res.json({ ok: true })
})

app.patch('/api/admin/users/:id/role', auth, adminOnly, async (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ message: 'Өөрийн админ эрхийг өөрчлөх боломжгүй.' })
  const role = req.body?.role === 'admin' ? 'admin' : 'student'
  await db.run('UPDATE users SET role=? WHERE id=?', [role, req.params.id])
  res.json({ ok:true })
})

app.delete('/api/admin/users/:id', auth, adminOnly, async (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ message: 'Өөрийн бүртгэлийг устгах боломжгүй.' })
  await db.transaction(async (tx) => { await tx.run('DELETE FROM login_events WHERE user_id=?', [req.params.id]); await tx.run('DELETE FROM lesson_views WHERE user_id=?', [req.params.id]); await tx.run('DELETE FROM exam_attempts WHERE user_id=?', [req.params.id]); await tx.run('DELETE FROM progress WHERE user_id=?', [req.params.id]); await tx.run('DELETE FROM users WHERE id=?', [req.params.id]) })
  res.json({ ok:true })
})

app.post('/api/admin/users', auth, adminOnly, async (req, res) => {
  const { name, surname='', department='', position='', phone='', email, password, role = 'student' } = req.body||{}
  const username=String(email||'').trim().toLowerCase()
  const policyError=passwordError(password)
  if (!name?.trim() || !email?.trim() || name.trim().length>120||email.trim().length>160||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())||policyError)
    return res.status(400).json({ message: policyError||'Нэр болон зөв и-мэйл хаяг оруулна уу.' })
  try {
    if(await db.get('SELECT id FROM users WHERE lower(username)=lower(?) OR lower(email)=lower(?)',[username.trim(),email.trim()]))return res.status(409).json({message:'Username эсвэл и-мэйл бүртгэлтэй байна.'})
    const result = await db.run('INSERT INTO users (name,surname,department,position,phone,username,email,password_hash,role) VALUES (?,?,?,?,?,?,?,?,?) RETURNING id', [
      name.trim(),String(surname).trim(),String(department).trim(),String(position).trim(),String(phone).trim(),username,username,await bcrypt.hash(password,12),role==='admin'?'admin':'student'
    ])
    res.json({ id:Number(result.lastInsertRowid) })
  } catch {
    res.status(409).json({ message: 'Username эсвэл и-мэйл бүртгэлтэй байна.' })
  }
})

app.post('/api/admin/users/:id/reset-progress', auth, adminOnly, async (req, res) => {
  await db.run('DELETE FROM lesson_views WHERE user_id=?', [req.params.id])
  await db.run('DELETE FROM exam_attempts WHERE user_id=?', [req.params.id]); await db.run('DELETE FROM progress WHERE user_id=?', [req.params.id])
  res.json({ ok:true })
})

app.use((error,req,res,next)=>{
  if(error.type==='entity.too.large')return res.status(413).json({message:'Файл хэт том байна. 8 MB хүртэл PDF эсвэл зураг сонгоно уу.'})
  if(error.type==='entity.parse.failed')return res.status(400).json({message:'Хүсэлтийн мэдээлэл буруу байна.'})
  console.error(error)
  res.status(500).json({message:'Серверийн алдаа гарлаа. Дахин оролдоно уу.'})
})
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')))
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(__dirname, '../dist/index.html'))
  })
}

app.listen(PORT, () => console.log(`SecureLab API: http://localhost:${PORT}`))
