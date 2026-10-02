const normalize=value=>String(value||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('mn-MN')

export const activeDepartments=[
  'Төрийн цахим үйлчилгээний зохицуулалтын газар',
  'Захиргаа удирдлагын газар',
  'Салбар дундын зохицуулалт, дахин загварчлалын газар',
  'Дахин загварчлалын хэлтэс',
  'Нийтийн мэдээллийн дэд бүтэц, нээлттэй өгөгдлийн газар',
  'Цахим шилжилт, үйлчилгээний газар',
  'Цахим үйлчилгээ хариуцсан хэлтэс',
  'Цахим ур чадвар, олон нийттэй харилцах газар',
  'Цахим ур чадварын хэлтэс',
  'Чанар хяналтын газар'
]

const hierarchy=[...activeDepartments.slice(0,7),'21 аймгийн хэлтэс',...activeDepartments.slice(7)]
const departmentRanks=new Map(hierarchy.map((name,index)=>[normalize(name),index]))
const provinceDepartment=value=>normalize(value).endsWith(normalize('аймгийн цахим шилжилт, үйлчилгээний хэлтэс'))

export const compareDepartments=(a,b)=>{
  const rankA=departmentRanks.get(normalize(a))??(provinceDepartment(a)?7:Number.MAX_SAFE_INTEGER)
  const rankB=departmentRanks.get(normalize(b))??(provinceDepartment(b)?7:Number.MAX_SAFE_INTEGER)
  return rankA-rankB||String(a||'').localeCompare(String(b||''),'mn-MN')
}

const positionRank=position=>{
  const value=normalize(position)
  if(value==='дарга')return 0
  if(value.includes('ахлах'))return 1
  if(value.includes('мэргэжилтэн'))return 2
  return 3
}

export const compareStaff=(a,b)=>compareDepartments(a.department,b.department)||positionRank(a.position)-positionRank(b.position)||String(a.surname||'').localeCompare(String(b.surname||''),'mn-MN')||String(a.name||'').localeCompare(String(b.name||''),'mn-MN')
