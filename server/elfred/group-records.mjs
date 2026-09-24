import {checkedAssistResult} from './assist-result.mjs';
import {taskCommand} from './runtime.mjs';
import {fail,now} from './store.mjs';
import {string,enumeration} from './policy.mjs';
export function groupCommand(store,user,action,input){
 if(action==='group.record.save'){
  const group=store.read(user,input.conversation_id,'conversation');if(group.data.kind!=='group')fail('INVALID_CONTEXT','此记录只用于群聊');
  const existing=input.id?store.expect(store.read(user,input.id,'shared_record'),input.version):null;
  if(existing&&(existing.space!==group.id||existing.owner!==user&&group.owner!==user))fail('FORBIDDEN','仅作者或群主可修改记录',403);
  if(existing?.data.kind==='disagreement'&&existing.owner!==user)fail('FORBIDDEN','分歧只能由表达者本人修改，群主不能覆盖',403);
  const refs=(input.source_refs||[]).map(ref=>{const message=store.expect(store.read(user,ref.id,'message'),ref.version);if(message.space!==group.id)fail('INVALID_CONTEXT','来源需为此群的消息');return {id:message.id,version:message.version};});
  if(refs.length>20)fail('INVALID_INPUT','最多选择 20 条来源');
  const kind=enumeration(input.kind||'conclusion',['goal','conclusion','disagreement','brief','calendar','minutes'],'记录类型');
  const assignee=input.assignee||existing?.data.assignee||user;if(!store.role(group.id,assignee))fail('INVALID_ASSIGNEE','请选择当前群成员确认');
  const data={title:string(input.title,'标题',200),content:string(input.content,'共享记录',10000),kind,status:['goal','conclusion'].includes(kind)?'proposed':'active',assignee,source_refs:refs,confirmed_by:['goal','conclusion'].includes(kind)?null:user,updated_by:user,history:existing?[...(existing.data.history||[]),{version:existing.version,title:existing.data.title,content:existing.data.content,status:existing.data.status,updated_by:existing.data.updated_by||existing.owner,at:existing.updated}]:[]};
  return {id:existing?store.update(existing,{...existing.data,...data},user).id:store.add('shared_record',user,data,{space:group.id,visibility:'members'}).id};
 }
 if(action==='group.record.confirm'){
  const item=store.expect(store.read(user,input.id,'shared_record'),input.version);store.read(user,item.space,'conversation');
  if(item.data.assignee!==user)fail('FORBIDDEN','只有此事项负责人可确认，不由群主代签',403);
  if(item.data.status!=='proposed')fail('INVALID_STATE','此记录当前不待确认');
  if(input.confirm!==true)fail('CONFIRMATION_REQUIRED','请核对目标或结论及其范围');
  return {id:store.update(item,{...item.data,status:'active',confirmed_by:user,confirmed_at:now()},user).id};
 }
 if(action==='group.record.archive'){
  const item=store.expect(store.read(user,input.id,'shared_record'),input.version),group=store.read(user,item.space,'conversation');if(item.owner!==user&&group.owner!==user)fail('FORBIDDEN','仅作者或群主可归档',403);
  if(item.data.kind==='disagreement'&&item.owner!==user)fail('FORBIDDEN','不能代他人撤回分歧',403);
  return {id:store.update(item,{...item.data,status:'archived'},user).id};
 }
 if(action==='commitment.assign'){
  const item=store.expect(store.read(user,input.id,'commitment'),input.version);store.read(user,item.space,'conversation');
  const group=store.read(user,item.space,'conversation');
  if(item.owner!==user&&!(group.owner===user&&!store.role(item.space,item.owner)))fail('FORBIDDEN','由提议者指定候选负责人；提议者离群后由群主重新提议',403);
  if(item.data.assignee||item.data.status==='withdrawn')fail('INVALID_STATE','此事项已有负责人或已撤回');
  if(!store.role(item.space,input.assignee))fail('INVALID_ASSIGNEE','负责人需为当前成员');
  return {id:store.update(item,{...item.data,assignee:input.assignee,status:'proposed',task_id:null,assigned_at:now()},user).id};
 }
 if(action==='commitment.revise'||action==='commitment.withdraw'){
  const item=store.expect(store.read(user,input.id,'commitment'),input.version);store.read(user,item.space,'conversation');
  if(item.owner!==user&&item.data.assignee!==user)fail('FORBIDDEN','仅提议者或负责人可变更',403);
  if(action==='commitment.withdraw')return {id:store.update(item,{...item.data,status:'withdrawn',withdrawn_by:user,withdrawn_at:now()},user).id};
  const due=input.due?new Date(input.due).getTime():null;if(due!==null&&!Number.isFinite(due))fail('INVALID_INPUT','截止日期不正确');
  return {id:store.update(item,{...item.data,goal:string(input.goal,'事项',3000),due:due?new Date(due).toISOString():null,status:item.data.assignee?'proposed':'unassigned',previous_task_id:item.data.task_id||item.data.previous_task_id||null,task_id:item.data.task_id||null},user).id};
 }
 if(action==='assist.followup'){
  const {assist,run,output}=checkedAssistResult(store,user,input);
  const result=taskCommand(store,user,'task.create',{goal:string(input.goal||output.slice(0,8000),'本人跟进事项',8000),mode:'manual',system:'execute',source_refs:run.data.source_refs||[]});
  const task=store.get(result.id);store.update(task,{...task.data,access_space:assist.data.conversation_id,origin_assist:assist.id,origin_run:run.id},user);return result;
 }
 if(action==='assist.save_note'){
  const {assist,run,output}=checkedAssistResult(store,user,input);
  return {id:store.add('knowledge',user,{title:string(input.title||assist.data.purpose,'标题',200),content:output,source_refs:run.data.source_refs,access_space:assist.data.conversation_id,kind:'note',status:'active'}).id};
 }
 return null;
}
