import React from 'react'

const sectionTitles = {
  'Clean desk, clear screen гэж юу вэ?': ['Ширээ ба биет баримт', 'Дэлгэцийн хамгаалалт', 'Өдөр тутмын дадал'],
  'Төхөөрөмж бол мэдээлэлд нэвтрэх түлхүүр': ['Төхөөрөмж дээрх мэдээлэл', 'Олон давхар хамгаалалт', 'Хувийн төхөөрөмжөөр ажиллах'],
  'Patch гэж юу вэ?': ['Шинэчлэлтийн зорилго', 'Шинэчлэлтийг удирдах мөчлөг', 'Үр дүнг баталгаажуулах'],
  'Нөөцлөлт яагаад хэрэгтэй вэ?': ['Өгөгдөл алдагдах эрсдэл', 'Backup ба sync-ийн ялгаа', 'Хувийн болон ажлын нөөц'],
  'Итгэлцэл, таних баталгаа ба сошиал инженерчлэл': ['Аюулгүй байдлын 3 зорилго', 'Халдагч хүний шийдвэрт хэрхэн нөлөөлдөг вэ?', 'Фишингийн хэлбэрүүд'],
  'Баталгаажуулалт, эрх ба бүртгэлийн амьдралын мөчлөг': ['Таних нэр, баталгаажуулалт, эрх', 'Баталгаажуулах хүчин зүйлс', 'Бүртгэлээ бүх шатанд хамгаалах'],
  'Сүлжээ, шифрлэлт ба итгэлцлийн хил': ['Холболтын оролцогчид', 'Шифрлэлт ба HTTPS', 'VPN ба давхар хамгаалалт'],
  'Хорт програм ба үйл ажиллагааны тасралтгүй байдал': ['Хорт програмын нөлөө', 'Эмзэг байдал, аюул занал, эрсдэл', 'Нөөцлөлт ба сэргээх төлөвлөгөө'],
  'Өгөгдлийн мөчлөг ба хамгийн бага хандалт': ['Мэдээллийн амьдралын мөчлөг', 'Хүнийг таних боломжтой мэдээлэл', 'Хамгийн бага эрхийн зарчим'],
  'Инцидентийн мөчлөг ба хариуцлагын хуваарь': ['Үйл явдал ба инцидент', 'Хариу ажиллагааны үе шатууд', 'Баримт хадгалах ба сэргээх']
}

// Preserve every sentence, including unfamiliar lesson content added later.
function sentences(text) {
  return text.trim().split(/(?<=[.!?])\s+(?=[А-ЯӨҮA-Z“«])/u).filter(Boolean)
}

export default function TheoryContent({ story }) {
  if (!story?.text) return null
  const paragraphs=story.text.split(/\n\s*\n/).filter(Boolean)
  const headings=sectionTitles[story.title]
  return <div className="theory-outline">{paragraphs.map((paragraph,i)=>{
    const points=sentences(paragraph)
    return <section className="theory-block" key={i}>
      <h4><span aria-hidden="true">{i+1}</span>{headings?.[i]||'Гол ойлголт'}</h4>
      <p className="theory-lead">{points[0]}</p>
      {points.length>1&&<ul>{points.slice(1).map((point,j)=><li key={j}>{point}</li>)}</ul>}
    </section>
  })}</div>
}
