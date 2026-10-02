const ROOT_UNIT='Төрийн цахим үйлчилгээний зохицуулалтын газар'

const unitParents={
  'Дахин загварчлалын хэлтэс':'Салбар дундын зохицуулалт, дахин загварчлалын газар',
  'Цахим үйлчилгээ хариуцсан хэлтэс':'Цахим шилжилт, үйлчилгээний газар',
  '21 аймгийн хэлтэс':'Цахим шилжилт, үйлчилгээний газар',
  'Цахим ур чадварын хэлтэс':'Цахим ур чадвар, олон нийттэй харилцах газар'
}

const clean=value=>String(value||'').replace(/\s+/g,' ').trim()
const lower=value=>clean(value).toLocaleLowerCase('mn-MN')
const DIGITAL_SERVICES_UNIT='Цахим шилжилт, үйлчилгээний газар'
const isProvinceDivision=unit=>lower(unit).endsWith(lower('аймгийн цахим шилжилт, үйлчилгээний хэлтэс'))
const parentUnit=unit=>Object.entries(unitParents).find(([name])=>lower(name)===lower(unit))?.[1]||(isProvinceDivision(unit)?DIGITAL_SERVICES_UNIT:'')
const isHead=position=>position==='дарга'||position.endsWith(' дарга')
const childUnits=parent=>Object.entries(unitParents).filter(([,value])=>lower(value)===lower(parent)).map(([unit])=>unit)
const isWithinDepartment=(unit,department)=>{
  const target=lower(department)
  let current=clean(unit)
  const visited=new Set()
  while(current&&!visited.has(lower(current))){
    if(lower(current)===target)return true
    visited.add(lower(current))
    current=parentUnit(current)
  }
  return false
}
const descendantUnits=parent=>{
  const result=[]
  const visit=unit=>childUnits(unit).forEach(child=>{if(!result.some(item=>lower(item)===lower(child))){result.push(child);visit(child)}})
  visit(parent)
  return result
}

export function progressScope(user){
  const department=clean(user.department),position=lower(user.position)
  if(user.role==='admin')return{code:'system_admin',label:'Системийн админ · Бүх нэгж',all:true}
  if(lower(department)===lower(ROOT_UNIT)&&isHead(position))return{code:'organization_head',label:'Байгууллагын дарга · Бүх газар, хэлтэс',organization:true}
  const parent=parentUnit(department)
  const isDivision=Boolean(parent)
  if(isHead(position)){
    if(isDivision)return{code:'division_head',label:'Хэлтсийн дарга · Өөрийн хэлтэс',units:[department]}
    return{code:'department_head',label:'Газрын дарга · Газар болон харьяа хэлтсүүд',units:[department,...descendantUnits(department)]}
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
  let visible=scope.code==='department_head'
    ?users.filter(user=>isWithinDepartment(user.department,actor.department))
    :users.filter(user=>allowed.has(lower(user.department)))
  if(scope.code==='department_senior'||scope.code==='division_senior')visible=visible.filter(user=>!isHead(lower(user.position)))
  return{scope,users:visible}
}

export function canResetPassword(actor,target){
  if(!actor||!target||Number(actor.id)===Number(target.id))return false
  if(actor.role==='admin')return true
  if(target.role==='admin')return false
  const actorScope=progressScope(actor)
  const targetDepartment=lower(target.department),targetPosition=lower(target.position)
  const sameUnit=targetDepartment===lower(actor.department)
  const specialist=targetPosition.includes('мэргэжилтэн')
  const senior=targetPosition.includes('ахлах мэргэжилтэн')
  if(actorScope.code==='department_head'){
    return isWithinDepartment(target.department,actor.department)
  }
  if(actorScope.code==='department_senior')return sameUnit&&specialist&&!senior&&!isHead(targetPosition)
  if(actorScope.code==='division_head')return sameUnit&&specialist&&!isHead(targetPosition)
  if(actorScope.code==='division_senior')return sameUnit&&specialist&&!senior&&!isHead(targetPosition)
  return false
}
