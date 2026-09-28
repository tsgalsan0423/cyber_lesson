import React,{useEffect,useState} from 'react'
import {FileText,Plus,Download,Edit3,Trash2,X} from 'lucide-react'
const empty={title:'',body:'',author:'',category:'Ажлын тайлан'}
export default function News({request,admin=false,onCountChange}) {
  const [items,setItems]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(true)
  const [form,setForm]=useState(null),[file,setFile]=useState(null),[busy,setBusy]=useState(false),[search,setSearch]=useState('')
  const load=async()=>{setLoading(true);try{const next=await request('/news');setItems(next);onCountChange?.(next.length)}catch(e){setError(e.message)}finally{setLoading(false)}}
  useEffect(()=>{load()},[])
  const save=async e=>{
    e.preventDefault();setBusy(true);setError('')
    try{
      let attachment
      if(file){
        if(file.size>8*1024*1024||!file.name.toLowerCase().endsWith('.pdf'))throw new Error('8 MB хүртэл PDF сонгоно уу.')
        const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(new Error('Файл уншихад алдаа гарлаа.'));reader.readAsDataURL(file)})
        attachment={name:file.name,base64}
      }
      await request(form.id?'/admin/news/'+form.id:'/admin/news',{method:form.id?'PUT':'POST',body:JSON.stringify({...form,file:attachment})})
      setForm(null);setFile(null);await load()
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }
  const download=async item=>{
    setError('')
    try{
      const res=await fetch('/api/news/'+item.id+'/pdf',{headers:{Authorization:'Bearer '+localStorage.getItem('securelab-token')}})
      if(!res.ok)throw new Error((await res.json()).message||'Файл татаж чадсангүй.')
      const url=URL.createObjectURL(await res.blob()), link=document.createElement('a')
      link.href=url;link.download=item.filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)
    }catch(e){setError(e.message)}
  }
  const remove=async item=>{if(!confirm('“'+item.title+'” мэдээ болон хавсралтыг устгах уу?'))return;try{await request('/admin/news/'+item.id,{method:'DELETE'});await load()}catch(e){setError(e.message)}}
  return <section className="news-section" id="news">
    <div className="admin-title"><div><span>БАЙГУУЛЛАГЫН КИБЕР АЮУЛГҮЙ БАЙДАЛ</span><h2>Мэдээ мэдээлэл</h2></div>{admin&&<button onClick={()=>{setForm({...empty});setFile(null);setError('')}}><Plus size={15}/> Мэдээ нийтлэх</button>}</div>
    <p className="analytics-note">Мэргэжилтний хийсэн ажил, оны төлөвлөгөө, тайлан болон зөвлөмж.</p>
    <label className="news-search">Мэдээ хайх<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Гарчиг, мэргэжилтэн, ангиллаар хайх…"/></label>
    {error&&<p className="error" role="alert">{error}</p>}
    {loading?<p role="status">Мэдээлэл ачаалж байна…</p>:!items.length?<p className="analytics-empty">Одоогоор мэдээлэл нийтлэгдээгүй байна.</p>:<div className="news-grid">{items.filter(i=>(i.title+i.body+i.author+i.category).toLowerCase().includes(search.toLowerCase())).map(item=><article className="news-card" key={item.id}>
      <span className="pill">{item.category}</span><h3>{item.title}</h3><small>{item.author} · {new Date(item.created_at.replace(' ','T')+'Z').toLocaleDateString('mn-MN')}</small>
      <p>{item.body}</p>
      {item.filename&&<button className="pdf-download" onClick={()=>download(item)} title="PDF файлыг татах"><FileText size={22}/><span>{item.filename}<small>PDF · {(item.size/1024/1024).toFixed(2)} MB</small></span><Download size={18}/></button>}
      {admin&&<div className="news-actions"><button onClick={()=>{setForm({...item});setFile(null);setError('')}}><Edit3 size={15}/> Засах</button><button className="danger" onClick={()=>remove(item)}><Trash2 size={15}/> Устгах</button></div>}
    </article>)}</div>}
    {form&&<div className="modal-bg"><form className="lesson-form" onSubmit={save}><button type="button" aria-label="Хаах" className="modal-close" disabled={busy} onClick={()=>setForm(null)}><X/></button><h2>{form.id?'Мэдээ засах':'Мэдээ нийтлэх'}</h2>
      <label>Гарчиг<input required maxLength={200} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="2026 оны кибер аюулгүй байдлын төлөвлөгөө"/></label>
      <label>Хариуцсан мэргэжилтэн<input required maxLength={150} value={form.author} onChange={e=>setForm({...form,author:e.target.value})}/></label>
      <label>Ангилал<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{['Ажлын тайлан','Оны төлөвлөгөө','Зөвлөмж','Мэдэгдэл'].map(c=><option key={c}>{c}</option>)}</select></label>
      <label>Хийсэн ажил, тайлбар<textarea required maxLength={20000} value={form.body} onChange={e=>setForm({...form,body:e.target.value})}/></label>
      <label>PDF хавсралт (сонголтоор, 8 MB хүртэл)<input type="file" accept=".pdf,application/pdf" onChange={e=>setFile(e.target.files[0]||null)}/></label>
      {form.filename&&<label><input type="checkbox" checked={!!form.removeFile} onChange={e=>setForm({...form,removeFile:e.target.checked})}/> Хуучин хавсралтыг хасах: {form.filename}</label>}
      {error&&<p className="error" role="alert">{error}</p>}
      <button className="primary" disabled={busy}>{busy?'Хадгалж байна…':form.id?'Хадгалах':'Хэрэглэгчдэд нийтлэх'}</button>
    </form></div>}
  </section>
}
