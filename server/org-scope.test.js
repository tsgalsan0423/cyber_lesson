import test from 'node:test'
import assert from 'node:assert/strict'
import {canResetPassword,filterProgressUsers,progressScope} from './org-scope.js'

const users=[
  {id:1,department:'Төрийн цахим үйлчилгээний зохицуулалтын газар',position:'Дарга'},
  {id:2,department:'Салбар дундын зохицуулалт, дахин загварчлалын газар',position:'Мэргэжилтэн'},
  {id:3,department:'Дахин загварчлалын хэлтэс',position:'Хэлтсийн дарга'},
  {id:4,department:'Дахин загварчлалын хэлтэс',position:'Ахлах мэргэжилтэн'},
  {id:5,department:'Дахин загварчлалын хэлтэс',position:'Мэргэжилтэн'},
  {id:6,department:'Чанар хяналтын газар',position:'Мэргэжилтэн'}
]

test('байгууллагын дарга бүх нэгжийн албан хаагчдыг харна',()=>{
  const actor={...users[0],role:'student',position:'Байгууллагын дарга'}
  const result=filterProgressUsers(users,actor)
  assert.equal(result.scope.code,'organization_head')
  assert.deepEqual(result.users.map(user=>user.id),[1,2,3,4,5,6])
})

test('газрын дарга өөрийн газар болон харьяа хэлтсийн бүх түвшнийг харна',()=>{
  const actor={id:20,role:'student',department:'Салбар дундын зохицуулалт, дахин загварчлалын газар',position:'Газрын дарга'}
  const result=filterProgressUsers(users,actor)
  assert.equal(result.scope.code,'department_head')
  assert.deepEqual(result.users.map(user=>user.id),[2,3,4,5])
})

test('хэлтсийн дарга зөвхөн өөрийн хэлтсийг харна',()=>{
  const actor={...users[2],role:'student'}
  assert.equal(progressScope(actor).code,'division_head')
  assert.deepEqual(filterProgressUsers(users,actor).users.map(user=>user.id),[3,4,5])
})

test('газрын ахлахад газрын дарга болон харьяа хэлтсийн хүмүүс харагдахгүй',()=>{
  const departmentUsers=[
    {id:10,department:'Цахим шилжилт, үйлчилгээний газар',position:'Газрын дарга'},
    {id:11,department:'Цахим шилжилт, үйлчилгээний газар',position:'Ахлах мэргэжилтэн'},
    {id:12,department:'Цахим шилжилт, үйлчилгээний газар',position:'Мэргэжилтэн'},
    {id:13,department:'Цахим үйлчилгээ хариуцсан хэлтэс',position:'Хэлтсийн дарга'},
    {id:14,department:'Цахим үйлчилгээ хариуцсан хэлтэс',position:'Мэргэжилтэн'}
  ]
  const actor={...departmentUsers[1],role:'student'}
  const result=filterProgressUsers(departmentUsers,actor)
  assert.equal(result.scope.code,'department_senior')
  assert.deepEqual(result.users.map(user=>user.id),[11,12])
})

test('хэлтсийн ахлахад хэлтсийн дарга харагдахгүй',()=>{
  const divisionUsers=[
    {id:20,department:'Цахим ур чадварын хэлтэс',position:'Хэлтсийн дарга'},
    {id:21,department:'Цахим ур чадварын хэлтэс',position:'Ахлах мэргэжилтэн'},
    {id:22,department:'Цахим ур чадварын хэлтэс',position:'Мэргэжилтэн'}
  ]
  const actor={...divisionUsers[1],role:'student'}
  const result=filterProgressUsers(divisionUsers,actor)
  assert.equal(result.scope.code,'division_senior')
  assert.deepEqual(result.users.map(user=>user.id),[21,22])
})

test('нууц үг шинэчлэх эрх шатлалын дагуу хязгаарлагдана',()=>{
  const department='Цахим шилжилт, үйлчилгээний газар'
  const division='Цахим үйлчилгээ хариуцсан хэлтэс'
  const admin={id:90,role:'admin',department:'',position:'Системийн админ'}
  const departmentHead={id:91,role:'student',department,position:'Дарга'}
  const departmentSenior={id:92,role:'student',department,position:'Ахлах мэргэжилтэн'}
  const departmentSpecialist={id:93,role:'student',department,position:'Мэргэжилтэн'}
  const divisionHead={id:94,role:'student',department:division,position:'Дарга'}
  const divisionSenior={id:95,role:'student',department:division,position:'Ахлах мэргэжилтэн'}
  const divisionSpecialist={id:96,role:'student',department:division,position:'Мэргэжилтэн'}
  assert.equal(canResetPassword(admin,departmentHead),true)
  assert.equal(canResetPassword(departmentHead,departmentSenior),true)
  assert.equal(canResetPassword(departmentHead,divisionHead),true)
  assert.equal(canResetPassword(departmentHead,divisionSenior),true)
  assert.equal(canResetPassword(departmentSenior,departmentSpecialist),true)
  assert.equal(canResetPassword(departmentSenior,departmentHead),false)
  assert.equal(canResetPassword(departmentSenior,divisionSpecialist),false)
  assert.equal(canResetPassword(divisionHead,divisionSenior),true)
  assert.equal(canResetPassword(divisionHead,divisionSpecialist),true)
  assert.equal(canResetPassword(divisionHead,departmentSpecialist),false)
  assert.equal(canResetPassword(divisionSenior,divisionSpecialist),true)
  assert.equal(canResetPassword(divisionSenior,divisionHead),false)
  assert.equal(canResetPassword(divisionSenior,divisionSenior),false)
})

test('цахим шилжилтийн газрын дарга 21 аймгийн хэлтсүүдийг харж удирдана',()=>{
  const departmentHead={id:100,role:'student',department:'Цахим шилжилт, үйлчилгээний газар',position:'Дарга'}
  const provinceHead={id:101,role:'student',department:'Архангай аймгийн цахим шилжилт, үйлчилгээний хэлтэс',position:'Дарга'}
  const provinceSenior={id:102,role:'student',department:'Архангай аймгийн цахим шилжилт, үйлчилгээний хэлтэс',position:'Ахлах мэргэжилтэн'}
  const provinceSpecialist={id:103,role:'student',department:'Архангай аймгийн цахим шилжилт, үйлчилгээний хэлтэс',position:'Мэргэжилтэн'}
  const unrelated={id:104,role:'student',department:'Чанар хяналтын газар',position:'Мэргэжилтэн'}
  const result=filterProgressUsers([departmentHead,provinceHead,provinceSenior,provinceSpecialist,unrelated],departmentHead)
  assert.deepEqual(result.users.map(user=>user.id),[100,101,102,103])
  assert.equal(canResetPassword(departmentHead,provinceHead),true)
  assert.equal(canResetPassword(departmentHead,provinceSenior),true)
})

test('аймгийн хэлтсийн удирдлагын эрх зөвхөн өөрийн хэлтэст үйлчилнэ',()=>{
  const unit='Архангай аймгийн цахим шилжилт, үйлчилгээний хэлтэс'
  const head={id:110,role:'student',department:unit,position:'Дарга'}
  const senior={id:111,role:'student',department:unit,position:'Ахлах мэргэжилтэн'}
  const specialist={id:112,role:'student',department:unit,position:'Мэргэжилтэн'}
  const other={id:113,role:'student',department:'Ховд аймгийн цахим шилжилт, үйлчилгээний хэлтэс',position:'Мэргэжилтэн'}
  assert.equal(progressScope(head).code,'division_head')
  assert.deepEqual(filterProgressUsers([head,senior,specialist,other],head).users.map(user=>user.id),[110,111,112])
  assert.equal(canResetPassword(senior,specialist),true)
  assert.equal(canResetPassword(senior,head),false)
  assert.equal(canResetPassword(senior,other),false)
})
