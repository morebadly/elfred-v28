import {collaborationLimit} from './review-policy.mjs';
import {fail,now} from './store.mjs';
import {string,enumeration} from './policy.mjs';
import {sourceRefs} from './knowledge.mjs';
import {selectCapability} from './capability-selector.mjs';
const systems=['owner','explore','advise','create','connect','execute'];
export function checkContextUse(store,task,refs=task.data.source_refs){
 const seen=new Set();
 const visit=refs=>{for(const ref of refs||[]){if(seen.has(ref.id))continue;seen.add(ref.id);if(seen.size>256)fail('CONTEXT_LIMIT','资料来源链过长，请重新整理范围');const grant=store.get(ref.id);if(!grant)fail('SOURCE_INVALID','来源已不可访问');
  if(grant.type!=='context_grant'){visit(grant.data.source_refs);continue;}
  if(grant.data.task_id!==task.id||grant.data.requester!==task.data.system)fail('CONTEXT_SCOPE','这份上下文仅授权给原任务和原主责系统',403);
  if(grant.data.status!=='active'||grant.data.expires<=Date.now())fail('CONTEXT_EXPIRED','资料授权已到期或撤销，请重新确认',403);
  const request=store.get(grant.data.request_id);if(!request||!['fulfilled','partial'].includes(request.data.status))fail('CONTEXT_REVOKED','原资料请求已撤销',403);
  visit(grant.data.source_refs);
 }};visit(refs);
}
export function contextCommand(store,user,action,input){
 if(action==='task.reopen_context'){
  const task=store.get(input.id);if(!task||task.type!=='task'||task.owner!==user||!store.canRead(user,{...task,data:{...task.data,source_refs:[]}}))fail('NOT_FOUND','原任务不可访问',404);store.expect(task,input.version);
  if(task.data.media_operation||task.data.internal_search)fail('INVALID_STATE','专项任务请回到原入口重新核对范围');
  if(input.confirm!==true)fail('CONFIRMATION_REQUIRED','请确认清空本次资料选择并重新核对，保留历史用量');
  if(!['draft','ready','blocked','failed','partial','paused','cancelled'].includes(task.data.status)||store.list('run').some(r=>r.data.task_id===task.id&&['queued','running','pause_requested','cancel_requested'].includes(r.data.status)))fail('INVALID_STATE','请先停止任务，再重选资料');
  if(store.db.prepare("SELECT id FROM usage WHERE task_id=? AND status='unknown'").get(task.id))fail('RECONCILIATION_REQUIRED','先核对上次未知用量，再更换范围');
  for(const approval of store.list('approval').filter(a=>a.data.task_id===task.id&&a.data.status==='approved'))store.update(approval,{...approval.data,status:'revoked'},user);
  for(const request of store.list('context_request').filter(r=>r.data.task_id===task.id&&!['revoked','denied'].includes(r.data.status))){store.update(request,{...request.data,status:'revoked',revoked_at:now()},user);for(const grant of store.list('context_grant').filter(g=>g.data.request_id===request.id))store.update(grant,{...grant.data,status:'revoked'},user);}
  return {id:store.update(task,{...task.data,status:'draft',approval_id:null,run_id:null,source_refs:[],collaboration_steps:[],reviewer_system:null,feedback:null,feedback_pending:false,execution_revision:(task.data.execution_revision||0)+1,context_history:[...(task.data.context_history||[]),{source_refs:task.data.source_refs,run_id:task.data.run_id,at:now()}]},user).id};
 }
 if(action==='task.collaboration'){
  const task=store.expect(store.owned(user,input.id,'task'),input.version);if(task.data.status!=='draft'||task.data.mode!=='compose'||task.data.media_operation)fail('INVALID_STATE','仅普通生成任务的草稿可配置协作');
  if(input.confirm!==true)fail('CONFIRMATION_REQUIRED','请核对每个参与系统的目标和所选资料');
  if(!Array.isArray(input.steps))fail('INVALID_INPUT','请提供协作步骤列表');
  const reviewerSystem=input.reviewer_system?enumeration(input.reviewer_system,systems.slice(1),'复核系统'):null;
  const stepLimit=collaborationLimit({...task,data:{...task.data,reviewer_system:reviewerSystem}});if(input.steps.length>stepLimit)fail('BUDGET_EXHAUSTED','协作步骤超出本次可执行范围，需为主责、复核保留预算和计划位置');
  const ids=new Set();const steps=input.steps.map(step=>{const key=string(step.id,'步骤标识',60);if(!/^[a-z][a-z0-9_-]*$/.test(key)||ids.has(key))fail('INVALID_INPUT','步骤标识不合法或重复');const system=enumeration(step.system,systems.slice(1),'参与系统');if(system===task.data.system)fail('INVALID_INPUT','协作步骤应选择另一系统，主责结果由当前系统交付');
   if(store.visible(user,'settings')[0]?.data.agents?.[system]?.enabled===false)fail('AGENT_DISABLED','所选协作系统已停用');
   const refs=sourceRefs(store,user,step.source_refs||[],10);if(refs.some(r=>!task.data.source_refs.some(main=>main.id===r.id&&main.version===r.version)))fail('CONTEXT_SCOPE','协作资料必须是当前任务已经选择的来源');
   for(const ref of refs){const source=store.get(ref.id);if(source.type==='memory'&&!['owner',system].includes(source.data.scope))fail('CONTEXT_SCOPE','此系统不能直接读取另一系统的理解，请使用经核对的摘要');}
   checkContextUse(store,{...task,data:{...task.data,system}},refs);
   const depends=step.depends||[];if(!Array.isArray(depends)||depends.some(d=>!ids.has(d)))fail('INVALID_DEPENDENCY','只能依赖前面的协作步骤');ids.add(key);
   const goal=string(step.goal,'协作目标',2000),selected=selectCapability(system,goal),prior=task.data.collaboration_steps?.find(s=>s.id===key&&s.system===system);return {id:key,system,goal,depends:[...new Set(depends)],source_refs:refs,capability:selected.capability,...(prior?.parameter_values?{parameter_values:prior.parameter_values}:{})};});
  if(steps.length+1>task.data.stop.maxCalls||(steps.length+1)*1000>task.data.stop.maxUnits)fail('BUDGET_EXHAUSTED','当前预算不足以完成所选协作和主责步骤');
  if(reviewerSystem){if(store.visible(user,'settings')[0]?.data.agents?.[reviewerSystem]?.enabled===false)fail('AGENT_DISABLED','所选复核系统已停用');if(steps.length+2>task.data.stop.maxCalls||(steps.length+2)*1000>task.data.stop.maxUnits)fail('BUDGET_EXHAUSTED','当前预算不足以完成协作、主责和所选复核');checkContextUse(store,{...task,data:{...task.data,system:reviewerSystem}});}
  return {id:store.update(task,{...task.data,collaboration_steps:steps,reviewer_system:reviewerSystem,collaboration_confirmed_at:now()},user).id};
 }
 if(action==='task.route'){
  const task=store.expect(store.owned(user,input.id,'task'),input.version);if(task.data.status!=='draft')fail('INVALID_STATE','转交前请保留为未授权的任务草稿');
  if(input.confirm!==true)fail('CONFIRMATION_REQUIRED','请确认最终成果由哪个系统负责');
  const system=enumeration(input.system,systems.slice(1),'主责系统');if(store.visible(user,'settings')[0]?.data.agents?.[system]?.enabled===false)fail('AGENT_DISABLED','该系统已停用');
  if(task.data.source_refs.some(r=>store.get(r.id)?.type==='context_grant'))fail('CONTEXT_SCOPE','已有任务专用资料授权，请先撤销后重新选择主责');
  checkContextUse(store,{...task,data:{...task.data,system}});
  const selected=selectCapability(system,task.data.goal);
  return {id:store.update(task,{...task.data,system,routing_suggestion:null,capability:selected.capability,capability_selection:selected.selection,collaboration_steps:[],reviewer_system:null,collaboration_confirmed_at:null,routing_history:[...(task.data.routing_history||[]),{from:task.data.system,to:system,reason:string(input.reason,'转交说明',1000),at:now()}]},user).id};
 }
 if(!action.startsWith('context.'))return null;
 if(action==='context.request'){
  const task=store.expect(store.owned(user,input.task_id,'task'),input.task_version);if(task.data.status!=='draft')fail('INVALID_STATE','请在任务确认前选择所需资料');
  const holder=enumeration(input.holder,systems,'资料归属'),fields=input.fields;
  if(!Array.isArray(fields)||!fields.length||fields.some(f=>!['title','content','summary','text','goal'].includes(f)))fail('INVALID_INPUT','请选择需要的文字字段');
  const expires=Date.parse(input.expires);if(!Number.isFinite(expires)||expires<=Date.now()||expires>Date.now()+30*86400000)fail('INVALID_INPUT','有效期需在未来 30 天内');
  return {id:store.add('context_request',user,{task_id:task.id,access_space:task.data.access_space,requester:task.data.system,holder,purpose:string(input.purpose,'用途',1000),fields:[...new Set(fields)],use_scope:'仅此任务，不对外共享',external_sharing:false,expires,status:'pending'}).id};
 }
 const request=store.expect(store.owned(user,input.id,'context_request'),input.version),task=action==='context.revoke'?store.get(request.data.task_id):store.owned(user,request.data.task_id,'task');
 if(!task||task.owner!==user)fail('NOT_FOUND','原任务不可访问',404);
 if(action==='context.revoke'){
  for(const grant of store.list('context_grant').filter(g=>g.data.request_id===request.id))store.update(grant,{...grant.data,status:'revoked'},user);
  if(task.data.status==='draft')store.update(task,{...task.data,source_refs:task.data.source_refs.filter(r=>store.get(r.id)?.data.request_id!==request.id)},user);
  return {id:store.update(request,{...request.data,status:'revoked',revoked_at:now()},user).id};
 }
 if(action!=='context.respond')return null;
 if(request.data.status!=='pending')fail('INVALID_STATE','此请求已处理');
 if(request.data.expires<=Date.now())fail('CONTEXT_EXPIRED','请求已过期，请重新提出');
 const decision=enumeration(input.decision,['fulfill','partial','deny','supplement'],'资料响应');
 const note=string(input.note,'响应说明',1000);
 if(['deny','supplement'].includes(decision))return {id:store.update(request,{...request.data,status:decision==='deny'?'denied':'needs_input',note},user).id};
 if(input.confirm!==true)fail('CONFIRMATION_REQUIRED','请确认所选字段及本次任务范围');
 if(task.data.status!=='draft'||task.data.system!==request.data.requester)fail('CONTEXT_SCOPE','原任务已确认或主责变化，请重新请求');
 const refs=sourceRefs(store,user,input.source_refs,10);if(!refs.length)fail('SOURCE_REQUIRED','请至少选择一项资料');
 const selected=refs.map(ref=>{const object=store.read(user,ref.id);if(!['memory','knowledge','document','resource'].includes(object.type))fail('INVALID_CONTEXT','请选择理解、笔记、文档或资源');
  if(object.type==='memory'&&object.data.scope!==request.data.holder)fail('CONTEXT_SCOPE','理解条目不属于所选持有方');
  const fields=input.fields||request.data.fields;if(!Array.isArray(fields)||!fields.length||fields.some(f=>!request.data.fields.includes(f)))fail('CONTEXT_SCOPE','不能扩大请求的字段范围');
  const values=Object.fromEntries(fields.filter(f=>typeof object.data[f]==='string').map(f=>[f,object.data[f]]));if(!Object.keys(values).length)fail('SOURCE_REQUIRED','所选资料没有请求的字段');return {ref,fields:values};});
 const content=JSON.stringify(selected);if(content.length>10000)fail('CONTEXT_LIMIT','所选字段过长，请减少资料或改用摘要字段');
 if(task.data.source_refs.length>=20)fail('CONTEXT_LIMIT','任务资料已满，请减少后再授权');
 const grant=store.add('context_grant',user,{title:'本次任务的最小上下文',content,task_id:task.id,request_id:request.id,requester:request.data.requester,holder:request.data.holder,purpose:request.data.purpose,source_refs:refs,access_space:task.data.access_space,expires:request.data.expires,status:'active',external_sharing:false});
 store.update(task,{...task.data,source_refs:[...task.data.source_refs,{id:grant.id,version:grant.version}]},user);
 return {id:store.update(request,{...request.data,status:decision==='partial'?'partial':'fulfilled',note,grant_id:grant.id,responded_at:now()},user).id,grant_id:grant.id};
}
