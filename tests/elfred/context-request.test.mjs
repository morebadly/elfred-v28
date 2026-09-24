import test from 'node:test';
import assert from 'node:assert/strict';
import {Store,id} from '../../server/elfred/store.mjs';
import {authenticate} from '../../server/elfred/auth.mjs';
import {Service} from '../../server/elfred/service.mjs';
import {Runtime} from '../../server/elfred/runtime.mjs';
import {checkContextUse} from '../../server/elfred/context-request.mjs';
function setup(t){const store=new Store(':memory:');t.after(()=>store.close());const calls=[],provider={status:()=>({configured:true}),generate:async i=>{calls.push(i);return {output:'只根据明确授权字段生成的建议。',usage:{total_tokens:10}};}},service=new Service(store,provider),runtime=new Runtime(store,provider),u=authenticate(store,'context-user','test-context-password',true,'本人').user;service.initialize(u);const cmd=(a,i)=>service.command(u.id,id(),a,i),ref=o=>({id:o.id,version:store.get(o.id).version}),task=cmd('task.create',{goal:'撰写清晰文稿',system:'create'}),note=cmd('knowledge.create',{title:'可以提供的标题',content:'PRIVATE_FULL_BODY_NEVER_SEND'});return {store,calls,service,runtime,u,cmd,ref,task,note,request:()=>cmd('context.request',{task_id:task.id,task_version:store.get(task.id).version,holder:'owner',purpose:'只需要了解资料标题',fields:['title'],expires:new Date(Date.now()+3600000).toISOString()})};}
test('A Context Request 只给指定任务选择的字段，不自动读取其他正文，并保留部分满足与来源',async t=>{
 const {store,calls,runtime,cmd,ref,task,note,request}=setup(t),req=request();assert.equal(store.get(task.id).data.source_refs.length,0);cmd('context.respond',{...ref(req),decision:'partial',note:'只提供标题',fields:['title'],source_refs:[ref(note)],confirm:true});assert.equal(store.get(req.id).data.status,'partial');
 cmd('task.confirm',{...ref(task),confirm:true,model_consent:true});cmd('run.start',ref(task));await runtime.tick();assert.ok(calls.length>=1);assert.match(JSON.stringify(calls),/可以提供的标题/);assert.doesNotMatch(JSON.stringify(calls),/PRIVATE_FULL_BODY_NEVER_SEND/);
});
test('A 拒绝与补充不产生授权；字段、归属、期限及另一任务不可越界',t=>{
 const {store,cmd,ref,task,note,request}=setup(t);const denied=request();cmd('context.respond',{...ref(denied),decision:'deny',note:'本次不提供'});assert.equal(store.list('context_grant').length,0);
 const req=request();assert.throws(()=>cmd('context.respond',{...ref(req),decision:'fulfill',note:'扩大范围',fields:['content'],source_refs:[ref(note)],confirm:true}),{code:'CONTEXT_SCOPE'});
 cmd('context.respond',{...ref(req),decision:'fulfill',note:'仅标题',source_refs:[ref(note)],confirm:true});const grant=store.list('context_grant')[0];
 const another=cmd('task.create',{goal:'另一个目标',system:'create',source_refs:[ref(grant)]});assert.throws(()=>cmd('task.confirm',{...ref(another),confirm:true,model_consent:true}),{code:'CONTEXT_SCOPE'});
 store.update(grant,{...grant.data,expires:Date.now()-1},grant.owner);store.update(store.get(task.id),{...store.get(task.id).data,source_refs:[ref(grant)]},grant.owner);assert.throws(()=>cmd('task.confirm',{...ref(task),confirm:true,model_consent:true}),{code:'CONTEXT_EXPIRED'});
});
test('A 撤销后排队任务零调用；已变化来源可撤销清理；转交保留任务ID与记录',async t=>{
 const {store,calls,runtime,cmd,ref,task,note,request}=setup(t),req=request();cmd('context.respond',{...ref(req),decision:'fulfill',note:'提供标题',source_refs:[ref(note)],confirm:true});cmd('task.confirm',{...ref(task),confirm:true,model_consent:true});cmd('run.start',ref(task));cmd('context.revoke',ref(req));await runtime.tick();assert.equal(calls.length,0);
 const other=cmd('task.create',{goal:'比较两种方案',system:'create'});cmd('task.route',{...ref(other),system:'advise',reason:'最终需要决策建议',confirm:true});assert.equal(store.get(other.id).data.system,'advise');assert.equal(store.get(other.id).data.routing_history.length,1);
 const more=cmd('context.request',{task_id:other.id,task_version:store.get(other.id).version,holder:'owner',purpose:'提供标题',fields:['title'],expires:new Date(Date.now()+3600000).toISOString()});cmd('context.respond',{...ref(more),decision:'fulfill',note:'提供',source_refs:[ref(note)],confirm:true});cmd('knowledge.update',{...ref(note),title:'资料变了',content:'新正文'});cmd('context.revoke',ref(more));assert.equal(store.get(other.id).data.source_refs.length,0);
});
test('A 从授权产生的衍生成果也不能绕过原任务或有效期',async t=>{
 const {store,cmd,ref,task,note,request,runtime,u}=setup(t),req=request();cmd('context.respond',{...ref(req),decision:'fulfill',note:'标题范围',source_refs:[ref(note)],confirm:true});cmd('task.confirm',{...ref(task),confirm:true,model_consent:true});cmd('run.start',ref(task));await runtime.tick();const accepted=cmd('task.accept',{...ref(task),accept:true});
 const other=cmd('task.create',{goal:'用这份成果另作判断',system:'advise',source_refs:[ref({id:accepted.artifact_id})]});assert.throws(()=>cmd('task.confirm',{...ref(other),confirm:true,model_consent:true}),{code:'CONTEXT_SCOPE'});
 const grant=store.list('context_grant')[0];store.update(grant,{...grant.data,expires:Date.now()-1},u.id);assert.throws(()=>checkContextUse(store,store.get(task.id),[{id:accepted.artifact_id}]),{code:'CONTEXT_EXPIRED'});
});
test('A 撤销后可恢复同一任务为草稿，旧结果不重放、累计用量不清零',async t=>{
 const {store,service,u,cmd,ref,task,note,request,runtime}=setup(t),req=request();cmd('context.respond',{...ref(req),decision:'fulfill',note:'标题',source_refs:[ref(note)],confirm:true});cmd('task.confirm',{...ref(task),confirm:true,model_consent:true});cmd('run.start',ref(task));cmd('context.revoke',ref(req));await runtime.tick();const prior=store.get(task.id),recovery=service.list(u.id,'context_request').find(q=>q.id===req.id).data.recovery_task;assert.equal(recovery.id,task.id);cmd('task.reopen_context',{id:recovery.id,version:recovery.version,confirm:true});const draft=store.owned(u.id,task.id);assert.equal(draft.data.status,'draft');assert.equal(draft.data.run_id,null);assert.deepEqual(draft.data.source_refs,[]);assert.equal(draft.data.calls,prior.data.calls);assert.equal(draft.data.context_history[0].run_id,prior.data.run_id);assert.throws(()=>cmd('run.start',ref(task)),{code:'INVALID_STATE'});
});
test('A 原始来源变化仍提供恢复入口，重开执行版本不携带旧反馈',async t=>{
 const {store,service,u,cmd,ref,task,note,request,runtime,calls}=setup(t),req=request();cmd('context.respond',{...ref(req),decision:'fulfill',note:'标题',source_refs:[ref(note)],confirm:true});cmd('task.confirm',{...ref(task),confirm:true,model_consent:true});cmd('run.start',ref(task));await runtime.tick();cmd('task.accept',{...ref(task),accept:false,feedback:'OLD_SCOPE_SECRET_GUIDANCE'});runtime.provider.status=()=>({configured:false});cmd('run.start',ref(task));await runtime.tick();
 cmd('knowledge.update',{...ref(note),title:'新版标题',content:'更新正文'});const recovery=service.list(u.id,'context_request').find(q=>q.id===req.id).data.recovery_task;assert.equal(recovery.source_invalid,true);assert.equal(store.get(req.id).data.status,'fulfilled');cmd('task.reopen_context',{id:recovery.id,version:recovery.version,confirm:true});runtime.provider.status=()=>({configured:true});calls.length=0;cmd('task.confirm',{...ref(task),confirm:true,model_consent:true});cmd('run.start',ref(task));await runtime.tick();assert.ok(calls.length);assert.doesNotMatch(JSON.stringify(calls),/OLD_SCOPE_SECRET_GUIDANCE/);assert.doesNotMatch(JSON.stringify(calls),/可以提供的标题/);
});
