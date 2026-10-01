import {filterProgressUsers} from './org-scope.js'

async function loadProgressReports(db){
  const users=await db.all(`SELECT u.id,u.name,u.surname,u.username,u.email,u.department,u.position,u.role,
    (SELECT count(*) FROM login_events WHERE user_id=u.id) logins,
    (SELECT max(created_at) FROM login_events WHERE user_id=u.id) last_login
    FROM users u ORDER BY u.name,u.id`)
  const lessons=await db.all('SELECT id,title FROM lessons ORDER BY id')
  const views=await db.all('SELECT * FROM lesson_views')
  const attempts=await db.all('SELECT id,user_id,lesson_id,score,passed,created_at FROM exam_attempts ORDER BY id DESC')
  const completions=await db.all('SELECT user_id,lesson_id FROM progress WHERE completed=1')
  const key=(userId,lessonId)=>userId+':'+lessonId
  const viewMap=new Map(views.map(view=>[key(view.user_id,view.lesson_id),view]))
  const attemptMap=new Map()
  for(const attempt of attempts){const mapKey=key(attempt.user_id,attempt.lesson_id);if(!attemptMap.has(mapKey))attemptMap.set(mapKey,[]);attemptMap.get(mapKey).push(attempt)}
  const completed=new Set(completions.map(item=>key(item.user_id,item.lesson_id)))
  const reports=users.map(user=>{
    const courses=lessons.map(lesson=>{
      const mapKey=key(user.id,lesson.id),view=viewMap.get(mapKey),history=attemptMap.get(mapKey)||[]
      return{id:lesson.id,title:lesson.title,opened:!!view,attempts:history.length,last_score:history[0]?.score??null,best_score:history.length?Math.max(...history.map(item=>item.score)):null,completed:completed.has(mapKey)}
    })
    const scores=courses.filter(course=>course.last_score!==null).map(course=>course.last_score)
    return{...user,courses,viewed:courses.filter(course=>course.opened).length,tested:scores.length,completed:courses.filter(course=>course.completed).length,average:scores.length?Math.round(scores.reduce((sum,value)=>sum+value,0)/scores.length):null}
  })
  return{reports,lessons}
}

export async function installAnalytics(app, db, auth, adminOnly) {
  if (db.dialect === 'postgres') await db.exec(`
    CREATE TABLE IF NOT EXISTS login_events (
      id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS login_events_user ON login_events(user_id, created_at);
    CREATE TABLE IF NOT EXISTS lesson_views (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      first_viewed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      opens INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (user_id, lesson_id)
    );
    CREATE TABLE IF NOT EXISTS analytics_metadata (started_at TIMESTAMPTZ NOT NULL);
    INSERT INTO analytics_metadata SELECT CURRENT_TIMESTAMP
      WHERE NOT EXISTS (SELECT 1 FROM analytics_metadata);
  `)
  else await db.exec(`
    CREATE TABLE IF NOT EXISTS login_events (
      id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS login_events_user ON login_events(user_id, created_at);
    CREATE TABLE IF NOT EXISTS lesson_views (
      user_id INTEGER NOT NULL, lesson_id INTEGER NOT NULL,
      first_viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      opens INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (user_id, lesson_id)
    );
    CREATE TABLE IF NOT EXISTS analytics_metadata (started_at TEXT NOT NULL);
    INSERT INTO analytics_metadata SELECT CURRENT_TIMESTAMP
      WHERE NOT EXISTS (SELECT 1 FROM analytics_metadata);
  `)

  app.post('/api/lessons/:id/view', auth, async (req,res)=>{
    if (!await db.get('SELECT id FROM lessons WHERE id=?', [req.params.id])) return res.status(404).json({message:'Хичээл олдсонгүй.'})
    // Admin previews are not learner engagement.
    if(req.user.role!=='admin') await db.run(`INSERT INTO lesson_views (user_id,lesson_id) VALUES (?,?)
      ON CONFLICT(user_id,lesson_id) DO UPDATE SET last_viewed_at=CURRENT_TIMESTAMP, opens=lesson_views.opens+1`, [req.user.id,req.params.id])
    res.json({ok:true})
  })

  app.get('/api/admin/analytics', auth, adminOnly, async (req,res)=>{
    const users=await db.all(`SELECT u.id,u.name,u.surname,u.username,u.email,u.department,u.position,u.role,
      (SELECT count(*) FROM login_events WHERE user_id=u.id) logins,
      (SELECT max(created_at) FROM login_events WHERE user_id=u.id) last_login
      FROM users u ORDER BY u.name,u.id`)
    const lessons=await db.all('SELECT id,title FROM lessons ORDER BY id')
    const views=await db.all('SELECT * FROM lesson_views')
    const attempts=await db.all('SELECT id,user_id,lesson_id,score,passed,created_at FROM exam_attempts ORDER BY id DESC')
    const completions=await db.all('SELECT user_id,lesson_id FROM progress WHERE completed=1')
    const key=(u,l)=>u+':'+l
    const viewMap=new Map(views.map(v=>[key(v.user_id,v.lesson_id),v]))
    const attemptMap=new Map()
    for(const a of attempts){const k=key(a.user_id,a.lesson_id);if(!attemptMap.has(k))attemptMap.set(k,[]);attemptMap.get(k).push(a)}
    const completed=new Set(completions.map(p=>key(p.user_id,p.lesson_id)))
    const reports=users.map(u=>{
      const courses=lessons.map(l=>{
        const k=key(u.id,l.id), v=viewMap.get(k), history=attemptMap.get(k)||[]
        return {id:l.id,title:l.title,opened:!!v,opens:v?.opens||0,last_viewed:v?.last_viewed_at||null,
          attempts:history.length,last_score:history[0]?.score??null,
          best_score:history.length?Math.max(...history.map(a=>a.score)):null,
          last_exam:history[0]?.created_at||null,completed:completed.has(k),history}
      })
      const scores=courses.filter(c=>c.last_score!==null).map(c=>c.last_score)
      return {...u,courses,viewed:courses.filter(c=>c.opened).length,
        tested:scores.length,completed:courses.filter(c=>c.completed).length,
        average:scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):null}
    })
    const students=reports.filter(u=>u.role==='student')
    const studentIds=new Set(students.map(u=>u.id))
    const studentAttempts=attempts.filter(a=>studentIds.has(a.user_id))
    const daily = db.dialect === 'postgres' ? await db.all(`SELECT to_char(day, 'YYYY-MM-DD') day,
      (SELECT count(DISTINCT e.user_id) FROM login_events e JOIN users u ON u.id=e.user_id
       WHERE u.role='student' AND date(e.created_at)=day::date) users
      FROM generate_series(current_date - interval '6 days', current_date, interval '1 day') day`)
    : await db.all(`WITH RECURSIVE dates(day) AS (
      SELECT date('now','-6 days') UNION ALL SELECT date(day,'+1 day') FROM dates WHERE day<date('now')
    ) SELECT day,(SELECT count(DISTINCT e.user_id) FROM login_events e JOIN users u ON u.id=e.user_id
      WHERE u.role='student' AND date(e.created_at)=day) users FROM dates`)
    const active7 = db.dialect === 'postgres'
      ? (await db.get(`SELECT count(DISTINCT e.user_id) n FROM login_events e JOIN users u ON u.id=e.user_id WHERE u.role='student' AND e.created_at>=CURRENT_TIMESTAMP - interval '7 days'`)).n
      : (await db.get(`SELECT count(DISTINCT e.user_id) n FROM login_events e JOIN users u ON u.id=e.user_id WHERE u.role='student' AND e.created_at>=datetime('now','-7 days')`)).n
    res.json({
      started_at:(await db.get('SELECT started_at FROM analytics_metadata LIMIT 1')).started_at,
      summary:{registered:students.length,accessed:students.filter(u=>u.logins>0).length,
        logins:students.reduce((n,u)=>n+Number(u.logins),0),active7:Number(active7),
        viewed:students.reduce((n,u)=>n+u.viewed,0),tested:students.filter(u=>u.tested>0).length,
        attempts:studentAttempts.length,pass_rate:studentAttempts.length?Math.round(studentAttempts.filter(a=>a.passed).length/studentAttempts.length*100):null},
      daily,users:reports,
      courses:lessons.map(l=>({ ...l,
        viewed:students.filter(u=>u.courses.find(c=>c.id===l.id)?.opened).length,
        tested:students.filter(u=>u.courses.find(c=>c.id===l.id)?.attempts>0).length,
        completed:students.filter(u=>u.courses.find(c=>c.id===l.id)?.completed).length
      }))
    })
  })

  app.get('/api/progress-scope',auth,async(req,res)=>{
    const {reports,lessons}=await loadProgressReports(db)
    const {scope,users}=filterProgressUsers(reports,req.user)
    res.json({scope,lesson_count:lessons.length,users})
  })
}
