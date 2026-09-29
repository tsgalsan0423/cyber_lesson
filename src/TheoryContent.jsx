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

export default function TheoryContent({ story }) {
  if (!story?.text) return null
  return <div className="theory-outline plain-reading"><RichText text={story.text}/></div>
}
