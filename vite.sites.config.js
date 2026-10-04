import {defineConfig} from 'vite'

export default defineConfig({
  build:{
    target:'es2022',
    emptyOutDir:false,
    outDir:'dist/server',
    lib:{entry:'sites/worker.js',formats:['es'],fileName:()=>'index.js'},
    rollupOptions:{output:{inlineDynamicImports:true}}
  }
})
