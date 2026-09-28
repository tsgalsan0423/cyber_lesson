import express from 'express'
import { installAnalytics } from './analytics.js'
import { installNews } from './news.js'
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

function parseJson(value, fallback) {
  try { return JSON.parse(value || '') } catch { return fallback }
}

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
  return {...row, content, cases: Array.isArray(explicitCases) ? explicitCases : legacyCases(content), quiz}
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

  return { title, description, duration, level, category, accent, image_url, content, cases, quiz }
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
const adminPassword = bcrypt.hashSync('Galsan0423', 10)
const existingAdmin = await db.get("SELECT id FROM users WHERE username = 'Galsan' OR email = 'admin@securelab.mn'")
if (existingAdmin) {
  // Preserve changed credentials across server restarts.
} else {
  await db.run("INSERT INTO users (name, username, email, password_hash, role) VALUES ('Galsan', 'Galsan', 'admin@securelab.mn', ?, 'admin')", [adminPassword])
}

async function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ message: 'Нэвтрэх шаардлагатай.' })
  try {
    const claims=jwt.verify(token, JWT_SECRET)
    req.user=await db.get('SELECT id,role,session_version FROM users WHERE id=?', [claims.id])
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
  const identifier = req.body.identifier?.trim() || req.body.email?.trim() || ''
  const user = await db.get('SELECT * FROM users WHERE lower(email) = lower(?) OR lower(username) = lower(?)', [identifier, identifier])
  if (!user || !bcrypt.compareSync(req.body.password || '', user.password_hash)) return res.status(401).json({ message: 'Нэвтрэх нэр эсвэл нууц үг буруу байна.' })
  const safe = { id: user.id, name: user.name, email: user.email, username: user.username, role: user.role, session_version:user.session_version }
  await db.run('INSERT INTO login_events (user_id) VALUES (?)', [user.id])
  res.json({ user: safe, token: jwt.sign(safe, JWT_SECRET, { expiresIn: '7d' }) })
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
await installAnalytics(app, db, auth, adminOnly)
await installNews(app, db, auth, adminOnly)
app.post('/api/auth/password',auth,async(req,res)=>{
  const {currentPassword,password,confirmation}=req.body||{}
  if(typeof currentPassword!=='string'||!currentPassword||Buffer.byteLength(currentPassword)>72)
    return res.status(400).json({message:'Одоогийн нууц үгээ зөв оруулна уу.'})
  if(typeof password!=='string'||password.length<8||Buffer.byteLength(password)>72)
    return res.status(400).json({message:'Шинэ нууц үг 8-аас доошгүй тэмдэгт, 72 байтаас ихгүй байна.'})
  if(password!==confirmation) return res.status(400).json({message:'Шинэ нууц үг давтан оруулсантай таарахгүй байна.'})
  const account=await db.get('SELECT password_hash FROM users WHERE id=?', [req.user.id])
  if(!bcrypt.compareSync(currentPassword,account.password_hash))
    return res.status(400).json({message:'Одоогийн нууц үг буруу байна.'})
  if(bcrypt.compareSync(password,account.password_hash))
    return res.status(400).json({message:'Шинэ нууц үг өмнөхөөсөө өөр байх ёстой.'})
  await db.run('UPDATE users SET password_hash=?,session_version=session_version+1 WHERE id=?',
    [bcrypt.hashSync(password,10),req.user.id])
  res.json({ok:true})
})
app.post('/api/admin/users/:id/password',auth,adminOnly,async(req,res)=>{
  const password=req.body.password
  if(typeof password!=='string'||password.length<8||Buffer.byteLength(password)>72) return res.status(400).json({message:'Нууц үг 8-аас доошгүй тэмдэгт, 72 байтаас ихгүй байна.'})
  const result=await db.run('UPDATE users SET password_hash=?,session_version=session_version+1 WHERE id=?', [bcrypt.hashSync(password,10),req.params.id])
  if(!result.changes)return res.status(404).json({message:'Хэрэглэгч олдсонгүй.'})
  res.json({ok:true})
})
app.get('/api/lessons', auth, async (req, res) => {
  const rows = await db.all(`SELECT l.*, COALESCE(p.completed, 0) completed, (SELECT score FROM exam_attempts WHERE user_id=? AND lesson_id=l.id ORDER BY id DESC LIMIT 1) last_score, (SELECT count(*) FROM exam_attempts WHERE user_id=? AND lesson_id=l.id) attempts FROM lessons l LEFT JOIN progress p ON p.lesson_id=l.id AND p.user_id=? ORDER BY l.id`, [req.user.id, req.user.id, req.user.id])
  res.json(rows.map(lessonPayload))
})

app.post('/api/lessons/:id/progress', auth, async (req, res) => {
  const lesson = await db.get('SELECT quiz_json FROM lessons WHERE id=?', [req.params.id])
  if (!lesson) return res.status(404).json({ message: 'Хичээл олдсонгүй.' })
  const parsed = parseJson(lesson.quiz_json, [])
  const quiz = Array.isArray(parsed) ? parsed : [parsed]
  const answers = req.body.answers
  if (!quiz.length || !Array.isArray(answers) || answers.length !== quiz.length || answers.some((a,i) => !Number.isInteger(a) || a < 0 || a >= quiz[i].options.length)) return res.status(400).json({message:'Бүх асуултад хариулна уу.'})
  const score = Math.round(quiz.filter((q,i)=>q.answer===answers[i]).length / quiz.length * 100)
  const completed = score >= 50
  await db.run('INSERT INTO exam_attempts (user_id, lesson_id, score, passed) VALUES (?, ?, ?, ?)', [req.user.id, req.params.id, score, completed ? 1 : 0])
  if (completed) await db.run(`INSERT INTO progress (user_id, lesson_id, completed) VALUES (?, ?, 1) ON CONFLICT(user_id, lesson_id) DO UPDATE SET completed=1, updated_at=CURRENT_TIMESTAMP`, [req.user.id, req.params.id])
  res.json({ score, completed })
})

app.get('/api/admin/overview', auth, adminOnly, async (req, res) => {
  const users = await db.all("SELECT id, name, username, email, role, created_at FROM users ORDER BY created_at DESC")
  const stats = {
    users: Number((await db.get("SELECT count(*) count FROM users WHERE role='student'")).count),
    lessons: Number((await db.get('SELECT count(*) count FROM lessons')).count),
    completions: Number((await db.get('SELECT count(*) count FROM progress WHERE completed=1')).count)
  }
  const lessons = await db.all('SELECT * FROM lessons ORDER BY id')
  res.json({ stats, users, lessons: lessons.map((lesson) => ({...lesson, cases_json: lesson.cases_json || JSON.stringify(legacyCases(parseJson(lesson.content_json, [])))})) })
})

app.post('/api/admin/lessons', auth, adminOnly, async (req, res) => {
  try {
    const lesson = normalizeLessonInput(req.body || {})
    const result = await db.run("INSERT INTO lessons (title, description, duration, level, category, video_url, accent, content_json, cases_json, quiz_json, image_url) VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?) RETURNING id", [
      lesson.title, lesson.description, lesson.duration, lesson.level, lesson.category, lesson.accent, JSON.stringify(lesson.content), JSON.stringify(lesson.cases), JSON.stringify(lesson.quiz), lesson.image_url
    ])
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
    res.json({ ok: true })
  } catch (error) {
    res.status(400).json({ message: error.message })
  }
})

app.delete('/api/admin/lessons/:id', auth, adminOnly, async (req, res) => {
  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM exam_attempts WHERE lesson_id=?', [req.params.id])
    await tx.run('DELETE FROM lesson_views WHERE lesson_id=?', [req.params.id])
    await tx.run('DELETE FROM progress WHERE lesson_id=?', [req.params.id])
    await tx.run('DELETE FROM lessons WHERE id=?', [req.params.id])
  })
  res.json({ ok: true })
})

app.patch('/api/admin/users/:id/role', auth, adminOnly, async (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ message: 'Өөрийн админ эрхийг өөрчлөх боломжгүй.' })
  const role = req.body.role === 'admin' ? 'admin' : 'student'
  await db.run('UPDATE users SET role=? WHERE id=?', [role, req.params.id])
  res.json({ ok:true })
})

app.delete('/api/admin/users/:id', auth, adminOnly, async (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ message: 'Өөрийн бүртгэлийг устгах боломжгүй.' })
  await db.transaction(async (tx) => { await tx.run('DELETE FROM login_events WHERE user_id=?', [req.params.id]); await tx.run('DELETE FROM lesson_views WHERE user_id=?', [req.params.id]); await tx.run('DELETE FROM exam_attempts WHERE user_id=?', [req.params.id]); await tx.run('DELETE FROM progress WHERE user_id=?', [req.params.id]); await tx.run('DELETE FROM users WHERE id=?', [req.params.id]) })
  res.json({ ok:true })
})

app.post('/api/admin/users', auth, adminOnly, async (req, res) => {
  const { name, username, email, password, role = 'student' } = req.body
  if (!name?.trim() || !username?.trim() || !email?.trim() || password?.length < 6) {
    return res.status(400).json({ message: 'Нэр, username, и-мэйл болон 6+ тэмдэгттэй нууц үг оруулна уу.' })
  }
  try {
    const result = await db.run('INSERT INTO users (name, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?) RETURNING id', [
      name.trim(), username.trim(), email.trim().toLowerCase(), bcrypt.hashSync(password, 10), role === 'admin' ? 'admin' : 'student'
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
  if(error.type==='entity.too.large')return res.status(413).json({message:'Файл хэт том байна. 8 MB хүртэл PDF сонгоно уу.'})
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
