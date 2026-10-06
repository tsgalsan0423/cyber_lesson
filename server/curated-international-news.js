// Verified source articles published during 2026-09-25–2026-10-06.
// These entries are bundled with the app so the international section has
// sourced Mongolian summaries even before automatic news refresh is configured.
export const curatedInternationalNews = [
  {
    id: -1008,
    title: 'Microsoft: AI эрчимжихийн хэрээр чухал системийн засварыг 24 цагийн дотор хийх шаардлага нэмэгдэж байна',
    body: 'Microsoft-ийн мэдээлснээр AI-д суурилсан шинжилгээ нь эмзэг байдлыг олж илрүүлэх, засах үйл явцыг хурдасгаж байгаа ч хамгаалагчдын шалгах ёстой олдворын тоог мөн эрс нэмэгдүүлж байна. Байгууллагууд on-premises Microsoft системийн засварын нөөцөө нэмэгдүүлж, domain controller болон сүлжээний захын төхөөрөмж зэрэг чухал системийн засварыг дараагийн төлөвлөгөөт цонх хүртэл хүлээлгүй 24 цагийн дотор хийх боломжийг авч үзэхийг зөвлөжээ. Мөн хамгаалалтын давхар арга хэмжээ болон үндсэн хяналтуудын төлөвийг тасралтгүй шалгахыг онцолсон байна.',
    category: 'Эрсдэлийн удирдлага',
    source_name: 'Microsoft Security',
    external_url: 'https://www.microsoft.com/en-us/security/blog/2026/10/06/ciso-perspectives-on-managing-vulnerability-risks-in-the-age-of-ai/',
    published_at: '2026-10-06',
  },
  {
    id: -1005,
    title: 'Citrix NetScaler-ийн zero-day эмзэг байдлуудаар бодит нэвтрэлтүүд гарсныг баталжээ',
    body: 'Финляндын Үндэсний кибер аюулгүй байдлын төв Citrix NetScaler ADC болон Gateway-д нөлөөлсөн найман эмзэг байдлыг бодит халдлагад ашигласан, Финляндад хэд хэдэн нэвтрэлт бүртгэгдсэн гэж мэдэгдэв. Хамгийн ноцтой CVE-2026-88771 нь нэвтрэх эрхгүйгээр команд ажиллуулах эрсдэлтэй. Зөвхөн засвар суулгахаас гадна лог, шинэ хэрэглэгч, scheduled task, service болон дотоод сүлжээнд тархсан шинжийг шалгахыг зөвлөжээ.',
    category: 'Идэвхтэй ашиглагдаж буй эмзэг байдал',
    source_name: 'NCSC-FI / Traficom',
    external_url: 'https://www.kyberturvallisuuskeskus.fi/en/alerts/critical-vulnerabilities-citrix-netscaler-adc-and-netscaler-gateway-products-several-intrusions-finland',
    published_at: '2026-10-01',
  },
  {
    id: -1006,
    title: 'KillSec бүлгийн 110 терабайт алдагдсан өгөгдөл ба дэд бүтцийг хууль сахиулагчид хураажээ',
    body: 'АНУ-ын Хууль зүйн яамны мэдээлснээр KillSec ransomware бүлэгтэй холбоотой гэж буруутгагдсан Нидерландын иргэнийг Их Британид баривчилжээ. Operation KillSwitch-ийн хүрээнд 1,000 орчим сэжигтэй халдлагыг шалгаж, одоогоор 500 орчим нь амжилттай болсныг тогтоогоод байна. Хууль сахиулагчид тус бүлгийн мэдээлэл задруулах сайтыг хурааж, 110-аас доошгүй терабайт өгөгдлийг цааш алдагдахаас сэргийлсэн гэжээ. Яллагдагчийн гэм бурууг шүүхээр эцэслэн тогтооно.',
    category: 'Кибер гэмт хэрэг',
    source_name: 'U.S. Department of Justice',
    external_url: 'https://www.justice.gov/usao-pr/pr/dutch-national-indicted-and-arrested-unauthorized-computer-access-conspiracy',
    published_at: '2026-10-01',
  },
  {
    id: -1007,
    title: 'WatchGuard Fireware OS-ийг нэвтрэх эрхгүйгээр доголдуулах эмзэг байдл илэрчээ',
    body: 'Канадын Кибер аюулгүй байдлын төв CVE-2026-86134 эмзэг байдал WatchGuard Fireware OS-д нөлөөлж байгааг мэдэгдэв. Тус алдааг ашиглан алсаас, нэвтрэх эрхгүйгээр төхөөрөмжийг denial-of-service нөхцөлд оруулж болзошгүй. Fireware OS 12.12.3, 12.5.21, 2026.2.3, 2026.3.2-оос өмнөх холбогдох салбар хувилбаруудыг шинэчлэхийг зөвлөжээ.',
    category: 'Аюулгүй байдлын засвар',
    source_name: 'Canadian Centre for Cyber Security',
    external_url: 'https://www.cyber.gc.ca/en/alerts-advisories/watchguard-security-advisory-av26-981',
    published_at: '2026-10-01',
  },
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
