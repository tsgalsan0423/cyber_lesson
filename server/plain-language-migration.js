import {plainLessons} from './plain-language.js'

export async function installPlainLanguage(db) {
  const version='plain-mongolian-v1'
  await db.exec('CREATE TABLE IF NOT EXISTS curriculum_migrations (version TEXT PRIMARY KEY)')
  if(await db.get('SELECT version FROM curriculum_migrations WHERE version=?',[version]))return
  // Keep an exact copy of the previous authored lesson, including custom fields and images.
  await db.exec('CREATE TABLE IF NOT EXISTS lesson_editorial_backups (version TEXT NOT NULL, lesson_id INTEGER NOT NULL, lesson_json TEXT NOT NULL, saved_at TEXT NOT NULL, PRIMARY KEY(version,lesson_id))')
  await db.transaction(async tx=>{
    for(const lesson of plainLessons) {
      const previous=await tx.get('SELECT * FROM lessons WHERE id=?',[lesson.id])
      if(!previous)continue
      await tx.run('INSERT INTO lesson_editorial_backups (version,lesson_id,lesson_json,saved_at) VALUES (?,?,?,?)',[version,lesson.id,JSON.stringify(previous),new Date().toISOString()])
      await tx.run('UPDATE lessons SET title=?,description=?,category=?,content_json=?,cases_json=?,quiz_json=?,objectives_json=?,summary_json=? WHERE id=?',[
        lesson.title,lesson.description,lesson.category,JSON.stringify(lesson.content),JSON.stringify(lesson.cases),JSON.stringify(lesson.quiz),JSON.stringify(lesson.objectives),JSON.stringify(lesson.summary),lesson.id
      ])
    }
    await tx.run('INSERT INTO curriculum_migrations (version) VALUES (?)',[version])
  })
}
