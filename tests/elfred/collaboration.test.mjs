import test from 'node:test';
import assert from 'node:assert/strict';
import {Store,id} from '../../server/elfred/store.mjs';
import {authenticate} from '../../server/elfred/auth.mjs';
import {Service} from '../../server/elfred/service.mjs';
import {Runtime} from '../../server/elfred/runtime.mjs';
import {resultReceipts} from '../../server/elfred/agent-plan.mjs';
import {plannedModelUnits} from '../../server/elfred/review-policy.mjs';
function setup(t){const store=new Store(':memory:');t.after(()=>store.close());const calls=[],provider={status:()=>({configured:true}),generate:async input=>{calls.push(input);return {output:input.goal.phase==='review'?'{"decision":"satisfied","issues":[]}':input.goal.phase==='collaboration'?'协作建议-'+calls.length:'完整主责成果',usage:{total_tokens:10}}}},service=new Service(store,provider),runtime=new Runtime(store,provider),u=authenticate(store,'collaboration-user','test-collaboration-password',true,'本人').user;service.initialize(u);const cmd=(a,i)=>service.command(u.id,id(),a,i),ref=o=>({id:o.id,version:store.get(o.id).version});return {store,calls,runtime,cmd,ref,u};}
test('跨系统按依赖执行，协作仅接收指定资料，主责汇总且复核不吞掉成果',async t=>{
 const {store,calls,runtime,cmd,ref}=setup(t),one=cmd('knowledge.create',{title:'第一项',content:'ONLY_FIRST_SOURCE'}),two=cmd('knowledge.create',{title:'第二项',content:'ONLY_SECOND_SOURCE'}),task=cmd('task.create',{goal:'制作说明文稿',system:'create',source_refs:[ref(one),ref(two)],review_mode:'single'});
 cmd('task.collaboration',{...ref(task),confirm:true,steps:[{id:'find',system:'explore',goal:'核对第一项',source_refs:[ref(one)],depends:[]},{id:'compare',system:'advise',goal:'比较建议',source_refs:[ref(two)],depends:['find']}],reviewer_system:'connect'});
 cmd('task.confirm',{...ref(task),confirm:true,model_consent:true});cmd('run.start',ref(task));await runtime.tick();
 assert.equal(calls.length,4);assert.match(JSON.stringify(calls[0]),/ONLY_FIRST_SOURCE/);assert.doesNotMatch(JSON.stringify(calls[0]),/ONLY_SECOND_SOURCE/);assert.doesNotMatch(JSON.stringify(calls[1]),/ONLY_FIRST_SOURCE/);assert.equal(calls[1].goal.collaboration_evidence[0].output,'协作建议-1');assert.equal(calls[2].goal.collaboration_evidence.length,2);assert.match(calls[3].systemPrompt,/关系与协作/);
 const run=store.get(store.get(task.id).data.run_id);assert.deepEqual(run.data.plan.steps.find(s=>s.id==='work').depends,['collab-find','collab-compare']);assert.equal(resultReceipts(run.data.receipts)[0].output,'完整主责成果');
});
test('协作拒绝未选来源、循环依赖、越预算；转交后清除旧分工',t=>{
 const {store,cmd,ref}=setup(t),task=cmd('task.create',{goal:'草拟文稿',system:'create'}),note=cmd('knowledge.create',{title:'未选择',content:'秘密'}),step={id:'find',system:'explore',goal:'核对资料',source_refs:[],depends:[]},save=steps=>cmd('task.collaboration',{...ref(task),steps,confirm:true});
 assert.throws(()=>save([{...step,source_refs:[ref(note)]}]),{code:'CONTEXT_SCOPE'});assert.throws(()=>save([{...step,depends:['find']}]),{code:'INVALID_DEPENDENCY'});
 save([step]);cmd('task.route',{...ref(task),system:'explore',reason:'改为资料核验',confirm:true});assert.deepEqual(store.get(task.id).data.collaboration_steps,[]);
 const limited=cmd('task.create',{goal:'简单文稿',system:'create',stop:{maxAttempts:1,maxReplans:1,maxSeconds:60,maxTokens:1000,maxCalls:1,maxUnits:1000}});assert.throws(()=>cmd('task.collaboration',{...ref(limited),steps:[step],confirm:true}),{code:'BUDGET_EXHAUSTED'});
 assert.deepEqual(resultReceipts([{phase:'collaboration',output:'仅部分协作'}]),[]);
});
test('协作系统在排队后停用会停止调用，不把局部建议作为可验收成果',async t=>{
 const {store,calls,runtime,cmd,ref,u}=setup(t),task=cmd('task.create',{goal:'制作说明',system:'create'});cmd('task.collaboration',{...ref(task),steps:[{id:'find',system:'explore',goal:'核对',source_refs:[],depends:[]}],confirm:true});cmd('task.confirm',{...ref(task),confirm:true,model_consent:true});cmd('run.start',ref(task));const settings=store.visible(u.id,'settings')[0];store.update(settings,{...settings.data,agents:{...settings.data.agents,explore:{...settings.data.agents?.explore,enabled:false}}},u.id);await runtime.tick();assert.equal(calls.length,0);assert.notEqual(store.get(task.id).data.status,'awaiting_acceptance');
});
test('模型配置临时缺失后按断点恢复，不重复已经成功的协作',async t=>{
 const {store,calls,runtime,cmd,ref}=setup(t),task=cmd('task.create',{goal:'写一段文字',system:'create',review_mode:'single'});cmd('task.collaboration',{...ref(task),steps:[{id:'find',system:'explore',goal:'整理思路',source_refs:[],depends:[]}],confirm:true});
 let enabled=true;const original=runtime.provider.generate;runtime.provider.status=()=>({configured:enabled});runtime.provider.generate=async input=>{const result=await original(input);enabled=false;return result;};
 cmd('task.confirm',{...ref(task),confirm:true,model_consent:true});cmd('run.start',ref(task));await runtime.tick();assert.equal(store.get(task.id).data.status,'blocked');assert.equal(calls.length,1);
 enabled=true;runtime.provider.generate=original;cmd('run.start',ref(task));await runtime.tick();assert.deepEqual(calls.map(c=>c.goal.phase),['collaboration','work']);
});
test('主责修改反馈只交给主责，不进入未选择资料的协作步骤',async t=>{
 const {store,calls,runtime,cmd,ref}=setup(t),task=cmd('task.create',{goal:'写一段文字',system:'create',review_mode:'single'});cmd('task.collaboration',{...ref(task),steps:[{id:'find',system:'explore',goal:'整理思路',source_refs:[],depends:[]}],confirm:true});cmd('task.confirm',{...ref(task),confirm:true,model_consent:true});cmd('run.start',ref(task));await runtime.tick();cmd('task.accept',{...ref(task),accept:false,feedback:'MAIN_ONLY_PRIVATE_FEEDBACK'});cmd('run.replan',ref(task));await runtime.tick();assert.equal(calls.length,4);assert.doesNotMatch(JSON.stringify(calls[2]),/MAIN_ONLY_PRIVATE_FEEDBACK/);assert.match(JSON.stringify(calls[3]),/MAIN_ONLY_PRIVATE_FEEDBACK/);
});
test('协作配置为独立复核预留计划位置，预算显示与实际十二步一致',async t=>{
 const {store,calls,runtime,cmd,ref}=setup(t),task=cmd('task.create',{goal:'写一篇说明',system:'create',review_mode:'independent',stop:{maxAttempts:1,maxReplans:1,maxSeconds:180,maxTokens:10000,maxCalls:20,maxUnits:20000}}),steps=Array.from({length:11},(_,i)=>({id:'part-'+i,system:'explore',goal:'核对一个角度',source_refs:[],depends:[]}));
 assert.throws(()=>cmd('task.collaboration',{...ref(task),steps,confirm:true}),{code:'BUDGET_EXHAUSTED'});cmd('task.collaboration',{...ref(task),steps:steps.slice(0,10),confirm:true});assert.equal(plannedModelUnits(store.get(task.id)),12000);cmd('budget.set',{limit_units:20000});cmd('task.confirm',{...ref(task),confirm:true,model_consent:true});cmd('run.start',ref(task));await runtime.tick();assert.equal(calls.length,12);assert.equal(store.get(store.get(task.id).data.run_id).data.plan.steps.length,12);
});
