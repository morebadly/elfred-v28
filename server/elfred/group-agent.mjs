import {fail,now} from './store.mjs';
import {taskCommand} from './runtime.mjs';
import {resultReceipts} from './agent-plan.mjs';

export function groupAgentReady(store,conversation){
  return conversation?.data.kind==='group'&&conversation.data.agent_enabled===true&&
    store.members(conversation.id).every(member=>conversation.data.agent_consents?.[member.id]===true);
}

export function requestGroupAgent(store,user,conversation,trigger,{proactive=false}={}){
  if(!groupAgentReady(store,conversation))fail('GROUP_AGENT_CONSENT','需要全体当前成员同意群 Agent 读取群消息');
  const messages=store.visible(user,'message').filter(item=>item.space===conversation.id&&item.data.actor_type!=='agent')
    .sort((a,b)=>Number(a.data.seq)-Number(b.data.seq)).slice(-20);
  const refs=messages.map(item=>({id:item.id,version:item.version}));
  const goal=`你是当前群聊中明确标识的 Elfred 协作 Agent。群名：${conversation.data.title}。群内请求：${trigger.data.text}。
只使用本次提供的群消息，直接给群成员一条简短、有用的回复。优先处理牵线介绍、日程协调、问题推进或共识整理；说明分歧、未知和待确认事项。不要冒充真人，不代表任何成员接受任务、确认日程或同意牵线。回复将以 Agent 身份公开发到本群。`;
  const created=taskCommand(store,user,'task.create',{goal,system:'connect',source_refs:refs,review_mode:'single',criteria:'群内可读的协作回复，区分已说事实与待成员确认事项',constraints:'仅可用本群当前可见消息；不读取成员私库，不代表成员承诺；回复明确标识 AI 身份',stop:{maxCalls:1,maxTokens:8000,maxUnits:1000,maxSeconds:90,maxAttempts:1,maxReplans:1}});
  let task=store.get(created.id);
  task=store.update(task,{...task.data,access_space:conversation.id,group_agent:{conversation_id:conversation.id,trigger_id:trigger.id,proactive,requested_at:now()}},user);
  taskCommand(store,user,'task.confirm',{id:task.id,version:task.version,confirm:true,model_consent:true});
  task=store.get(task.id);
  const run=taskCommand(store,user,'run.start',{id:task.id,version:task.version});
  return {task_id:task.id,run_id:run.id};
}

export function shouldProactivelyReply(store,conversation,message){
  if(!conversation.data.agent_proactive||!groupAgentReady(store,conversation))return false;
  if(!/(日程|几点|哪天|什么时候|约(?:个|在|一下|时间|见面|会议)|安排(?:时间|日程|会议|分工)|分工|谁负责|共识|结论|总结(?:一下|下)|介绍(?:给|认识)|牵线|协调)/.test(message.data.text))return false;
  const recent=store.list('task').filter(task=>task.data.group_agent?.conversation_id===conversation.id&&Date.now()-Date.parse(task.created)<3600000);
  if(recent.length>=3)return false;
  const last=recent[0];
  return !last||Number(message.data.seq)-Number(store.get(last.data.group_agent.trigger_id)?.data.seq||0)>=3;
}

export function publishGroupAgentReply(store,task,run,status){
  if(!task.data.group_agent||!['completed','awaiting_review'].includes(status))return;
  if(status==='awaiting_review'&&(run.data.verification?.failures||[]).some(failure=>failure.kind!=='human_review_required'))return;
  const conversation=store.get(task.data.group_agent.conversation_id);
  if(!groupAgentReady(store,conversation)||!store.role(conversation.id,task.owner))return;
  const output=resultReceipts(run.data.receipts||[]).find(receipt=>typeof receipt.output==='string')?.output?.trim();
  if(!output)return;
  const key=`${conversation.id}:${run.id}`;
  const message=store.unique('message',`group-agent:${key}`,()=>{
    const current=store.get(conversation.id),seq=current.data.seq+1;
    const posted=store.add('message',task.owner,{text:output.slice(0,10000),seq,actor_type:'agent',sender_name:'Elfred · 群协作 Agent',conversation_id:current.id,trigger_id:task.data.group_agent.trigger_id,task_id:task.id,run_id:run.id,source_refs:(run.data.source_refs||[]).filter(ref=>store.get(ref.id)?.type==='message'),disclaimer:'AI 协作建议；日程、介绍和个人承诺须由相关成员确认',attachments:[],mentions:[]},{space:current.id,visibility:'members'});
    store.update(current,{...current.data,seq,last_message_id:posted.id},task.owner);
    return posted;
  });
  return message.id;
}
