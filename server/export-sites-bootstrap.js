import fs from 'node:fs'
import Database from 'better-sqlite3'

const source=process.argv[2]||'server/securelab.db'
const target=process.argv[3]
if(!target)throw new Error('Ашиглах нь: node server/export-sites-bootstrap.js server/securelab.db /tmp/bootstrap.json')

const db=new Database(source,{readonly:true})
const tableNames=['users','lessons','progress','exam_attempts','login_events','lesson_views','analytics_metadata','audit_logs','news','notifications','notification_reads']
const tables={}
try{
  for(const table of tableNames){
    tables[table]=db.prepare(`SELECT * FROM ${table}`).all().map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,Buffer.isBuffer(value)?value.toString('base64'):value])))
  }
}finally{db.close()}

fs.writeFileSync(target,JSON.stringify({tables}),{mode:0o600})
console.log(`Sites bootstrap: ${tableNames.map(name=>`${name}=${tables[name].length}`).join(', ')}`)
