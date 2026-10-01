import React,{useEffect,useMemo,useState} from 'react'
import {ChevronLeft,ChevronRight,PlayCircle} from 'lucide-react'
import './home-media.css'

export default function HomeMedia({lessons,onOpen}){
  const slides=useMemo(()=>lessons.slice(0,6).map((lesson,index)=>({
    ...lesson,image:lesson.image_url||`/images/topic-${((lesson.id-1)%10)+1}.svg`,number:index+1
  })),[lessons])
  const [active,setActive]=useState(0),[paused,setPaused]=useState(false)
  useEffect(()=>{if(slides.length<2||paused)return;const timer=setInterval(()=>setActive(value=>(value+1)%slides.length),3000);return()=>clearInterval(timer)},[slides.length,paused])
  useEffect(()=>{if(active>=slides.length)setActive(0)},[slides.length,active])
  const move=step=>setActive(value=>(value+step+slides.length)%slides.length)
  if(!slides.length)return null
  return <section className="home-media" aria-label="Онцлох сургалтын мэдээлэл">
    <div className="home-slider" onPointerEnter={()=>setPaused(true)} onPointerLeave={()=>setPaused(false)} onFocusCapture={()=>setPaused(true)} onBlurCapture={()=>setPaused(false)}>
      <div className="home-slides" style={{transform:`translateX(-${active*100}%)`}}>{slides.map(slide=><article className="home-slide" key={slide.id} aria-hidden={active!==slide.number-1}>
        <img src={slide.image} alt=""/>
        <div className="home-slide-shade"/>
        <div className="home-slide-copy"><span>ОНЦЛОХ ХИЧЭЭЛ · {slide.number}/{slides.length}</span><h2>{slide.title}</h2><p>{slide.description}</p><button type="button" onClick={()=>onOpen(slide)}><PlayCircle size={18}/> Хичээл үзэх</button></div>
      </article>)}</div>
      <button type="button" className="home-slider-arrow previous" aria-label="Өмнөх зураг" onClick={()=>move(-1)}><ChevronLeft/></button>
      <button type="button" className="home-slider-arrow next" aria-label="Дараагийн зураг" onClick={()=>move(1)}><ChevronRight/></button>
      <div className="home-slider-dots" aria-label="Slider сонгох">{slides.map((slide,index)=><button type="button" key={slide.id} className={index===active?'active':''} aria-label={`${index+1}-р зураг`} aria-current={index===active?'true':undefined} onClick={()=>setActive(index)}/>)}</div>
    </div>
    <article className="home-video-card"><div><span>БОДИТ ЖИШЭЭ</span><h2>Фишинг халдлагыг таних</h2><p>Сэжигтэй имэйл, холбоосыг хэрхэн танихыг бичлэгээс үзээрэй.</p></div><video controls playsInline preload="metadata"><source src="/media/phishing.mp4" type="video/mp4"/>Таны төхөөрөмж энэ бичлэгийг тоглуулах боломжгүй байна.</video></article>
  </section>
}
