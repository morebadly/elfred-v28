import test from 'node:test';
import assert from 'node:assert/strict';
import {Store,id} from '../../server/elfred/store.mjs';
import {authenticate} from '../../server/elfred/auth.mjs';
import {Service} from '../../server/elfred/service.mjs';
import {Runtime} from '../../server/elfred/runtime.mjs';
import {DEFINITIONS} from '../../server/elfred/catalog.mjs';
import {selectCapability,selectionQuestion} from '../../server/elfred/capability-selector.mjs';
import {DEFAULT_STOP} from '../../server/elfred/policy.mjs';
function setup(t,generate){
 const store=new Store(':memory:'),provider={status:()=>({configured:true}),generate},service=new Service(store,provider),runtime=new Runtime(store,provider);
 const user=authenticate(store,'capability_test','test-only-password',true,'测试').user;service.initialize(user);t.after(()=>store.close());
 const cmd=(action,input)=>service.command(user.id,id(),action,input),ref=o=>({id:o.id,version:store.get(o.id).version});
 const start=input=>{const task=cmd('task.create',input);cmd('task.confirm',{...ref(task),confirm:true,model_consent:true});return {task,run:cmd('run.start',ref(task))}};
 return {store,service,runtime,user,cmd,ref,start};
}
const answer=output=>({output,usage:{total_tokens:5}});

test('17 项能力只有配置，初始化不启动任务或模型；每项含独立工作约束',t=>{
 const {store}=setup(t,()=>{throw new Error('unexpected provider call')});
 assert.equal(DEFINITIONS.length,17);assert.equal(new Set(DEFINITIONS.map(d=>d.id)).size,17);
 for(const d of DEFINITIONS){assert.ok(d.steps.length&&d.checks.length&&d.outputs.length);assert.equal(d.instance_policy,'load_on_demand');assert.equal(d.context_scope,'selected_sources_only');assert.ok(d.tool_allowlist.every(tool=>!['shell','mail.send','browser'].includes(tool)));}
 assert.equal(store.list('task').length,0);assert.equal(store.list('run').length,0);
});

test('常规任务只调用一次模型并加载所选专业步骤；结果仍需本人验收',async t=>{
 const calls=[],{start,store,runtime}=setup(t,async input=>{calls.push(input);return answer('正文：一段介绍。依据与待确认项：无资料。')});
 const {task,run}=start({goal:'写一段个人介绍',system:'create',capability_id:'create-0'});await runtime.tick();
 assert.equal(calls.length,1);assert.match(calls[0].systemPrompt,/本轮按需加载能力：文稿创作/);assert.doesNotMatch(calls[0].systemPrompt,/本轮按需加载能力：软件原型/);
 assert.deepEqual(calls[0].context,[]);assert.equal(store.get(task.id).data.status,'awaiting_review');
 assert.equal(store.get(run.id).data.verification.capability_checks.semantic_status,'requires_owner_review');assert.equal(store.list('post').length,0);
});

test('强制核验不能被 single 降级；审查使用检查职责且通过后不额外修订',async t=>{
 const calls=[],{start,store,runtime}=setup(t,async input=>{calls.push(input);return answer(input.goal.phase==='review'?'{"decision":"satisfied","issues":[]}':'核验草稿')});
 const {task,run}=start({goal:'核验这个主张',system:'explore',review_mode:'single'});await runtime.tick();
 assert.deepEqual(calls.map(c=>c.goal.phase),['work','review']);assert.match(calls[1].systemPrompt,/独立检查职责：核验/);
 assert.doesNotMatch(calls[1].systemPrompt,/默认输出使用以下 Markdown/);assert.equal(store.get(run.id).data.plan.review.required,true);
 assert.equal(store.get(task.id).data.status,'awaiting_review');assert.equal(store.get(task.id).data.calls,2);
});

test('所选资料触发复核且无额外读取调用；检查预算不足明确记录并保留人工验收',async t=>{
 const calls=[],{start,store,runtime,cmd,ref}=setup(t,async input=>{calls.push(input);return answer(input.goal.phase==='review'?'{"decision":"satisfied","issues":[]}':'正文')});
 const doc=cmd('document.create',{title:'唯一资料.md',content:'只允许这个上下文'});cmd('document.create',{title:'未选资料.md',content:'不应发送'});
 const first=start({goal:'写摘要',source_refs:[ref(doc)]});await runtime.tick();assert.equal(calls.length,2);assert.equal(calls[0].context.length,1);assert.equal(calls[0].context[0].content,'只允许这个上下文');assert.equal(store.get(first.task.id).data.calls,2);
 const next=start({goal:'核验主张',system:'explore',stop:{...DEFAULT_STOP,maxCalls:1,maxUnits:1000}});await runtime.tick();
 const review=store.get(next.run.id).data.plan.review;assert.equal(review.required,true);assert.equal(review.wanted,true);assert.equal(review.available,false);assert.equal(store.get(next.task.id).data.status,'awaiting_review');assert.equal(calls.length,3);
});

test('能力选择限制在当前系统；Jev 低置信或非法建议回退，客户端不能伪造裁判决策',t=>{
 const {cmd,store}=setup(t,async()=>answer('结果'));
 assert.throws(()=>cmd('task.create',{goal:'写文稿',system:'create',capability_id:'execute-1'}),{code:'INVALID_CAPABILITY'});
 for(const [choice,confidence] of [['execute-1',1],['create-2',0.2],['none',1],['create-2',NaN]]){const selected=selectCapability('create','写文稿',{judgeDecision:{answers:{capability:{type:'choice',choice,confidence}}}});assert.equal(selected.capability.id,'create-0');assert.equal(selected.selection.judge_status,'fallback');}
 const trusted={answers:{capability:{type:'choice',choice:'create-2',confidence:0.95}}};assert.equal(selectCapability('create','写文稿',{judgeDecision:trusted}).capability.id,'create-2');
 const task=cmd('task.create',{goal:'写文稿',system:'create',judgeDecision:trusted,capability:{id:'execute-1'}});assert.equal(store.get(task.id).data.capability.id,'create-0');assert.equal(store.get(task.id).data.capability_selection.judge_status,'not_connected');
 assert.deepEqual(Object.keys(selectionQuestion('create','写文稿').questions.capability.criteria).sort(),['create-0','create-1','create-2','create-3','none']);
});

test('暂停后恢复冻结的能力、复核者与计划，不随目录升级改变或重复生成',async t=>{
 let entered,resolve;const started=new Promise(done=>entered=done),calls=[];
 const {start,store,runtime,cmd,ref}=setup(t,input=>{calls.push(input);if(input.goal.phase==='review')return Promise.resolve(answer('{"decision":"satisfied","issues":[]}'));entered();return new Promise(done=>resolve=done)});
 const {task,run}=start({goal:'写一段介绍',system:'create',review_mode:'independent'}),snapshot=store.get(run.id).data.version_snapshot,plan=store.get(run.id).data.plan.steps;
 const pending=runtime.tick();await started;cmd('run.command',{...ref(run),command:'pause'});resolve(answer('草稿'));await pending;
 const definition=DEFINITIONS.find(d=>d.id==='create-3'),oldChecks=definition.checks;definition.checks=['不应进入旧运行的新版本规则'];
 try{const resumed=cmd('run.start',ref(task));assert.deepEqual(store.get(resumed.id).data.version_snapshot,snapshot);assert.deepEqual(store.get(resumed.id).data.plan.steps,plan);await runtime.tick();assert.deepEqual(calls.map(c=>c.goal.phase),['work','review']);assert.doesNotMatch(calls[1].systemPrompt,/不应进入旧运行/);}finally{definition.checks=oldChecks;}
});

test('操作能力仅生成方案，明确未接外部工具，不能产生真人消息或操作回执',async t=>{
 const calls=[],{start,store,runtime}=setup(t,async input=>{calls.push(input);return answer(input.goal.phase==='review'?'{"decision":"satisfied","issues":[]}':'动作与对象：邮件草稿。权限与工具：未接通。执行状态与回执：未发送。')});
 const {run}=start({goal:'准备发送邮件的方案',system:'execute'});await runtime.tick();
 assert.match(calls[0].systemPrompt,/外部执行工具尚未接通/);assert.ok(store.get(run.id).data.plan.steps.every(step=>step.tool==='text.compose'));assert.equal(store.list('message').length,0);assert.equal(store.list('post').length,0);
});

 test('本地检索不运行模型，也不会被误报缺少生成格式',async t=>{
 const {start,cmd,store,runtime}=setup(t,()=>{throw new Error('unexpected model')});cmd('document.create',{title:'检索目标.md',content:'检索目标的资料'});const {run}=start({goal:'检索目标',mode:'search'});await runtime.tick();assert.equal(store.get(run.id).data.verification.capability_checks,undefined);assert.equal(store.get(run.id).data.status,'completed');
 });
