export async function installNews(app, db, auth, adminOnly) {
  if (db.dialect === 'postgres') await db.exec(`CREATE TABLE IF NOT EXISTS news (
    id SERIAL PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL,
    author TEXT NOT NULL, category TEXT NOT NULL, filename TEXT,
    pdf BYTEA, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`)
  else await db.exec(`CREATE TABLE IF NOT EXISTS news (
    id INTEGER PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL,
    author TEXT NOT NULL, category TEXT NOT NULL, filename TEXT,
    pdf BLOB, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`)
  const sizeSql = db.dialect === 'postgres' ? 'octet_length(pdf)' : 'length(pdf)'
  app.get('/api/news',auth,async(_,res)=>res.json(await db.all(`SELECT id,title,body,author,category,filename,${sizeSql} size,created_at,updated_at FROM news ORDER BY id DESC`)))
  app.get('/api/news/:id/pdf',auth,async(req,res)=>{
    const item=await db.get('SELECT filename,pdf FROM news WHERE id=?', [req.params.id])
    if(!item?.pdf) return res.status(404).json({message:'Файл олдсонгүй.'})
    res.set({'Content-Type':'application/pdf','X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store','Content-Disposition':"attachment; filename=document.pdf; filename*=UTF-8''"+encodeURIComponent(item.filename)}).send(item.pdf)
  })
  async function save(req,res) {
    const {title,body,author,category,file,removeFile}=req.body||{}
    if(![title,body,author,category].every(v=>typeof v==='string'&&v.trim())||title.length>200||body.length>20000||author.length>150||category.length>100) return res.status(400).json({message:'Гарчиг, тайлбар, хариуцсан мэргэжилтэн, ангиллыг зөв бөглөнө үү.'})
    const existing=req.params.id?await db.get('SELECT * FROM news WHERE id=?', [req.params.id]):null
    if(req.params.id&&!existing) return res.status(404).json({message:'Мэдээ олдсонгүй.'})
    let pdf=removeFile?null:existing?.pdf||null, filename=removeFile?null:existing?.filename||null
    if(file){
      if(typeof file.name!=='string'||!file.name.toLowerCase().endsWith('.pdf')||typeof file.base64!=='string'||file.base64.length>12*1024*1024) return res.status(400).json({message:'Зөвхөн 8 MB хүртэл PDF файл оруулна уу.'})
      const bytes=Buffer.from(file.base64,'base64')
      if(bytes.length>8*1024*1024||bytes.subarray(0,5).toString()!=='%PDF-') return res.status(400).json({message:'Хүчинтэй PDF файл сонгоно уу (8 MB хүртэл).'})
      pdf=bytes;filename=file.name.replace(/[\r\n/\\]/g,'_').slice(0,180)
    }
    const values=[title.trim(),body.trim(),author.trim(),category.trim(),filename,pdf]
    if(existing) await db.run('UPDATE news SET title=?,body=?,author=?,category=?,filename=?,pdf=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', [...values,req.params.id])
    else {const result=await db.run('INSERT INTO news (title,body,author,category,filename,pdf) VALUES (?,?,?,?,?,?) RETURNING id', values);return res.status(201).json({id:Number(result.lastInsertRowid)})}
    res.json({ok:true})
  }
  app.post('/api/admin/news',auth,adminOnly,save)
  app.put('/api/admin/news/:id',auth,adminOnly,save)
  app.delete('/api/admin/news/:id',auth,adminOnly,async(req,res)=>{
    const result=await db.run('DELETE FROM news WHERE id=?', [req.params.id])
    res.status(result.changes?200:404).json(result.changes?{ok:true}:{message:'Мэдээ олдсонгүй.'})
  })
}
