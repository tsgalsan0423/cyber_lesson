export async function installAudit(app,db,auth,adminOnly) {
  await db.exec(`CREATE TABLE IF NOT EXISTS audit_logs (
    id ${db.dialect==='postgres'?'SERIAL PRIMARY KEY':'INTEGER PRIMARY KEY'},
    actor_id INTEGER NOT NULL, actor_name TEXT NOT NULL, action TEXT NOT NULL,
    target TEXT NOT NULL, created_at ${db.dialect==='postgres'?'TIMESTAMPTZ':'TEXT'} DEFAULT CURRENT_TIMESTAMP
  )`)
  app.get('/api/admin/audit-logs',auth,adminOnly,async(req,res)=>{
    res.json(await db.all('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 200'))
  })
  // Record only successful authenticated admin mutations; never capture request bodies/passwords.
  app.use('/api/admin',auth,adminOnly,(req,res,next)=>{
    if(!['POST','PUT','PATCH','DELETE'].includes(req.method))return next()
    const send=res.json.bind(res)
    res.json=function(body) {
      if(res.statusCode>=400)return send(body)
      const target=req.originalUrl.split('?')[0]+(body?.id?`/${body.id}`:'')
      db.run('INSERT INTO audit_logs (actor_id,actor_name,action,target) VALUES (?,?,?,?)',
        [req.user.id,req.user.username||req.user.name||String(req.user.id),req.method,target])
        .then(()=>send(body)).catch(next)
      return res
    }
    next()
  })
}
