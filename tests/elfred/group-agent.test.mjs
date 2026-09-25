import test from 'node:test';
import assert from 'node:assert/strict';
import {Store,id} from '../../server/elfred/store.mjs';
import {authenticate} from '../../server/elfred/auth.mjs';
import {Service} from '../../server/elfred/service.mjs';
import {ModelProvider} from '../../server/elfred/providers.mjs';
import {Runtime} from '../../server/elfred/runtime.mjs';

function setup(t){
  const store=new Store(':memory:'),service=new Service(store,new ModelProvider({}));t.after(()=>store.close());
  const [alice,bob]=['alice','bob'].map(handle=>authenticate(store,handle,'local-test-password',true,handle).user);
  [alice,bob].forEach(user=>service.initialize(user));
  const command=(user,action,input)=>service.command(user.id,id(),action,input),ref=object=>({id:object.id,version:store.get(object.id).version});
  const friend=command(alice,'friend.request',{handle:'bob'});command(bob,'friend.respond',{...ref(friend),decision:'accept'});
  const room=command(alice,'conversation.create',{title:'设计协作',handles:['bob'],agent:true,confirm:true});
  return {store,service,alice,bob,command,ref,room};
}

test('群 Agent 需当前成员逐一授权，以 AI 身份回复且保留群消息依据',async t=>{
  const {store,service,alice,bob,command,ref,room}=setup(t);
  assert.throws(()=>command(alice,'message.send',{id:room.id,text:'@Elfred 帮我们安排时间',agent_mention:true}),{code:'GROUP_AGENT_CONSENT'});
  assert.equal(store.list('message').length,0);
  command(bob,'conversation.agent.consent',{...ref(room),allow:true,confirm:true});
  const request=command(alice,'message.send',{id:room.id,text:'@Elfred 帮我们安排时间',agent_mention:true});
  assert.ok(request.task_id);assert.equal(store.list('message').length,1);
  const provider={status:()=>({configured:true}),generate:async()=>({output:'大家可先提供可用时段；周五 14:00 仍待双方确认。',usage:{total_tokens:20}})};
  await new Runtime(store,provider).tick();
  const agent=service.list(bob.id,'message').find(item=>item.data.actor_type==='agent');
  assert.ok(agent);assert.equal(agent.data.sender_name,'Elfred · 群协作 Agent');
  assert.match(agent.data.text,/待双方确认/);assert.deepEqual(agent.data.source_refs.map(ref=>ref.id),[request.id]);
  assert.equal(agent.data.trigger_id,request.id);assert.equal(store.list('commitment').length,0);
});

test('群成员撤销授权后，排队中的 Agent 不可读取消息或发言',async t=>{
  const {store,service,alice,bob,command,ref,room}=setup(t);
  command(bob,'conversation.agent.consent',{...ref(room),allow:true,confirm:true});
  command(alice,'message.send',{id:room.id,text:'@Elfred 整理共识',agent_mention:true});
  command(bob,'conversation.agent.consent',{...ref(room),allow:false,confirm:true});
  const provider={status:()=>({configured:true}),generate:async()=>{throw Error('不应调用模型')}};
  await new Runtime(store,provider).tick();
  assert.equal(service.list(alice.id,'message').filter(item=>item.data.actor_type==='agent').length,0);
});

test('主动参与只针对协作议题，受群设置和频次限制',t=>{
  const {store,alice,bob,command,ref,room}=setup(t);
  command(bob,'conversation.agent.consent',{...ref(room),allow:true,confirm:true});
  command(alice,'conversation.agent.configure',{...ref(room),enabled:true,proactive:true,confirm:true});
  command(bob,'message.send',{id:room.id,text:'大家好'});
  command(bob,'message.send',{id:room.id,text:'这份约束条件先保留'});
  assert.equal(store.list('task').length,0);
  command(bob,'message.send',{id:room.id,text:'我们几点安排会议？'});
  assert.equal(store.list('task').filter(item=>item.data.group_agent).length,1);
  command(bob,'message.send',{id:room.id,text:'谁负责日程安排？'});
  assert.equal(store.list('task').filter(item=>item.data.group_agent).length,1);
});

test('Elfred 发起协作群只邀请已建立联系的人，目标由本人确认，成员授权后才作首次介绍',async t=>{
  const {store,service,alice,bob,command,ref}=setup(t);
  assert.throws(()=>command(alice,'conversation.agent.start_group',{title:'新群',handles:['bob'],goal:'一起确定演示时间'}),{code:'CONFIRMATION_REQUIRED'});
  const group=command(alice,'conversation.agent.start_group',{title:'演示协作',handles:['bob'],goal:'一起确定演示时间',confirm:true});
  const room=store.get(group.id),intro=service.list(bob.id,'message').find(message=>message.space===room.id);
  assert.equal(room.data.agent_enabled,true);assert.equal(intro.data.human_sender_id,alice.id);
  assert.match(intro.data.text,/一起确定演示时间/);assert.equal(store.list('task').filter(task=>task.data.group_agent?.conversation_id===room.id).length,0);
  command(bob,'conversation.agent.consent',{...ref(room),allow:true,confirm:true});
  assert.equal(store.list('task').filter(task=>task.data.group_agent?.conversation_id===room.id).length,1);
  const provider={status:()=>({configured:true}),generate:async()=>({output:'我是 Elfred 群协作 Agent。请双方提供可用时段，我会整理候选安排。',usage:{total_tokens:12}})};
  await new Runtime(store,provider).tick();
  assert.match(service.list(bob.id,'message').find(message=>message.space===room.id&&message.data.actor_type==='agent')?.data.text||'',/Elfred 群协作 Agent/);
});
