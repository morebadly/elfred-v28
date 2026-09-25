"use client";
import {useRuntime,entityRef} from '../../core/runtime-context';
import {Action} from '../../core/runtime-panels';
import type {Entity} from '../live/types';

export function GroupAgentPanel({conversation}:{conversation:Entity}){
  const runtime=useRuntime(),user=runtime?.snapshot?.user;
  if(!runtime?.snapshot||!user||conversation.data.kind!=='group')return null;
  const consents=(conversation.data.agent_consents||{}) as Record<string,boolean>;
  const enabled=conversation.data.agent_enabled===true,ready=enabled&&conversation.members?.every(member=>consents[member.id]);
  return <section className="v277-edit-card" aria-label="群协作 Agent 设置">
    <h3>Elfred · 群协作 Agent</h3>
    <p>以 AI 身份在群里回答牵线、日程、问题推进和共识整理。每次最多读取当前群可见的最近 20 条真人消息；不会读取成员私有资料。回复公开给群成员，个人承诺仍由本人确认。</p>
    {!enabled&&conversation.owner===user.id&&<Action run={()=>runtime.command('conversation.agent.configure',{...entityRef(conversation),enabled:true,proactive:false,confirm:true})}>将 Elfred 加入群聊</Action>}
    {enabled&&<><p>{ready?'全体成员已同意，群 Agent 可以参与。':'等待当前成员逐一同意后，Agent 才能读取并回复。'}</p>
      {conversation.members?.map(member=><p key={member.id}>{member.name} · {consents[member.id]?'已同意':'待同意'}</p>)}
      <Action run={()=>runtime.command('conversation.agent.consent',{...entityRef(conversation),allow:!consents[user.id],confirm:true})}>{consents[user.id]?'撤回我的群消息授权':'同意群 Agent 读取群消息'}</Action>
      {conversation.owner===user.id&&<><Action run={()=>runtime.command('conversation.agent.configure',{...entityRef(conversation),enabled:true,proactive:!conversation.data.agent_proactive,confirm:true})}>{conversation.data.agent_proactive?'关闭':'开启'}协作议题主动提醒（每小时最多 3 次）</Action><Action run={()=>runtime.command('conversation.agent.configure',{...entityRef(conversation),enabled:false,proactive:false,confirm:true})}>将 Elfred 移出群聊</Action></>}</>}
    {!runtime.snapshot.provider.configured&&<p role="status">模型服务未配置。@ 请求会保留为待配置任务，不会显示虚构回复。</p>}
  </section>;
}
