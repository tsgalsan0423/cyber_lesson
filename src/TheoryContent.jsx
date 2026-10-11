import React from 'react'

function Inline({text}) {
  return String(text||'').split(/(\*\*[^*]+\*\*)/g).map((part,index)=>part.startsWith('**')&&part.endsWith('**')?<strong key={index}>{part.slice(2,-2)}</strong>:<React.Fragment key={index}>{part}</React.Fragment>)
}

export function RichText({text}) {
  const blocks=String(text||'').split(/\n\s*\n/).filter(Boolean)
  return <div className="rich-text">{blocks.map((block,index)=>{
    const lines=block.split('\n').map(line=>line.trim()).filter(Boolean)
    const bullets=lines.filter(line=>/^[-*•]\s+/.test(line))
    if(bullets.length===lines.length) return <ul key={index}>{bullets.map((line,i)=><li key={i}><Inline text={line.replace(/^[-*•]\s+/,'')}/></li>)}</ul>
    return <p key={index}>{lines.map((line,i)=><React.Fragment key={i}><Inline text={line}/>{i<lines.length-1&&<br/>}</React.Fragment>)}</p>
  })}</div>
}

function InformationDiagram() {
  return <div className="concept-diagram information-diagram" role="img" aria-label="Өгөгдөл, утга агуулга нийлж мэдээлэл болох зураглал">
    <div><b>25°C</b><span>Өгөгдөл</span></div><i>+</i><div><b>Өнөөдөр · Улаанбаатар</b><span>Утга агуулга</span></div><i>→</i><div className="result"><b>Өнөөдөр Улаанбаатарт 25°C</b><span>Мэдээлэл</span></div>
  </div>
}

function CiaDiagram() {
  return <div className="concept-diagram cia-diagram" role="img" aria-label="CIA гурвал: нууцлал, бүрэн бүтэн байдал, хүртээмж">
    <div className="cia-center"><b>CIA</b><span>Мэдээллийн хамгаалалт</span></div>
    <div className="cia-item confidentiality"><b>C</b><span>Нууцлал</span><small>Зөв хүн л харна</small></div>
    <div className="cia-item integrity"><b>I</b><span>Бүрэн бүтэн</span><small>Зөв, өөрчлөгдөөгүй</small></div>
    <div className="cia-item availability"><b>A</b><span>Хүртээмж</span><small>Хэрэгтэй үед ажиллана</small></div>
  </div>
}

function ProcessDiagram({steps,tone}) {
  if(!Array.isArray(steps)||!steps.length)return null
  return <figure className="attack-process" style={{'--process-tone':tone||'#22d3a7'}} aria-label="Халдлага хэрхэн явагдах дараалал">
    <figcaption>Халдлага хэрхэн явагддаг вэ?</figcaption>
    <div>{steps.map((step,index)=><React.Fragment key={index}><section><b>{index+1}</b><span>{step}</span></section>{index<steps.length-1&&<i aria-hidden="true">→</i>}</React.Fragment>)}</div>
  </figure>
}

export default function TheoryContent({ story }) {
  if (!story?.text) return null
  return <div className="theory-outline plain-reading"><RichText text={story.text}/>{story.diagram==='information'&&<InformationDiagram/>}{story.diagram==='cia'&&<CiaDiagram/>}<ProcessDiagram steps={story.process} tone={story.tone}/></div>
}
