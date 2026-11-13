import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {gzipSync} from 'node:zlib'

const root=path.resolve(import.meta.dirname,'..')
const generated=path.join(root,'sites','.generated-assets.js')
const vite=path.join(root,'node_modules','.bin','vite')
const run=args=>{const result=spawnSync(vite,args,{cwd:root,stdio:'inherit'});if(result.status)process.exit(result.status||1)}

run(['build'])
const dist=path.join(root,'dist'),assets={}
const compressed={}
const visit=directory=>{
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    const full=path.join(directory,entry.name)
    if(entry.isDirectory())visit(full)
    else if(entry.name!=='_worker.js'){
      const key='/'+path.relative(dist,full).split(path.sep).join('/'),bytes=fs.readFileSync(full)
      assets[key]=bytes.toString('base64')
      if(/\.(html|js|css|svg)$/.test(key)&&bytes.length>1024){
        const gzip=gzipSync(bytes,{level:9})
        if(gzip.length<bytes.length)compressed[key]=gzip.toString('base64')
      }
    }
  }
}
visit(dist)
fs.writeFileSync(generated,`export const STATIC_ASSETS=${JSON.stringify(assets)}\nexport const GZIP_ASSETS=${JSON.stringify(compressed)}\n`)
try{run(['build','--config','vite.sites.config.js'])}finally{fs.rmSync(generated,{force:true})}
