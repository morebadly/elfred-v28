import { fail, now } from './store.mjs';
import { string, enumeration, bounded } from './policy.mjs';
import {resultReceipts} from './agent-plan.mjs';
import {attachmentRefs} from './attachments.mjs';
import {sourceRefs} from './knowledge.mjs';
import { taskCommand } from './runtime.mjs';
import {checkedAssistResult} from './assist-result.mjs';
import {groupAgentReady,requestGroupAgent,shouldProactivelyReply} from './group-agent.mjs';

export function socialCommand(store,user,action,input) {
  const member=(space)=>{const object=store.read(user,space,'conversation');if(!store.role(space,user)) fail('FORBIDDEN','当前不是会话成员',403);return object;};
  if (action==='friend.request') {
    const handle=string(input.handle,'对方账号',80).toLowerCase();
    const target=store.db.prepare('SELECT id FROM users WHERE handle=?').get(handle);
    if (!target || target.id===user) fail('NOT_FOUND','无法向该账号发起申请',404);
    if (store.list('friend').some(item=>item.data.status==='blocked' && [item.owner,item.data.recipient].includes(user) && [item.owner,item.data.recipient].includes(target.id))) fail('NOT_FOUND','无法向该账号发起申请',404);
    const existing=store.list('friend').find(item=>[item.owner,item.data.recipient].includes(user)&&[item.owner,item.data.recipient].includes(target.id)&&['pending','accepted'].includes(item.data.status));
    if(existing) return {id:existing.id};
    const request=store.add('friend',user,{recipient:target.id,intro:string(input.intro||'希望与你建立联系','申请说明',500),status:'pending'},{visibility:'members'});
    store.join(request.id,user,'owner');store.join(request.id,target.id);
    store.add('notification',target.id,{kind:'friend_request',target_id:request.id,status:'unread',summary:'收到一条好友申请'});
    return {id:request.id};
  }
  if (action==='friend.respond') {
    const request=store.expect(store.read(user,input.id,'friend'),input.version);
    const decision=enumeration(input.decision,['accept','decline','withdraw','remove','block'],'关系决定');
    const pair=store.list('friend').filter(item=>[item.owner,item.data.recipient].includes(request.owner)&&[item.owner,item.data.recipient].includes(request.data.recipient));
    if(decision==='accept'&&pair.some(item=>item.data.status==='blocked')) fail('RELATION_UNAVAILABLE','当前关系不可接受',403);
    if(request.data.status==='blocked' && request.data.blocked_by!==user) fail('RELATION_UNAVAILABLE','当前关系不可变更',403);
    if (['accept','decline'].includes(decision) && (request.data.recipient!==user || request.data.status!=='pending')) fail('FORBIDDEN','只能处理发给本人的待处理申请',403);
    if (decision==='withdraw' && (request.owner!==user||request.data.status!=='pending')) fail('FORBIDDEN','只能撤回本人申请',403);
    const status={accept:'accepted',decline:'declined',withdraw:'withdrawn',remove:'removed',block:'blocked'}[decision];
    let conversation;
    if (decision==='accept') {
      conversation=store.add('conversation',request.owner,{title:`${store.user(request.owner).name} · ${store.user(request.data.recipient).name}`,kind:'direct',seq:0,status:'active'},{visibility:'members'});
      store.join(conversation.id,request.owner,'owner');store.join(conversation.id,request.data.recipient);
    }
    if (['remove','block'].includes(decision) && request.data.conversation_id) {
      store.db.prepare('DELETE FROM members WHERE space=?').run(request.data.conversation_id);
    }
    if(decision==='block')for(const relation of pair){
      if(relation.data.conversation_id)store.db.prepare('DELETE FROM members WHERE space=?').run(relation.data.conversation_id);
      if(relation.id!==request.id&&['accepted','pending'].includes(relation.data.status))store.update(relation,{...relation.data,status:'blocked',blocked_by:user},user);
    }
    store.update(request,{...request.data,status,blocked_by:decision==='block'?user:request.data.blocked_by,conversation_id:conversation?.id||request.data.conversation_id},user);
    return {id:request.id,conversation_id:conversation?.id};
  }
  if (action==='conversation.create') {
    const handles=input.handles;
    if(!Array.isArray(handles)||handles.length<1||handles.length>30) fail('INVALID_INPUT','群聊需选择 1—30 位好友');
    const users=[...new Set(handles.map(handle=>{
      const target=store.db.prepare('SELECT id FROM users WHERE handle=?').get(String(handle).toLowerCase());
      if(!target||!store.visible(user,'friend').some(item=>item.data.status==='accepted'&&[item.owner,item.data.recipient].includes(target.id))) fail('FRIEND_REQUIRED','只能添加已接受关系的好友');
      return target.id;
    }))];
    if(input.agent===true&&input.confirm!==true)fail('CONFIRMATION_REQUIRED','创建带 Agent 的群聊前请确认群成员将看到 AI 身份与上下文授权');
    const conversation=store.add('conversation',user,{title:string(input.title,'群名',100),kind:'group',seq:0,status:'active',agent_enabled:input.agent===true,agent_proactive:false,agent_consents:input.agent===true?{[user]:true}:{}},{visibility:'members'});
    store.join(conversation.id,user,'owner');users.forEach(target=>store.join(conversation.id,target));
    return {id:conversation.id};
  }
  if(action==='conversation.agent.start_group'){
    if(input.confirm!==true)fail('CONFIRMATION_REQUIRED','请确认邀请对象、讨论目标和群 Agent 的公开身份');
    const goal=string(input.goal,'群聊目标',1000);
    const created=socialCommand(store,user,'conversation.create',{title:input.title,handles:input.handles,agent:true,confirm:true});
    const conversation=store.get(created.id);
    const invitation=store.add('message',user,{text:`我邀请大家一起讨论：${goal}`,attachments:[],seq:1,human_sender_id:user,sender_name:store.user(user).name,mentions:[],conversation_id:conversation.id},{space:conversation.id,visibility:'members'});
    store.update(conversation,{...conversation.data,seq:1,last_message_id:invitation.id,agent_intro_trigger_id:invitation.id},user);
    return {id:conversation.id};
  }
  if(action==='conversation.agent.configure'||action==='conversation.agent.consent'){
    const conversation=store.expect(member(input.id),input.version);
    if(conversation.data.kind!=='group')fail('INVALID_INPUT','群协作 Agent 仅用于多人群聊');
    if(input.confirm!==true)fail('CONFIRMATION_REQUIRED','请确认群消息可按授权范围交给模型处理');
    if(action==='conversation.agent.consent'){
      const updated=store.update(conversation,{...conversation.data,agent_consents:{...conversation.data.agent_consents,[user]:input.allow===true}},user);
      if(updated.data.agent_intro_trigger_id&&!updated.data.agent_intro_task_id&&groupAgentReady(store,updated)){
        const trigger=store.get(updated.data.agent_intro_trigger_id);
        const initiated=requestGroupAgent(store,updated.owner,updated,trigger);
        store.update(store.get(updated.id),{...store.get(updated.id).data,agent_intro_task_id:initiated.task_id},user);
        return {id:updated.id,...initiated};
      }
      return {id:updated.id};
    }
    if(conversation.owner!==user)fail('FORBIDDEN','只有群主可开启或设置群协作 Agent',403);
    const enabled=input.enabled===true;
    return {id:store.update(conversation,{...conversation.data,agent_enabled:enabled,agent_proactive:enabled&&input.proactive===true,agent_consents:enabled?{...conversation.data.agent_consents,[user]:true}:conversation.data.agent_consents||{}},user).id};
  }
  if (action==='conversation.remove_member') {
    const conversation=store.expect(member(input.id),input.version);
    if(conversation.data.kind!=='group')fail('INVALID_INPUT','私聊关系请从好友管理处理');
    if (input.user_id!==user && conversation.owner!==user) fail('FORBIDDEN','只有群主可移除其他成员',403);
    if (conversation.owner===input.user_id) fail('OWNER_REQUIRED','群主需先将管理权移交给当前成员');
    store.db.prepare('DELETE FROM members WHERE space=? AND user_id=?').run(conversation.id,input.user_id);
    for(const item of store.list('commitment').filter(c=>c.space===conversation.id&&c.data.assignee===input.user_id&&c.data.status!=='withdrawn')){
      const task=store.get(item.data.task_id);if(task){store.update(task,{...task.data,access_space:conversation.id},user);for(const run of store.list('run').filter(r=>r.data.task_id===task.id))store.update(run,{...run.data,access_space:conversation.id},user);}
      store.update(item,{...item.data,previous_assignee:item.data.assignee,previous_task_id:item.data.task_id||null,task_id:null,assignee:null,status:'unassigned',changed_reason:'负责人已离群，等待重新指定'},user);
    }
    return {id:store.update(conversation,{...conversation.data,membership_updated:now()},user).id};
  }
  if(action==='conversation.transfer_owner'||action==='conversation.history_policy'){
    const conversation=store.expect(member(input.id),input.version);
    if(conversation.data.kind!=='group'||conversation.owner!==user)fail('FORBIDDEN','仅当前群主可管理此项',403);
    if(input.confirm!==true)fail('CONFIRMATION_REQUIRED','请确认群管理规则变化');
    if(action==='conversation.history_policy')return {id:store.update(conversation,{...conversation.data,history_policy:enumeration(input.policy,['all','from_join'],'新成员历史范围')},user).id};
    if(input.user_id===user||!store.role(conversation.id,input.user_id))fail('INVALID_ASSIGNEE','请选择另一位当前群成员');
    store.db.prepare('UPDATE members SET role=CASE WHEN user_id=? THEN ? ELSE ? END WHERE space=?').run(input.user_id,'owner','member',conversation.id);
    store.db.prepare('UPDATE objects SET owner=? WHERE id=?').run(input.user_id,conversation.id);
    return {id:store.update(conversation,{...conversation.data,ownership_changed_at:now()},user).id};
  }
  if(action==='conversation.rename'||action==='conversation.invite') {
    const conversation=store.expect(member(input.id),input.version);
    if(conversation.data.kind!=='group'||conversation.owner!==user)fail('FORBIDDEN','仅群主可管理群聊',403);
    if(action==='conversation.rename')return {id:store.update(conversation,{...conversation.data,title:string(input.title,'群名',100)},user).id};
    const handle=string(input.handle,'好友账号',80).toLowerCase();
    const target=store.db.prepare('SELECT id FROM users WHERE handle=?').get(handle);
    if(!target||!store.visible(user,'friend').some(item=>item.data.status==='accepted'&&[item.owner,item.data.recipient].includes(target.id)))fail('FRIEND_REQUIRED','请选择已经接受关系的好友');
    if(store.role(conversation.id,target.id))fail('ALREADY_MEMBER','该好友已在群内');
    if(store.members(conversation.id).length>=31)fail('GROUP_FULL','群聊最多 31 位成员');
    store.join(conversation.id,target.id);
    const minSeq=conversation.data.history_policy==='from_join'?conversation.data.seq+1:0;
    store.db.prepare('INSERT INTO member_history VALUES(?,?,?) ON CONFLICT(space,user_id) DO UPDATE SET min_seq=excluded.min_seq').run(conversation.id,target.id,minSeq);
    store.db.prepare('INSERT INTO read_cursors VALUES(?,?,?) ON CONFLICT(space,user_id) DO UPDATE SET seq=MAX(seq,excluded.seq)').run(conversation.id,target.id,Math.max(0,minSeq-1));
    return {id:store.update(conversation,{...conversation.data,membership_updated:now()},user).id};
  }
  if (action==='message.send') {
    const conversation=member(input.id),attachments=attachmentRefs(store,user,input.attachment_ids||[],input.id),text=string(input.text,'消息',10000,attachments.length>0);
    if(input.actor_type==='agent')fail('HUMAN_REQUIRED','真人消息不能伪装为 Agent；群协作 Agent 由受控任务发布',403);
    const sharedRecord=input.shared_record_id?store.read(user,input.shared_record_id,'shared_record'):null;
    if(sharedRecord&&(sharedRecord.space!==conversation.id||sharedRecord.data.status!=='active'))fail('INVALID_CONTEXT','只能分享当前会话的有效记录');
    const mentions=input.mentions||[];
    if (!Array.isArray(mentions)||mentions.some(target=>!store.role(conversation.id,target))) fail('INVALID_MENTION','只能提及当前真人成员');
    const seq=conversation.data.seq+1;
    const message=store.add('message',user,{text,attachments,seq,human_sender_id:user,sender_name:store.user(user).name,mentions,conversation_id:conversation.id,...(sharedRecord?{shared_record_id:sharedRecord.id,record_version:sharedRecord.version,record_sources:sharedRecord.data.source_refs||[]}:{})},{space:conversation.id,visibility:'members'});
    store.update(conversation,{...conversation.data,seq,last_message_id:message.id},user);
    for (const target of new Set(mentions.filter(target=>target!==user))) store.unique('notification',`${message.id}:${target}`,()=>store.add('notification',target,{kind:'mention',target_id:message.id,status:'unread',summary:'有人在会话中提及你'}));
    let agent;
    if(conversation.data.kind==='group'&&(input.agent_mention===true||shouldProactivelyReply(store,conversation,message))){
      if(!groupAgentReady(store,conversation))fail('GROUP_AGENT_CONSENT','群 Agent 尚未获得全体当前成员授权');
      agent=requestGroupAgent(store,user,store.get(conversation.id),message,{proactive:input.agent_mention!==true});
    }
    return {id:message.id,...(agent||{})};
  }
  if (action==='conversation.read') {
    const conversation=member(input.id);
    const seq=bounded(input.seq,'已读序列',0,conversation.data.seq);
    store.db.prepare('INSERT INTO read_cursors VALUES(?,?,?) ON CONFLICT(space,user_id) DO UPDATE SET seq=MAX(seq,excluded.seq)').run(conversation.id,user,seq);
    return {id:conversation.id};
  }
  if (action==='draft.save') {
    member(input.conversation_id);
    if(!Number.isInteger(input.version)||input.version<0) fail('VERSION_REQUIRED','保存草稿必须提交所编辑的版本',409);
    const existing=store.visible(user,'draft').find(item=>item.data.conversation_id===input.conversation_id);
    if(input.version===0&&existing) fail('VERSION_CONFLICT','草稿已在其他页面创建，请重新打开会话后核对',409);
    const draft=existing||store.unique('draft',`${input.conversation_id}:${user}`,()=>store.add('draft',user,{conversation_id:input.conversation_id,text:'',previous:''}));
    if(input.version>0) store.expect(draft,input.version);
    if(typeof input.text!=='string'||input.text.length>10000) fail('INVALID_INPUT','草稿过长');
    const updated=store.update(draft,{...draft.data,text:input.text,previous:draft.data.text},user);
    return {id:updated.id,version:updated.version};
  }
  if (action==='assist.create') {
    member(input.conversation_id);
    const purpose=string(input.purpose,'辅助目的',3000);
    const entry=enumeration(input.entry||'personal',['personal','icebreaker'],'辅助入口');
    // Selecting a capability creates only a private session. Execution is a separate command.
    const parent=input.parent_id?store.owned(user,input.parent_id,'assist'):null;
    if(parent){const task=store.get(parent.data.task_id);if(!task||!['completed','awaiting_review','awaiting_acceptance','partial','paused','cancelled','failed','blocked'].includes(task.data.status))fail('RUN_ACTIVE','上一轮辅助尚未完成，请先等待结果或停止');}
    if(parent&&(parent.data.conversation_id!==input.conversation_id||parent.data.entry!==entry))fail('INVALID_CONTEXT','只能继续当前会话的本人辅助');
    return {id:store.add('assist',user,{conversation_id:input.conversation_id,purpose,entry,parent_id:parent?.id||null,status:'composing'}).id};
  }
  if (action==='assist.run') {
    const assist=store.expect(store.owned(user,input.id,'assist'),input.version);
    member(assist.data.conversation_id);
    if(assist.data.task_id) fail('ASSIST_ALREADY_STARTED','请查看原辅助任务或创建新的辅助请求',409);
    const refs=sourceRefs(store,user,input.source_refs||[]);
    for(const ref of refs){const source=store.read(user,ref.id);if(!['message','post','knowledge','document','memory','resource','shared_record','commitment','draft'].includes(source.type)||(['message','shared_record','commitment'].includes(source.type)&&source.space!==assist.data.conversation_id)||(source.type==='draft'&&(source.owner!==user||source.data.conversation_id!==assist.data.conversation_id)))fail('INVALID_CONTEXT','请选择本会话消息或本人可访问的资料');}
    if(input.confirm!==true||input.model_consent!==true)fail('CONSENT_REQUIRED','请确认将请求和所选资料交给模型');
    const history=[];let cursor=assist.data.parent_id;
    while(cursor&&history.length<4){
      const previous=store.owned(user,cursor,'assist');
      if(previous.data.conversation_id!==assist.data.conversation_id)fail('INVALID_CONTEXT','辅助上下文不属于当前会话');
      if(!previous.data.run_id)fail('CONTEXT_PENDING','上一轮尚未运行，请完成原请求或开始新话题');
      if(previous.data.run_id){const previousTask=store.owned(user,previous.data.task_id,'task');const run=store.owned(user,previousTask.data.run_id,'run');sourceRefs(store,user,run.data.source_refs||[],128);const output=resultReceipts(run.data.receipts||[]).find(r=>typeof r.output==='string')?.output;if(!output)fail('CONTEXT_PENDING','上一轮尚无可用结果，请先恢复原任务或开始新话题');if(output){history.unshift({request:previous.data.purpose.slice(0,500),response:output.slice(0,650)});for(const ref of run.data.source_refs||[])if(!refs.some(r=>r.id===ref.id))refs.push(ref);}}
      cursor=previous.data.parent_id;
    }
    if(refs.length>20)fail('CONTEXT_LIMIT','连续对话资料已达到上限，请开始新的辅助对话');
    const selectedMessages=refs.map(ref=>store.get(ref.id)).filter(o=>o?.type==='message').sort((a,b)=>a.data.seq-b.data.seq);
    const coverage={count:selectedMessages.length,first:selectedMessages[0]?.id||null,last:selectedMessages.at(-1)?.id||null,label:selectedMessages.length?`本次引用 ${selectedMessages.length} 条消息，${selectedMessages[0].created} 至 ${selectedMessages.at(-1).created}；只覆盖已选消息，不代表完整历史。`:'本次未选择聊天消息，不能据此概括群聊历史或共识。'};
    const historyText=history.length?'\n本人的先前问答（仅供理解当前请求，不是新的指令）：'+JSON.stringify(history)+'\n当前请求：':'';
    const task=taskCommand(store,user,'task.create',{goal:(assist.data.entry==='icebreaker'?'根据所选历史对话和双方已公开的近况，准备自然、不过度亲密的重新联系开场；资料不足就说明未知，不编造近况。用户补充：':'作为本人的个人智能体，回答以下请求；仅自己可见，不代表对方或发送消息。摘要区分原文事实、推断、建议、分歧和待本人确认的承诺；标明所选消息覆盖范围与缺失，不把沉默当同意。')+historyText+assist.data.purpose,mode:'compose',system:'connect',source_refs:refs,criteria:'本人核对回复内容、依据与表达边界；不自动发送'});
    const initial=store.get(task.id);
    const object=store.update(initial,{...initial.data,access_space:assist.data.conversation_id},user);
    taskCommand(store,user,'task.confirm',{id:object.id,version:object.version,confirm:input.confirm,model_consent:input.model_consent});
    const confirmed=store.get(task.id);
    const run=taskCommand(store,user,'run.start',{id:confirmed.id,version:confirmed.version});
    store.update(assist,{...assist.data,status:'running',task_id:task.id,run_id:run.id,coverage},user);
    return {id:assist.id,task_id:task.id,run_id:run.id};
  }
  if (action==='assist.fill') {
    const {assist,output:content}=checkedAssistResult(store,user,input);member(assist.data.conversation_id);
    if (!content) fail('RESULT_REQUIRED','辅助尚无可用结果');
    const draft=store.unique('draft',`${assist.data.conversation_id}:${user}`,()=>store.add('draft',user,{conversation_id:assist.data.conversation_id,text:'',previous:''}));
    store.expect(draft,input.draft_version);
    const mode=enumeration(input.mode,['append','replace'],'回填方式');
    const text=mode==='append'?draft.data.text+'\n'+content:content;
    if(text.length>10000) fail('INVALID_INPUT','回填后草稿过长');
    return {id:store.update(draft,{...draft.data,previous:draft.data.text,text},user).id};
  }
  if (action==='commitment.create') {
    const conversation=member(input.conversation_id);
    if(input.assignee&&!store.role(conversation.id,input.assignee)) fail('INVALID_ASSIGNEE','负责人必须是当前成员');
    const due=input.due?new Date(input.due).getTime():null;if(due!==null&&!Number.isFinite(due))fail('INVALID_INPUT','截止时间不正确');
    return {id:store.add('commitment',user,{due:due?new Date(due).toISOString():null,goal:string(input.goal,'候选事项',3000),assignee:input.assignee||null,status:input.assignee?'proposed':'unassigned'},{space:conversation.id,visibility:'members'}).id};
  }
  if (action==='commitment.respond') {
    const item=store.expect(store.read(user,input.id,'commitment'),input.version);member(item.space);
    if(item.data.assignee!==user) fail('FORBIDDEN','只能确认本人的承诺',403);
    if(item.data.status!=='proposed') fail('INVALID_STATE','事项已处理',409);
    let task;
    if(input.accept===true){
      const existing=item.data.task_id?store.owned(user,item.data.task_id,'task'):null;
      if(existing&&['queued','running','cancel_requested','pause_requested'].includes(existing.data.status))fail('RUN_ACTIVE','请先停止原任务，再确认变更');
      if(existing)task={id:store.update(existing,{...existing.data,goal:item.data.goal,title:item.data.goal.slice(0,80),due:item.data.due,status:'draft',approval_id:null,run_id:null,outcome_id:null,artifact_id:null,feedback:null,feedback_pending:false,execution_revision:(existing.data.execution_revision||0)+1,history:[...(existing.data.history||[]),{goal:existing.data.goal,run_id:existing.data.run_id,outcome_id:existing.data.outcome_id,artifact_id:existing.data.artifact_id,status:existing.data.status,feedback:existing.data.feedback}],commitment_id:item.id},user).id};
      else {task=taskCommand(store,user,'task.create',{goal:item.data.goal,mode:'compose',system:'execute'});const created=store.get(task.id);store.update(created,{...created.data,due:item.data.due,commitment_id:item.id,access_space:item.space},user);}
    }
    store.update(item,{...item.data,status:task?'accepted':'declined',task_id:task?.id||null},user);
    return {id:item.id,task_id:task?.id};
  }
  return null;
}
