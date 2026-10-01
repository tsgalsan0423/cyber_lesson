export async function createNotification(db,{type,title,message,targetUrl}){
  await db.run('INSERT INTO notifications (type,title,message,target_url) VALUES (?,?,?,?)',[
    String(type||'update').slice(0,40),String(title||'Шинэ мэдээлэл').slice(0,160),String(message||'').slice(0,500),String(targetUrl||'').slice(0,240)
  ])
}

export async function installNotifications(app,db,auth){
  if(db.dialect==='postgres')await db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,type TEXT NOT NULL,title TEXT NOT NULL,message TEXT NOT NULL,
      target_url TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS notification_reads (
      notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      read_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (notification_id,user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
  `)
  else await db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY,type TEXT NOT NULL,title TEXT NOT NULL,message TEXT NOT NULL,
      target_url TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS notification_reads (
      notification_id INTEGER NOT NULL,user_id INTEGER NOT NULL,
      read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (notification_id,user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
  `)

  app.get('/api/notifications',auth,async(req,res)=>{
    const items=await db.all(`SELECT n.id,n.type,n.title,n.message,n.target_url,n.created_at,
      CASE WHEN r.notification_id IS NULL THEN 0 ELSE 1 END is_read
      FROM notifications n
      LEFT JOIN notification_reads r ON r.notification_id=n.id AND r.user_id=?
      WHERE n.created_at>=(SELECT created_at FROM users WHERE id=?)
      ORDER BY n.id DESC LIMIT 30`,[req.user.id,req.user.id])
    res.json(items)
  })

  app.post('/api/notifications/:id/read',auth,async(req,res)=>{
    if(!await db.get('SELECT id FROM notifications WHERE id=?',[req.params.id]))return res.status(404).json({message:'Мэдэгдэл олдсонгүй.'})
    await db.run('INSERT INTO notification_reads (notification_id,user_id) VALUES (?,?) ON CONFLICT(notification_id,user_id) DO NOTHING',[req.params.id,req.user.id])
    res.json({ok:true})
  })

  app.post('/api/notifications/read-all',auth,async(req,res)=>{
    const items=await db.all(`SELECT id FROM notifications WHERE created_at>=(SELECT created_at FROM users WHERE id=?)`,[req.user.id])
    for(const item of items)await db.run('INSERT INTO notification_reads (notification_id,user_id) VALUES (?,?) ON CONFLICT(notification_id,user_id) DO NOTHING',[item.id,req.user.id])
    res.json({ok:true})
  })
}
