import React, { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Bold, BookOpen, CheckCircle2, FileQuestion, Image, List, ListChecks, Plus, Save, Trash2, X, Zap } from 'lucide-react'

const imageOptions = Array.from({length:10}, (_, index) => `/images/topic-${index + 1}.svg`)
const iconOptions = ['shield','book','search','lock','key','wifi','eye','bug','save','alert','user','settings','share','phone','spark']
const levels = ['Анхан','Дунд','Ахисан']

const newTheory = () => ({title:'', text:'', task:'', icon:'shield'})
const newCase = () => ({title:'', text:'', explanation:'', task:'', icon:'search'})
const newQuiz = () => ({question:'', options:['',''], answer:0, explain:''})

function safeParse(value, fallback) {
  if (Array.isArray(value)) return value
  try { return JSON.parse(value || '') } catch { return fallback }
}

function legacyCases(content) {
  return content.filter((step) => step?.example).map((step) => ({
    title: step.title || '',
    text: step.example || '',
    explanation: step.text || '',
    task: step.task || '',
    icon: step.icon || 'search'
  }))
}

function toForm(lesson) {
  const content = safeParse(lesson?.content_json || lesson?.content, [])
  const cases = safeParse(lesson?.cases_json || lesson?.cases, legacyCases(content))
  const quiz = safeParse(lesson?.quiz_json || lesson?.quiz, [])
  return {
    title: lesson?.title || '',
    objectivesText:(lesson?.objectives || safeParse(lesson?.objectives_json,[])).join('\n'),
    summaryText:(lesson?.summary || safeParse(lesson?.summary_json,[])).join('\n'),
    description: lesson?.description || '',
    duration: lesson?.duration || '25-30 мин',
    level: lesson?.level || 'Анхан',
    category: lesson?.category || '',
    accent: lesson?.accent || '#2563eb',
    image_url: lesson?.image_url || imageOptions[0],
    content: content.length ? content.map((item) => ({title:item.title || '', text:item.text || '', task:item.task || '', icon:item.icon || 'shield'})) : [newTheory()],
    cases: cases.length ? cases.map((item) => ({title:item.title || '', text:item.text || '', explanation:item.explanation || item.solution || '', task:item.task || '', icon:item.icon || 'search'})) : [newCase()],
    quiz: quiz.length ? quiz.map((item) => ({question:item.question || '', options:(item.options || ['', '']).length >= 2 ? item.options : ['', ''], answer:Number.isInteger(item.answer) ? item.answer : 0, explain:item.explain || item.explanation || ''})) : [newQuiz()]
  }
}

function clean(value) {
  return String(value || '').trim()
}

function validate(form) {
  if (![form.title, form.description, form.duration, form.level, form.category].every(clean)) return {tab:'meta', message:'Үндсэн мэдээллийн бүх талбарыг бөглөнө үү.'}
  if (!form.content.length || form.content.some((item) => !clean(item.title) || !clean(item.text))) return {tab:'theory', message:'Онол хэсгийн гарчиг болон агуулга хоосон байж болохгүй.'}
  if (!form.cases.length || form.cases.some((item) => !clean(item.title) || !clean(item.text) || !clean(item.explanation))) return {tab:'case', message:'Дадлага ажлын хэсэгт гарчиг, нөхцөл, тайлбар бүрэн оруулна уу.'}
  if (!form.quiz.length) return {tab:'quiz', message:'Шалгалтад дор хаяж нэг асуулт нэмнэ үү.'}
  for (const item of form.quiz) {
    const options = item.options.map(clean).filter(Boolean)
    if (!clean(item.question) || options.length < 2 || item.answer < 0 || item.answer >= item.options.length || !clean(item.options[item.answer]) || !clean(item.explain)) {
      return {tab:'quiz', message:'Шалгалтын асуулт бүр 2+ сонголт, зөв хариулт, тайлбартай байх ёстой.'}
    }
  }
  return null
}

function normalize(form) {
  return {
    ...form,
    title: clean(form.title),
    objectives:form.objectivesText.split('\n').map(clean).filter(Boolean),
    summary:form.summaryText.split('\n').map(clean).filter(Boolean),
    description: clean(form.description),
    duration: clean(form.duration),
    level: clean(form.level),
    category: clean(form.category),
    image_url: clean(form.image_url),
    content: form.content.map((item) => ({title:clean(item.title), text:clean(item.text), task:clean(item.task), icon:item.icon || 'shield'})),
    cases: form.cases.map((item) => ({title:clean(item.title), text:clean(item.text), explanation:clean(item.explanation), task:clean(item.task), icon:item.icon || 'search'})),
    quiz: form.quiz.map((item) => ({question:clean(item.question), options:item.options.map(clean), answer:Number(item.answer), explain:clean(item.explain)}))
  }
}

function Field({label, children}) {
  return <label>{label}{children}</label>
}

function ArrayToolbar({onAdd, label}) {
  return <div className="editor-array-toolbar"><button type="button" onClick={onAdd}><Plus size={15}/> {label}</button></div>
}

function insertFormat(value, start, end, type) {
  const before=value.slice(0,start), selected=value.slice(start,end), after=value.slice(end)
  if(type==='bold') {
    const text=selected||'тод текст'
    return before+'**'+text+'**'+after
  }
  const text=(selected||'Жагсаалтын мөр').split('\n').map(line=>line.trim()?line.replace(/^([-*]\s*)?/,'- '):line).join('\n')
  return before+text+after
}

function RichTextarea({value,onChange,placeholder,className=''}) {
  const ref=React.useRef(null)
  const apply=type=>{
    const element=ref.current
    const start=element?.selectionStart ?? value.length
    const end=element?.selectionEnd ?? value.length
    const next=insertFormat(value,start,end,type)
    onChange(next)
    requestAnimationFrame(()=>{element?.focus();const caret=type==='bold'?start+2+(end>start?end-start:8):start+next.slice(start).indexOf('\n')+1;element?.setSelectionRange(Math.max(start,caret),Math.max(start,caret))})
  }
  return <div className="rich-editor">
    <div className="format-toolbar" aria-label="Текст форматлах хэрэгсэл">
      <button type="button" title="Bold" onClick={()=>apply('bold')}><Bold size={14}/> Bold</button>
      <button type="button" title="Bullet point" onClick={()=>apply('bullet')}><List size={14}/> Bullet</button>
      <span>**bold** · - bullet</span>
    </div>
    <textarea ref={ref} className={className} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>
  </div>
}

function MoveButtons({items, index, setItems}) {
  const move = (direction) => setItems((current) => {
    const target = index + direction
    if (target < 0 || target >= current.length) return current
    const copy = [...current]
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
    return copy
  })
  return <div className="editor-card-actions">
    <button type="button" title="Дээш" disabled={index===0} onClick={() => move(-1)}><ArrowUp size={15}/></button>
    <button type="button" title="Доош" disabled={index===items.length-1} onClick={() => move(1)}><ArrowDown size={15}/></button>
  </div>
}

export default function LessonEditor({lesson, request, onClose, onSaved, onPreview}) {
  const [form, setForm] = useState(() => toForm(lesson))
  const [tab, setTab] = useState('meta')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const editing = Boolean(lesson?.id)
  const counts = useMemo(() => ({theory:form.content.length, case:form.cases.length, quiz:form.quiz.length}), [form])
  const setArray = (key, updater) => setForm((current) => ({...current, [key]: typeof updater === 'function' ? updater(current[key]) : updater}))
  const updateArray = (key, index, patch) => setArray(key, (items) => items.map((item, i) => i === index ? {...item, ...patch} : item))
  const removeArray = (key, index) => setArray(key, (items) => items.filter((_, i) => i !== index))
  const uploadImage = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Зөвхөн зураг файл сонгоно уу.'); return }
    if (file.size > 1800000) { setError('Зураг 1.8MB-аас бага байх ёстой.'); return }
    const reader = new FileReader()
    reader.onload = () => { setForm((current) => ({...current, image_url:String(reader.result || '')})); setError('') }
    reader.onerror = () => setError('Зургийг уншиж чадсангүй. Дахин оролдоно уу.')
    reader.readAsDataURL(file)
  }
  const submit = async (event) => {
    event.preventDefault()
    const issue = validate(form)
    if (issue) { setTab(issue.tab); setError(issue.message); return }
    setSaving(true); setError('')
    try {
      await request(editing ? `/admin/lessons/${lesson.id}` : '/admin/lessons', {method: editing ? 'PUT' : 'POST', body: JSON.stringify(normalize(form))})
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }
  const preview = () => {
    const issue = validate(form)
    if (issue) { setTab(issue.tab); setError(issue.message); return }
    onPreview({...normalize(form), id: lesson?.id || 0, completed:0})
  }
  return <div className="modal-bg">
    <form className="lesson-form lesson-editor" onSubmit={submit}>
      <button type="button" className="modal-close" title="Хаах" aria-label="Хаах" onClick={onClose}><X/></button>
      <span>{editing ? 'ХИЧЭЭЛ ЗАСАХ' : 'ШИНЭ ХИЧЭЭЛ'}</span>
      <h2>{editing ? 'Бүх хэсгийг засварлах' : 'Онол · Дадлага ажил · Шалгалт нэмэх'}</h2>
      <div className="editor-tabs" role="tablist">
        <button type="button" className={tab==='meta'?'active':''} onClick={() => setTab('meta')}><BookOpen size={16}/> Мэдээлэл</button>
        <button type="button" className={tab==='theory'?'active':''} onClick={() => setTab('theory')}><ListChecks size={16}/> Онол <b>{counts.theory}</b></button>
        <button type="button" className={tab==='case'?'active':''} onClick={() => setTab('case')}><Zap size={16}/> Дадлага ажил <b>{counts.case}</b></button>
        <button type="button" className={tab==='quiz'?'active':''} onClick={() => setTab('quiz')}><FileQuestion size={16}/> Шалгалт <b>{counts.quiz}</b></button>
      </div>

      {tab === 'meta' && <section className="editor-pane">
        <Field label="Хичээлийн нэр"><input value={form.title} onChange={(e) => setForm({...form, title:e.target.value})}/></Field>
        <Field label="Тайлбар"><RichTextarea value={form.description} onChange={(description) => setForm({...form, description})}/></Field>
        <Field label="Зорилго (мөр бүрт нэг зорилго)"><RichTextarea value={form.objectivesText} onChange={(objectivesText)=>setForm({...form,objectivesText})}/></Field>
        <Field label="Гол санаа (3–5 ойлголт, мөр бүрт нэг)"><RichTextarea value={form.summaryText} onChange={(summaryText)=>setForm({...form,summaryText})}/></Field>
        <div className="form-row">
          <Field label="Ангилал"><input value={form.category} onChange={(e) => setForm({...form, category:e.target.value})}/></Field>
          <Field label="Хугацаа"><input placeholder="25-30 мин" value={form.duration} onChange={(e) => setForm({...form, duration:e.target.value})}/></Field>
        </div>
        <div className="form-row">
          <Field label="Түвшин"><select value={form.level} onChange={(e) => setForm({...form, level:e.target.value})}>{levels.map((level) => <option key={level}>{level}</option>)}</select></Field>
          <Field label="Өнгө"><input type="color" value={form.accent} onChange={(e) => setForm({...form, accent:e.target.value})}/></Field>
        </div>
        <Field label="Сэдвийн зураг">
          <div className="image-picker">{imageOptions.map((src) => <button key={src} type="button" className={form.image_url===src?'active':''} onClick={() => setForm({...form, image_url:src})}><img src={src} alt=""/><CheckCircle2 size={16}/></button>)}</div>
          {form.image_url?.startsWith('data:image/')&&<div className="custom-image-preview"><img src={form.image_url} alt="Оруулсан зураг"/><span>Таны оруулсан зураг</span></div>}
          <label className="image-upload">Зураг upload хийх<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={uploadImage}/></label>
          <div className="input-with-icon"><Image size={16}/><input value={form.image_url} onChange={(e) => setForm({...form, image_url:e.target.value})} placeholder="/images/topic-1.svg"/></div>
        </Field>
      </section>}

      {tab === 'theory' && <section className="editor-pane">
        <ArrayToolbar label="Онол нэмэх" onAdd={() => setArray('content', (items) => [...items, newTheory()])}/>
        {form.content.map((item, index) => <article className="editor-card" key={index}>
          <div className="editor-card-head"><b>Онол {index + 1}</b><MoveButtons items={form.content} index={index} setItems={(updater) => setArray('content', updater)}/><button type="button" className="danger" disabled={form.content.length===1} onClick={() => removeArray('content', index)}><Trash2 size={15}/></button></div>
          <div className="form-row"><Field label="Гарчиг"><input value={item.title} onChange={(e) => updateArray('content', index, {title:e.target.value})}/></Field><Field label="Icon"><select value={item.icon} onChange={(e) => updateArray('content', index, {icon:e.target.value})}>{iconOptions.map((icon) => <option key={icon}>{icon}</option>)}</select></Field></div>
          <Field label="Онолын агуулга"><RichTextarea className="large-textarea" value={item.text} onChange={(text) => updateArray('content', index, {text})} placeholder="Гол ойлголтуудыг догол мөрөөр бичнэ. Bullet хийх бол мөр бүрийн эхэнд - тавина."/></Field>
          <Field label="Дадлага / даалгавар"><RichTextarea value={item.task} onChange={(task) => updateArray('content', index, {task})}/></Field>
        </article>)}
      </section>}

      {tab === 'case' && <section className="editor-pane">
        <ArrayToolbar label="Дадлага ажил нэмэх" onAdd={() => setArray('cases', (items) => [...items, newCase()])}/>
        {form.cases.map((item, index) => <article className="editor-card" key={index}>
          <div className="editor-card-head"><b>Дадлага ажил {index + 1}</b><MoveButtons items={form.cases} index={index} setItems={(updater) => setArray('cases', updater)}/><button type="button" className="danger" disabled={form.cases.length===1} onClick={() => removeArray('cases', index)}><Trash2 size={15}/></button></div>
          <div className="form-row"><Field label="Дадлага ажлын нэр"><input value={item.title} onChange={(e) => updateArray('cases', index, {title:e.target.value})}/></Field><Field label="Icon"><select value={item.icon} onChange={(e) => updateArray('cases', index, {icon:e.target.value})}>{iconOptions.map((icon) => <option key={icon}>{icon}</option>)}</select></Field></div>
          <Field label="Нөхцөл / дадлага ажил"><RichTextarea className="large-textarea" value={item.text} onChange={(text) => updateArray('cases', index, {text})}/></Field>
          <Field label="Тайлбар / зөв арга хэмжээ"><RichTextarea className="large-textarea" value={item.explanation} onChange={(explanation) => updateArray('cases', index, {explanation})}/></Field>
          <Field label="Дасгал"><RichTextarea value={item.task} onChange={(task) => updateArray('cases', index, {task})}/></Field>
        </article>)}
      </section>}

      {tab === 'quiz' && <section className="editor-pane">
        <ArrayToolbar label="Асуулт нэмэх" onAdd={() => setArray('quiz', (items) => [...items, newQuiz()])}/>
        {form.quiz.map((item, index) => <article className="editor-card" key={index}>
          <div className="editor-card-head"><b>Асуулт {index + 1}</b><MoveButtons items={form.quiz} index={index} setItems={(updater) => setArray('quiz', updater)}/><button type="button" className="danger" disabled={form.quiz.length===1} onClick={() => removeArray('quiz', index)}><Trash2 size={15}/></button></div>
          <Field label="Асуулт"><RichTextarea value={item.question} onChange={(question) => updateArray('quiz', index, {question})}/></Field>
          <div className="quiz-option-editor">{item.options.map((option, optionIndex) => <div key={optionIndex}>
            <input type="radio" title="Зөв хариулт" checked={Number(item.answer)===optionIndex} onChange={() => updateArray('quiz', index, {answer:optionIndex})}/>
            <input value={option} placeholder={`Сонголт ${optionIndex + 1}`} onChange={(e) => updateArray('quiz', index, {options:item.options.map((current, i) => i === optionIndex ? e.target.value : current)})}/>
            <button type="button" className="danger" disabled={item.options.length<=2} onClick={() => {
              const options = item.options.filter((_, i) => i !== optionIndex)
              updateArray('quiz', index, {options, answer: Math.min(item.answer, options.length - 1)})
            }}><Trash2 size={14}/></button>
          </div>)}</div>
          <button type="button" className="ghost-add" onClick={() => updateArray('quiz', index, {options:[...item.options, '']})}><Plus size={14}/> Сонголт нэмэх</button>
          <Field label="Зөв хариултын тайлбар"><RichTextarea value={item.explain} onChange={(explain) => updateArray('quiz', index, {explain})}/></Field>
        </article>)}
      </section>}

      {error && <div className="error">{error}</div>}
      <div className="editor-footer">
        <button type="button" className="preview-btn" onClick={preview}><BookOpen size={16}/> Урьдчилж үзэх</button>
        <button className="primary" disabled={saving}><Save size={16}/> {saving ? 'Хадгалж байна...' : editing ? 'Өөрчлөлт хадгалах' : 'Хичээл үүсгэх'}</button>
      </div>
    </form>
  </div>
}
