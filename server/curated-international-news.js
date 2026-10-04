// Verified source articles published during 2026-09-25–2026-10-02.
// These entries are bundled with the app so the international section has
// sourced Mongolian summaries even before automatic news refresh is configured.
export const curatedInternationalNews = [
  {
    id: -1001,
    title: 'Cisco-ийн SD-WAN удирдлагад нууц үггүй админ эрх авах эмзэг байдлыг ашиглаж байна',
    body: 'Cisco Catalyst SD-WAN Manager-ийн CVE-2026-76504 эмзэг байдал нь алсаас, нэвтрэх эрхгүйгээр API-д админ эрхээр хандах боломж олгоно. Cisco энэ алдааг бодит халдлагад ашиглаж байгааг баталж, засварласан хувилбар руу яаралтай шинэчлэхийг зөвлөжээ.',
    category: 'Идэвхтэй ашиглагдаж буй эмзэг байдал',
    source_name: 'Cisco Security Advisory',
    external_url: 'https://sec.cloudapps.cisco.com/security/center/content/CiscoSecurityAdvisory/cisco-sa-sdwan-webauth-xr8beuuU',
    published_at: '2026-09-30',
  },
  {
    id: -1002,
    title: 'Kiteworks халдлагын сэрэмжлүүлгээр хэрэглэгчдийн системийг түр унтраажээ',
    body: 'Ирж болзошгүй халдлагын талаар мэдээлэл авсны дараа Kiteworks 9-р сарын 25-нд хэрэглэгчдэд системээ түр унтраахыг зөвлөсөн. Энэ хугацаанд хэрэглэгчдийн нэг хувиас бага хэсэгт хамаарах боломжид ноцтой эмзэг байдал илрүүлж зассан бөгөөд халдлагад ашиглагдсан эсвэл хэрэглэгчийн мэдээлэл алдагдсан нотолгоо байхгүй гэж компани мэдэгдэв.',
    category: 'Аюулгүй байдлын тохиолдол',
    source_name: 'Kiteworks',
    external_url: 'https://www.kiteworks.com/company/press-releases/kiteworks-restores-systems-credible-threat/',
    published_at: '2026-09-28',
  },
  {
    id: -1003,
    title: 'Нэг хэрэглэгчийн нууц үг сэргээснээс Azure DevOps хүртэл халдлага тэлжээ',
    body: 'Microsoft-ийн шинжилгээнд Storm-3068 бүлэг хэрэглэгчийн өөрөө нууц үг сэргээх үйлдлээр бүртгэлийг нь эзэмшиж, өөрийн баталгаажуулах аргыг нэмсэн гэжээ. Дараа нь Azure DevOps-ийн репозитор, дамжлагуудыг судалж, Kubernetes орчинд хандах боломж олгох нэвтрэх мэдээлэл олж авсан байна.',
    category: 'Халдлагын шинжилгээ',
    source_name: 'Microsoft Security',
    external_url: 'https://www.microsoft.com/en-us/security/blog/2026/09/29/beyond-source-code-a-path-to-the-keys-to-the-kingdom/',
    published_at: '2026-09-29',
  },
  {
    id: -1004,
    title: 'Алдагдсан үүлэн эрхээр Azure-ийн нөөцүүдийг устгасан халдлагыг илрүүлжээ',
    body: 'Microsoft Security Research-ийн мэдээлснээр Storm-3168 бүлэг алдагдсан service principal эрхээр Azure орчинд нөөц устгах, үүлэн үйлчилгээний нэвтрэх мэдээлэл цуглуулах ажиллагаа явуулжээ. Судлаачид нэг эрхээр нөөцүүдийг судалж, нөгөөгөөр нь устгах ажиллагаа болон мэдээлэл цуглуулсныг тогтоосон байна.',
    category: 'Үүлэн аюулгүй байдал',
    source_name: 'Microsoft Security Research',
    external_url: 'https://www.microsoft.com/en-us/security/blog/2026/09/25/storm-3168-agentic-driven-cloud-attacks-using-compromised-service-principals/',
    published_at: '2026-09-25',
  },
].map(item=>({
  ...item,
  news_type:'international',
  author:item.source_name,
  filename:null,
  mime_type:null,
  size:null,
  ai_generated:0,
  curated:true,
  created_at:item.published_at,
  updated_at:item.published_at,
}))

export function mergeNewsWithCurated(rows) {
  const curatedUrls=new Set(curatedInternationalNews.map(item=>item.external_url))
  return [...rows.filter(item=>!curatedUrls.has(item.external_url)),...curatedInternationalNews]
    .sort((a,b)=>String(b.published_at||b.created_at).localeCompare(String(a.published_at||a.created_at)))
}
