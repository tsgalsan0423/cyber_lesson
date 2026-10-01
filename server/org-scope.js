const ROOT_UNIT='Төрийн цахим үйлчилгээний зохицуулалтын газар'

const unitParents={
  'Дахин загварчлалын хэлтэс':'Салбар дундын зохицуулалт, дахин загварчлалын газар',
  'Цахим үйлчилгээ хариуцсан хэлтэс':'Цахим шилжилт, үйлчилгээний газар',
  '21 аймгийн хэлтэс':'Цахим шилжилт, үйлчилгээний газар',
  'Цахим ур чадварын хэлтэс':'Цахим ур чадвар, олон нийттэй харилцах газар'
}

const clean=value=>String(value||'').replace(/\s+/g,' ').trim()
const lower=value=>clean(value).toLocaleLowerCase('mn-MN')
const childUnits=parent=>Object.entries(unitParents).filter(([,value])=>lower(value)===lower(parent)).map(([unit])=>unit)

export function progressScope(user){
  const department=clean(user.department),position=lower(user.position)
  if(user.role==='admin')return{code:'system_admin',label:'Системийн админ · Бүх нэгж',all:true}
  if(lower(department)===lower(ROOT_UNIT)&&position==='дарга')return{code:'organization_head',label:'Байгууллагын дарга · Бүх газар, хэлтэс',organization:true}
  const parent=Object.entries(unitParents).find(([unit])=>lower(unit)===lower(department))?.[1]
  const isDivision=Boolean(parent)
  if(position==='дарга'){
    if(isDivision)return{code:'division_head',label:'Хэлтсийн дарга · Өөрийн хэлтэс',units:[department]}
    return{code:'department_head',label:'Газрын дарга · Газар болон харьяа хэлтсүүд',units:[department,...childUnits(department)]}
  }
  if(position.includes('ахлах мэргэжилтэн')){
    return isDivision
      ?{code:'division_senior',label:'Хэлтсийн ахлах мэргэжилтэн · Өөрийн хэлтэс',units:[department]}
      :{code:'department_senior',label:'Газрын ахлах мэргэжилтэн · Зөвхөн газрын шууд харьяа албан хаагчид',units:[department]}
  }
  return{code:'self',label:'Албан хаагч · Зөвхөн өөрийн сургалтын явц',self:true}
}

export function filterProgressUsers(users,actor){
  const scope=progressScope(actor)
  if(scope.all)return{scope,users}
  if(scope.organization)return{scope,users:users.filter(user=>clean(user.department))}
  if(scope.self)return{scope,users:users.filter(user=>Number(user.id)===Number(actor.id))}
  const allowed=new Set((scope.units||[]).map(lower))
  return{scope,users:users.filter(user=>allowed.has(lower(user.department)))}
}
