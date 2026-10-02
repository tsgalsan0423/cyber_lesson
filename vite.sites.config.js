import {defineConfig} from 'vite'

export default defineConfig({
  build:{
    target:'es2022',
    emptyOutDir:false,
    lib:{entry:'sites/worker.js',formats:['es'],fileName:()=>'_worker.js'},
    rollupOptions:{output:{inlineDynamicImports:true}}
  }
})
