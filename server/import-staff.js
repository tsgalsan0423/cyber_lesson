import fs from 'node:fs'
import bcrypt from 'bcryptjs'
import {createDatabase} from './db.js'

const file=process.argv[2]
const resetPasswords=process.argv.includes('--reset-passwords')
if(!file||file.startsWith('--')) throw new Error('Ашиглах нь: npm run import:staff -- server/private/staff.tsv [--reset-passwords]')
const rows=fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean)
const header=rows.shift()?.split('\t').map(x=>x.trim().toLowerCase())||[]
const required=['department','position','surname','name','phone','email']
if(!required.every(x=>header.includes(x)))throw new Error('TSV толгой: department, position, surname, name, phone, email байна.')
const db=createDatabase()
const identity=value=>String(value||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('mn-MN')
const identityKey=item=>[item.surname,item.name,item.department].map(identity).join('|')
let inserted=0,updated=0,emailMigrated=0,passwordsReset=0
try{
  for(const [column,definition] of Object.entries({surname:'TEXT',department:'TEXT',position:'TEXT',phone:'TEXT',must_change_password:'INTEGER NOT NULL DEFAULT 0',session_version:'INTEGER NOT NULL DEFAULT 0'})){
    if(db.dialect==='postgres')await db.exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${column} ${definition}`)
    else if(!(await db.all('PRAGMA table_info(users)')).some(c=>c.name===column))await db.exec(`ALTER TABLE users ADD COLUMN ${column} ${definition}`)
  }
  const currentUsers=await db.all('SELECT id,name,surname,department,email FROM users')
  const byEmail=new Map(currentUsers.filter(user=>user.email).map(user=>[identity(user.email),user]))
  const byIdentity=new Map()
  for(const user of currentUsers){
    const key=identityKey(user)
    if(!byIdentity.has(key))byIdentity.set(key,[])
    byIdentity.get(key).push(user)
  }
  for(const line of rows){
    const values=line.split('\t'),item=Object.fromEntries(header.map((key,i)=>[key,(values[i]||'').trim()]))
    item.email=item.email.toLowerCase();item.phone=item.phone.replace(/\D/g,'')
    if(!item.name||!/^\d{8}$/.test(item.phone)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email))throw new Error(`Мөр буруу: ${item.surname} ${item.name} ${item.email}`)
    let existing=byEmail.get(identity(item.email))
    if(!existing){
      const matches=byIdentity.get(identityKey(item))||[]
      if(matches.length===1){
        existing=matches[0]
        emailMigrated++
      }else if(matches.length>1){
        throw new Error(`Давхардал тодорхойгүй: ${item.surname} ${item.name} (${item.department})`)
      }
    }
    if(existing){
      if(resetPasswords){
        await db.run('UPDATE users SET name=?,surname=?,department=?,position=?,phone=?,username=?,email=?,password_hash=?,must_change_password=1,session_version=session_version+1 WHERE id=?',[item.name,item.surname,item.department,item.position,item.phone,item.email,item.email,await bcrypt.hash(item.phone,12),existing.id])
        passwordsReset++
      }else{
        await db.run('UPDATE users SET name=?,surname=?,department=?,position=?,phone=?,username=?,email=? WHERE id=?',[item.name,item.surname,item.department,item.position,item.phone,item.email,item.email,existing.id])
      }
      updated++
    }else{
      await db.run("INSERT INTO users (name,surname,department,position,phone,username,email,password_hash,role,must_change_password) VALUES (?,?,?,?,?,?,?,?, 'student',1)",[item.name,item.surname,item.department,item.position,item.phone,item.email,item.email,await bcrypt.hash(item.phone,12)]);inserted++
    }
  }
  console.log(`Импорт дууслаа: ${inserted} шинэ, ${updated} шинэчилсэн, ${emailMigrated} и-мэйл шилжүүлсэн${resetPasswords?`, ${passwordsReset} нууц үг шинэчилсэн`:''}.`)
}finally{await db.close()}
