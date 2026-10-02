import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'

const root=path.resolve(import.meta.dirname,'..')
const generated=path.join(root,'sites','.generated-assets.js')
const vite=path.join(root,'node_modules','.bin','vite')
const run=args=>{const result=spawnSync(vite,args,{cwd:root,stdio:'inherit'});if(result.status)process.exit(result.status||1)}

run(['build'])
const dist=path.join(root,'dist'),assets={}
const visit=directory=>{
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    const full=path.join(directory,entry.name)
    if(entry.isDirectory())visit(full)
    else if(entry.name!=='_worker.js')assets['/'+path.relative(dist,full).split(path.sep).join('/')]=fs.readFileSync(full).toString('base64')
  }
}
visit(dist)
fs.writeFileSync(generated,`export const STATIC_ASSETS=${JSON.stringify(assets)}\n`)
try{run(['build','--config','vite.sites.config.js'])}finally{fs.rmSync(generated,{force:true})}
