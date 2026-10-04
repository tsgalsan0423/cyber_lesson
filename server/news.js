import {createNotification} from './notifications.js'
import {mergeNewsWithCurated} from './curated-international-news.js'

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
  if(db.dialect==='postgres') await db.exec("ALTER TABLE news ADD COLUMN IF NOT EXISTS mime_type TEXT; ALTER TABLE news ADD COLUMN IF NOT EXISTS external_url TEXT; ALTER TABLE news ADD COLUMN IF NOT EXISTS news_type TEXT NOT NULL DEFAULT 'organization'; ALTER TABLE news ADD COLUMN IF NOT EXISTS source_name TEXT; ALTER TABLE news ADD COLUMN IF NOT EXISTS ai_generated INTEGER NOT NULL DEFAULT 0; ALTER TABLE news ADD COLUMN IF NOT EXISTS published_at TEXT")
  else {
    const columns=(await db.all('PRAGMA table_info(news)')).map(c=>c.name)
    if(!columns.includes('mime_type'))await db.exec('ALTER TABLE news ADD COLUMN mime_type TEXT')
    if(!columns.includes('external_url'))await db.exec('ALTER TABLE news ADD COLUMN external_url TEXT')
    if(!columns.includes('news_type'))await db.exec("ALTER TABLE news ADD COLUMN news_type TEXT NOT NULL DEFAULT 'organization'")
    if(!columns.includes('source_name'))await db.exec('ALTER TABLE news ADD COLUMN source_name TEXT')
    if(!columns.includes('ai_generated'))await db.exec('ALTER TABLE news ADD COLUMN ai_generated INTEGER NOT NULL DEFAULT 0')
    if(!columns.includes('published_at'))await db.exec('ALTER TABLE news ADD COLUMN published_at TEXT')
  }
  await db.run("UPDATE news SET mime_type='application/pdf' WHERE filename IS NOT NULL AND mime_type IS NULL")
  const sizeSql = db.dialect === 'postgres' ? 'octet_length(pdf)' : 'length(pdf)'
  app.get('/api/news',auth,async(_,res)=>res.json(mergeNewsWithCurated(await db.all(`SELECT id,title,body,author,category,filename,mime_type,external_url,news_type,source_name,ai_generated,published_at,${sizeSql} size,created_at,updated_at FROM news ORDER BY id DESC`))))
  const serveFile=async(req,res)=>{
    const item=await db.get('SELECT filename,mime_type,pdf FROM news WHERE id=?', [req.params.id])
    if(!item?.pdf) return res.status(404).json({message:'Файл олдсонгүй.'})
    const disposition=req.query.download==='1'?'attachment':'inline'
    res.set({'Content-Type':item.mime_type||'application/pdf','X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'",'Content-Disposition':`${disposition}; filename=file; filename*=UTF-8''${encodeURIComponent(item.filename)}`}).send(item.pdf)
  }
  app.get('/api/news/:id/file',auth,serveFile)
  app.get('/api/news/:id/pdf',auth,(req,res)=>{req.query.download='1';return serveFile(req,res)})
  async function save(req,res) {
    const {title,body,author,category,file,removeFile}=req.body||{}
    const externalUrl=String(req.body?.external_url||'').trim()
    if(![title,body,author,category].every(v=>typeof v==='string'&&v.trim())||title.length>200||body.length>20000||author.length>150||category.length>100) return res.status(400).json({message:'Гарчиг, тайлбар, хариуцсан мэргэжилтэн, ангиллыг зөв бөглөнө үү.'})
    if(externalUrl&&(!/^https?:\/\//i.test(externalUrl)||externalUrl.length>1500))return res.status(400).json({message:'Линк http:// эсвэл https:// гэж эхэлсэн зөв хаяг байна.'})
    const existing=req.params.id?await db.get('SELECT * FROM news WHERE id=?', [req.params.id]):null
    if(req.params.id&&!existing) return res.status(404).json({message:'Мэдээ олдсонгүй.'})
    let pdf=removeFile?null:existing?.pdf||null, filename=removeFile?null:existing?.filename||null, mimeType=removeFile?null:existing?.mime_type||null
    if(file){
      if(typeof file.name!=='string'||typeof file.base64!=='string'||file.base64.length>12*1024*1024) return res.status(400).json({message:'8 MB хүртэл PDF, PNG, JPG эсвэл WEBP файл оруулна уу.'})
      const bytes=Buffer.from(file.base64,'base64')
      const detected=bytes.subarray(0,5).toString()==='%PDF-'?'application/pdf':bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP'?'image/webp':''
      if(bytes.length>8*1024*1024||!detected) return res.status(400).json({message:'Хүчинтэй PDF, PNG, JPG эсвэл WEBP файл сонгоно уу (8 MB хүртэл).'})
      pdf=bytes;mimeType=detected;filename=file.name.replace(/[\r\n/\\]/g,'_').slice(0,180)
    }
    const newsType=req.body?.news_type==='international'?'international':'organization'
    const sourceName=newsType==='international'?String(req.body?.source_name||author).trim():null
    const values=[title.trim(),body.trim(),author.trim(),category.trim(),filename,pdf,mimeType,externalUrl||null,newsType,sourceName]
    if(existing){
      await db.run('UPDATE news SET title=?,body=?,author=?,category=?,filename=?,pdf=?,mime_type=?,external_url=?,news_type=?,source_name=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', [...values,req.params.id])
      await createNotification(db,{type:'news_updated',title:'Мэдээ шинэчлэгдлээ',message:title.trim(),targetUrl:'#news'})
    }
    else {
      const result=await db.run('INSERT INTO news (title,body,author,category,filename,pdf,mime_type,external_url,news_type,source_name) VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING id', values)
      await createNotification(db,{type:'news_new',title:'Шинэ мэдээ нийтлэгдлээ',message:title.trim(),targetUrl:'#news'})
      return res.status(201).json({id:Number(result.lastInsertRowid)})
    }
    res.json({ok:true})
  }
  app.post('/api/admin/news',auth,adminOnly,save)
  app.put('/api/admin/news/:id',auth,adminOnly,save)
  app.delete('/api/admin/news/:id',auth,adminOnly,async(req,res)=>{
    const item=await db.get('SELECT title FROM news WHERE id=?',[req.params.id])
    const result=await db.run('DELETE FROM news WHERE id=?', [req.params.id])
    if(result.changes)await createNotification(db,{type:'news_deleted',title:'Мэдээ хасагдлаа',message:item?.title||'',targetUrl:'#news'})
    res.status(result.changes?200:404).json(result.changes?{ok:true}:{message:'Мэдээ олдсонгүй.'})
  })
}
