import React,{useEffect,useState} from 'react'
import {FileText,Plus,Download,Edit3,Trash2,X,Eye,ExternalLink,Image as ImageIcon,Link as LinkIcon,RefreshCw,Globe,Building2,Sparkles} from 'lucide-react'
const empty={title:'',body:'',author:'',category:'',external_url:'',news_type:'organization'}
const formatDate=value=>new Date(value.includes('T')?value:value.replace(' ','T')+'Z').toLocaleString('mn-MN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})
const formatPublishedDate=value=>new Date(`${String(value).slice(0,10)}T12:00:00Z`).toLocaleDateString('mn-MN',{year:'numeric',month:'2-digit',day:'2-digit'})
export default function News({request,admin=false,onCountChange}) {
  const [items,setItems]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(true)
  const [form,setForm]=useState(null),[file,setFile]=useState(null),[busy,setBusy]=useState(false),[search,setSearch]=useState('')
  const [section,setSection]=useState('organization'),[aiStatus,setAiStatus]=useState(null),[syncing,setSyncing]=useState(false),[syncMessage,setSyncMessage]=useState('')
  const [preview,setPreview]=useState(null)
  const load=async(quiet=false)=>{if(!quiet)setLoading(true);try{const next=await request('/news');setItems(next);onCountChange?.(next.length)}catch(e){if(!quiet)setError(e.message)}finally{if(!quiet)setLoading(false)}}
  useEffect(()=>{load();const timer=admin?null:window.setTimeout(()=>load(true),12000);return()=>{if(timer)window.clearTimeout(timer)}},[])
  useEffect(()=>{
    if(!admin)return
    request('/admin/news/status').then(async status=>{
      setAiStatus(status)
      if(status.configured&&(!status.last_synced_at||Date.now()-Date.parse(status.last_synced_at)>6*60*60*1000)){
        setSyncing(true)
        try{const result=await request('/admin/news/refresh-international',{method:'POST',body:JSON.stringify({})});if(!result.skipped)setSyncMessage(`${result.added||0} шинэ гадаад мэдээ нэмэгдлээ.`);await load()}
        catch(e){setSyncMessage(e.message)}finally{setSyncing(false)}
      }
    }).catch(()=>{})
  },[admin])
  const syncInternational=async()=>{
    setSyncing(true);setError('');setSyncMessage('')
    try{const result=await request('/admin/news/refresh-international',{method:'POST',body:JSON.stringify({})});setSyncMessage(result.skipped?result.message||'Мэдээ шинэчлэх ажил аль хэдийн эхэлсэн байна.':`${result.added||0} шинэ гадаад мэдээ нэмэгдлээ.`);const status=await request('/admin/news/status');setAiStatus(status);await load()}
    catch(e){setError(e.message)}finally{setSyncing(false)}
  }
  const save=async e=>{
    e.preventDefault();setBusy(true);setError('')
    try{
      let attachment
      if(file){
        if(file.size>8*1024*1024||!['application/pdf','image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('8 MB хүртэл PDF, PNG, JPG эсвэл WEBP сонгоно уу.')
        const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(new Error('Файл уншихад алдаа гарлаа.'));reader.readAsDataURL(file)})
        attachment={name:file.name,base64}
      }
      await request(form.id?'/admin/news/'+form.id:'/admin/news',{method:form.id?'PUT':'POST',body:JSON.stringify({...form,news_type:section,file:attachment})})
      setForm(null);setFile(null);await load()
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }
  const getFile=async(item,download=false)=>{
    setError('')
    try{
      const res=await fetch('/api/news/'+item.id+'/file'+(download?'?download=1':''),{headers:{Authorization:'Bearer '+localStorage.getItem('securelab-token')}})
      if(!res.ok)throw new Error((await res.json()).message||'Файлыг нээж чадсангүй.')
      const url=URL.createObjectURL(await res.blob())
      if(download){const link=document.createElement('a');link.href=url;link.download=item.filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
      else setPreview({url,item})
    }catch(e){setError(e.message)}
  }
  const closePreview=()=>{if(preview?.url)URL.revokeObjectURL(preview.url);setPreview(null)}
  const remove=async item=>{if(!confirm('“'+item.title+'” мэдээ болон хавсралтыг устгах уу?'))return;try{await request('/admin/news/'+item.id,{method:'DELETE'});await load()}catch(e){setError(e.message)}}
  const visibleItems=items.filter(item=>(item.news_type||'organization')===section&&[item.title,item.body,item.author,item.category,item.source_name].filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase()))
  return <section className="news-section" id="news">
    <div className="admin-title"><div><span>МЭДЭЭ МЭДЭЭЛЭЛ</span><h2>Мэдээ</h2></div>{admin&&section==='organization'&&<button onClick={()=>{setForm({...empty,news_type:'organization'});setFile(null);setError('')}}><Plus size={15}/> Байгууллагын мэдээ нэмэх</button>}</div>
    <div className="news-tabs" role="tablist" aria-label="Мэдээний төрөл"><button type="button" role="tab" aria-selected={section==='organization'} className={section==='organization'?'active':''} onClick={()=>{setSection('organization');setSearch('');setError('')}}><Building2 size={16}/> Байгууллага <span>{items.filter(i=>(i.news_type||'organization')==='organization').length}</span></button><button type="button" role="tab" aria-selected={section==='international'} className={section==='international'?'active':''} onClick={()=>{setSection('international');setSearch('');setError('')}}><Globe size={16}/> Гадаад <span>{items.filter(i=>i.news_type==='international').length}</span></button></div>
    {section==='organization'?<p className="analytics-note">Байгууллагын мэдээ, зар, тайланг системийн админ гараар оруулна.</p>:<><p className="analytics-note">Гадаад кибер аюулгүй байдлын мэдээг монгол хэлээр хураангуйлж, эх сурвалж болон нийтэлсэн огноотой нь оруулна.</p>{admin&&<div className="international-news-controls">{aiStatus?.configured===false&&<small>Автомат шинэчлэлт идэвхжүүлэхийн тулд Sites-ийн нууц тохиргоонд OPENAI_API_KEY нэмэх шаардлагатай.</small>}{aiStatus?.configured&&<small><Sparkles size={13}/> {aiStatus.last_synced_at?`Сүүлд шинэчилсэн: ${formatDate(aiStatus.last_synced_at)}`:'Автомат шинэчлэлт хараахан хийгдээгүй'}</small>}<button type="button" onClick={syncInternational} disabled={syncing||aiStatus?.configured===false}><RefreshCw size={15} className={syncing?'spin':''}/>{syncing?'Шалгаж байна…':'Шинэ мэдээ шалгах'}</button></div>}</>}
    <label className="news-search">Мэдээ хайх<input value={search} onChange={e=>setSearch(e.target.value)} placeholder={section==='international'?'Гарчиг, эх сурвалж, ангиллаар хайх…':'Гарчиг, мэргэжилтэн, ангиллаар хайх…'}/></label>
    {error&&<p className="error" role="alert">{error}</p>}{syncMessage&&<p className="success-notice" role="status">{syncMessage}</p>}
    {loading?<p role="status">Мэдээлэл ачаалж байна…</p>:!visibleItems.length?<p className="analytics-empty">{section==='international'?'Одоогоор гадаад мэдээ алга. Шинэ мэдээ шалгана уу.':'Одоогоор байгууллагын мэдээ нийтлэгдээгүй байна.'}</p>:<div className="news-grid">{visibleItems.map(item=><article className="news-card" key={item.id}>
      <div className="news-card-head"><span className="pill">{item.category}</span><time dateTime={item.published_at||item.created_at}>{section==='international'?`Нийтэлсэн: ${formatPublishedDate(item.published_at||item.created_at)}`:formatDate(item.created_at)}</time></div><h3>{item.title}</h3><small>{section==='international'?'Эх сурвалж: ':''}{item.source_name||item.author}{item.ai_generated?<> · <Sparkles size={12}/> AI хураангуй</>:null}</small>
      <p>{item.body}</p>
      {item.external_url&&<div className="news-resource"><LinkIcon size={22}/><span><b>{section==='international'?'Эх сурвалж':'Холбоос'}</b><small>{item.external_url}</small></span><a href={item.external_url} target="_blank" rel="noopener noreferrer" title="Эх сурвалжийг шинэ цонхонд үзэх"><ExternalLink size={18}/> {section==='international'?'Эхийг унших':'Үзэх'}</a>{section==='organization'&&<a href={item.external_url} target="_blank" rel="noopener noreferrer" download title="Линкээр өгсөн файлыг татах"><Download size={18}/> Татах</a>}</div>}
      {item.filename&&<div className="news-resource">{item.mime_type?.startsWith('image/')?<ImageIcon size={22}/>:<FileText size={22}/>}<span><b>{item.filename}</b><small>{item.mime_type?.startsWith('image/')?'Зураг':'PDF'} · {(item.size/1024/1024).toFixed(2)} MB</small></span><button onClick={()=>getFile(item)} title="Татахгүйгээр үзэх"><Eye size={18}/> Үзэх</button><button onClick={()=>getFile(item,true)} title="Файлыг татах"><Download size={18}/> Татах</button></div>}
      {admin&&!item.curated&&<div className="news-actions"><button onClick={()=>{setForm({...item});setFile(null);setError('')}}><Edit3 size={15}/> Засах</button><button className="danger" onClick={()=>remove(item)}><Trash2 size={15}/> Устгах</button></div>}
    </article>)}</div>}
    {form&&<div className="modal-bg"><form className="lesson-form" onSubmit={save}><button type="button" aria-label="Хаах" className="modal-close" disabled={busy} onClick={()=>setForm(null)}><X/></button><h2>{form.id?'Байгууллагын мэдээ засах':'Байгууллагын мэдээ нэмэх'}</h2>
      <label>Гарчиг<input required maxLength={200} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="2026 оны кибер аюулгүй байдлын төлөвлөгөө"/></label>
      <label>Хариуцсан мэргэжилтэн<input required maxLength={150} value={form.author} onChange={e=>setForm({...form,author:e.target.value})}/></label>
      <label>Ангилал<input required maxLength={100} value={form.category} onChange={e=>setForm({...form,category:e.target.value})} placeholder="Жишээ: Оны төлөвлөгөө"/></label>
      <label>Хийсэн ажил, тайлбар<textarea required maxLength={20000} value={form.body} onChange={e=>setForm({...form,body:e.target.value})}/></label>
      <label>Линк (сонголтоор)<span className="input-with-icon"><ExternalLink size={16}/><input type="url" maxLength={1500} value={form.external_url||''} onChange={e=>setForm({...form,external_url:e.target.value})} placeholder="https://example.com/document"/></span></label>
      <label>PDF эсвэл зураг (сонголтоор, 8 MB хүртэл)<input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp" onChange={e=>setFile(e.target.files[0]||null)}/></label>
      {form.filename&&<label><input type="checkbox" checked={!!form.removeFile} onChange={e=>setForm({...form,removeFile:e.target.checked})}/> Хуучин хавсралтыг хасах: {form.filename}</label>}
      {error&&<p className="error" role="alert">{error}</p>}
      <button className="primary" disabled={busy}>{busy?'Хадгалж байна…':form.id?'Хадгалах':'Хэрэглэгчдэд нийтлэх'}</button>
    </form></div>}
    {preview&&<div className="modal-bg news-preview" role="dialog" aria-modal="true" aria-label={preview.item.filename}><div className="news-preview-box"><button className="modal-close" aria-label="Хаах" onClick={closePreview}><X/></button><div className="news-preview-title"><div><span>ХАВСРАЛТ</span><h3>{preview.item.filename}</h3></div><button onClick={()=>getFile(preview.item,true)}><Download size={17}/> Татах</button></div>{preview.item.mime_type?.startsWith('image/')?<img src={preview.url} alt={preview.item.filename}/>:<iframe src={preview.url} title={preview.item.filename}/>}</div></div>}
  </section>
}
