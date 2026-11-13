import {createPasswordRecovery,RECOVERY_SCHEMA} from './password-recovery.js'
import {createRecoveryMailer,recoveryMailConfigured} from './recovery-mail.js'

export function createRecoveryHandler({db,env,passwordError}){
  let ready
  return async(action,body,client)=>{
    if(!recoveryMailConfigured(env))throw Object.assign(new Error('Нууц үг сэргээх цахим шуудангийн үйлчилгээ хараахан идэвхжээгүй байна. Системийн админд хандана уу.'),{status:503})
    if(!ready)ready=db.exec(RECOVERY_SCHEMA).catch(error=>{ready=null;throw error})
    await ready
    const service=createPasswordRecovery({db,secret:env.JWT_SECRET,sendCode:createRecoveryMailer(env),passwordError})
    const input={...(body&&typeof body==='object'?body:{}),ip:client.ip,device:client.device}
    return action==='request'?service.request(input):service.confirm(input)
  }
}
