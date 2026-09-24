import {fail,now} from './store.mjs';
import {string} from './policy.mjs';
import {assistResult} from './assist-result.mjs';
import {socialCommand} from './social.mjs';
import {communityCommand} from './community.mjs';

export function handoffCommand(store,user,action,input){
 if(!['assist.share_record','assist.calendar','assist.project_brief'].includes(action))return null;
 if(input.actor_type==='agent')fail('HUMAN_REQUIRED','由本人核对并确认去向');
 const {assist,conversation,run}=assistResult(store,user,input.id);
 if(input.run_id!==run.id)fail('RESULT_CHANGED','当前辅助运行已变化，请重新预览当前结果');
 store.expect(assist,input.version);store.expect(run,input.run_version);
 if(input.confirm!==true)fail('CONFIRMATION_REQUIRED','请核对内容、来源和接收范围');
 const title=string(input.title,'标题',200),content=string(input.content,'核对后的正文',8000);
 let result;
 if(action==='assist.share_record'){
  if(input.reviewed_summary!==true)fail('SHARING_REVIEW_REQUIRED','请确认文字可分享给当前会话；私人引用不自动附带');
  const refs=input.source_refs||[];if(!Array.isArray(refs)||refs.length>20)fail('INVALID_INPUT','最多选择 20 条当前会话消息');
  const sources=refs.map(ref=>{const msg=store.expect(store.read(user,ref.id,'message'),ref.version);if(msg.space!==conversation.id)fail('INVALID_CONTEXT','共享纪要只能附当前会话消息');return {id:msg.id,version:msg.version};});
  const record=store.add('shared_record',user,{title,content,kind:'minutes',status:'active',source_refs:sources,confirmed_by:user,confirmed_at:now(),commitments_status:'awaiting_individual_confirmation'},{space:conversation.id,visibility:'members'});
  result=socialCommand(store,user,'message.send',{id:conversation.id,text:title+'\n'+content,shared_record_id:record.id});
  result={...result,target_id:record.id,message_id:result.id};
 }else if(action==='assist.calendar'){
  const start=Date.parse(input.start),end=Date.parse(input.end);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)fail('INVALID_INPUT','请填写明确的开始和结束时间，结束需晚于开始');
  const note=store.add('knowledge',user,{title,content,kind:'calendar_draft',calendar:{start:new Date(start).toISOString(),end:new Date(end).toISOString(),destination:'ics-export',status:'draft'},status:'active',access_space:conversation.id,source_refs:run.data.source_refs||[]});
  result={id:note.id,target_id:note.id};
 }else{
  if(input.reviewed_summary!==true)fail('SHARING_REVIEW_REQUIRED','请确认此摘要适合带到共创编辑草稿；原聊天和私人引用不自动带出');
  result=communityCommand(store,user,'project.create',{title,goal:content,criteria:input.criteria,task:input.open_task,participation:'application'});
  result={...result,target_id:result.id};
 }
 // The provenance link is private and separately revocable. Never expose the
 // originating private conversation or model context on a public project.
 const link=store.add('handoff',user,{conversation_id:conversation.id,access_space:conversation.id,assist_id:assist.id,run_id:run.id,target_id:result.target_id,message_id:result.message_id||null,kind:action.split('.')[1],title,source_refs:run.data.source_refs||[],status:'active'});
 return {...result,handoff_id:link.id};
}
