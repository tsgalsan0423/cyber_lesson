import fs from 'node:fs'
import bcrypt from 'bcryptjs'
import {createDatabase} from './db.js'

const file=process.argv[2]
if(!file) throw new Error('Ашиглах нь: npm run import:staff -- server/private/staff.tsv')
const rows=fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean)
const header=rows.shift()?.split('\t').map(x=>x.trim().toLowerCase())||[]
const required=['department','position','surname','name','phone','email']
if(!required.every(x=>header.includes(x)))throw new Error('TSV толгой: department, position, surname, name, phone, email байна.')
const db=createDatabase()
let inserted=0,updated=0
try{
  for(const [column,definition] of Object.entries({surname:'TEXT',department:'TEXT',position:'TEXT',phone:'TEXT',must_change_password:'INTEGER NOT NULL DEFAULT 0'})){
    if(db.dialect==='postgres')await db.exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${column} ${definition}`)
    else if(!(await db.all('PRAGMA table_info(users)')).some(c=>c.name===column))await db.exec(`ALTER TABLE users ADD COLUMN ${column} ${definition}`)
  }
  for(const line of rows){
    const values=line.split('\t'),item=Object.fromEntries(header.map((key,i)=>[key,(values[i]||'').trim()]))
    item.email=item.email.toLowerCase();item.phone=item.phone.replace(/\D/g,'')
    if(!item.name||!/^\d{8}$/.test(item.phone)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email))throw new Error(`Мөр буруу: ${item.surname} ${item.name} ${item.email}`)
    const existing=await db.get('SELECT id FROM users WHERE lower(email)=lower(?)',[item.email])
    if(existing){
      await db.run('UPDATE users SET name=?,surname=?,department=?,position=?,phone=?,username=? WHERE id=?',[item.name,item.surname,item.department,item.position,item.phone,item.email,existing.id]);updated++
    }else{
      await db.run("INSERT INTO users (name,surname,department,position,phone,username,email,password_hash,role,must_change_password) VALUES (?,?,?,?,?,?,?,?, 'student',1)",[item.name,item.surname,item.department,item.position,item.phone,item.email,item.email,await bcrypt.hash(item.phone,12)]);inserted++
    }
  }
  console.log(`Импорт дууслаа: ${inserted} шинэ, ${updated} шинэчилсэн.`)
}finally{await db.close()}
