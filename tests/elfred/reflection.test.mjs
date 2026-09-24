import test from 'node:test';
import assert from 'node:assert/strict';
import {Store,id} from '../../server/elfred/store.mjs';
import {Service} from '../../server/elfred/service.mjs';
import {Runtime} from '../../server/elfred/runtime.mjs';
import {authenticate} from '../../server/elfred/auth.mjs';
import {localDay} from '../../app/v28/core/local-day.mjs';
test('晚间反思只用所选今日事实，模型结果待人核对，改变来源后不可沿用',async t=>{
 const store=new Store(':memory:');t.after(()=>store.close());let payload,selectedId;
 const provider={status:()=>({configured:true}),generate:async p=>{payload=p;return {output:JSON.stringify({explanation:'可能需要先明确完成标准',alternative:'也可能已有未记录的线下进展',understanding:'先核对这项任务的验收点',continuation:'明天确认后再延续',routing:'只给执行系统本任务状态',evidence_ids:[selectedId]}),usage:{total_tokens:30}}}},service=new Service(store,provider),runtime=new Runtime(store,provider),user=authenticate(store,'reflection-test','test-password-long',true,'甲').user;service.initialize(user);const cmd=(a,i)=>service.command(user.id,id(),a,i),ref=o=>({id:o.id,version:store.get(o.id).version});
 const task=cmd('task.create',{goal:'核对原设计',mode:'manual'});selectedId=task.id;store.update(store.get(task.id),{...store.get(task.id).data,focus_date:localDay(new Date(),'Asia/Shanghai'),plan_note:'补充验收标准'},user.id);cmd('task.create',{goal:'PRIVATE_NOT_SELECTED'});const brief=cmd('brief.create',{kind:'evening'});
 assert.throws(()=>cmd('brief.reflect',{...ref(brief),source_refs:[ref(task)],confirm:true}),{code:'CONSENT_REQUIRED'});
 const result=cmd('brief.reflect',{...ref(brief),source_refs:[ref(task)],confirm:true,model_consent:true});await runtime.tick();assert.doesNotMatch(JSON.stringify(payload),/PRIVATE_NOT_SELECTED/);const run=store.get(store.get(result.task_id).data.run_id);cmd('brief.reflection.apply',{...ref(brief),run_id:run.id,run_version:run.version});assert.equal(store.get(brief.id).data.review,null);assert.equal(store.visible(user.id,'memory').length,0);
 cmd('brief.review',{...ref(brief),decision:'corrected',correction:'今天只是缺少验收标准，不代表我的偏好'});assert.equal(store.get(brief.id).data.review.decision,'corrected');assert.equal(store.visible(user.id,'memory').length,0);
 store.update(store.get(task.id),{...store.get(task.id).data,plan_note:'已改变'},user.id);assert.throws(()=>cmd('brief.review',{...ref(brief),decision:'confirmed'}),{code:'VERSION_CONFLICT'});assert.throws(()=>cmd('brief.followup',{...ref(brief),kind:'memory',content:'旧理解',confirm:true}),{code:'VERSION_CONFLICT'});
});
test('撤销来源可见性后反思接口和派生理解都不返回原群信息',t=>{
 const store=new Store(':memory:');t.after(()=>store.close());const service=new Service(store,{status:()=>({configured:false})}),u=authenticate(store,'reflection-revoke','test-password-long',true,'甲').user;service.initialize(u);const cmd=(a,i)=>service.command(u.id,id(),a,i),ref=o=>({id:o.id,version:store.get(o.id).version});
 const shared=store.add('resource',u.id,{title:'群资料',content:'PRIVATE_TEAM'}),task=cmd('task.create',{goal:'本日任务',source_refs:[ref(shared)]}),brief=cmd('brief.create',{kind:'evening'});store.update(store.get(brief.id),{...store.get(brief.id).data,reflection:{understanding:'PRIVATE_TEAM 推断',facts:[{task_id:task.id,version:store.get(task.id).version}],evidence_ids:[task.id]},review:{decision:'confirmed'}},u.id);const memory=cmd('brief.followup',{...ref(brief),kind:'memory',content:'PRIVATE_TEAM 理解',confirm:true});assert.equal(store.get(memory.id).data.source_refs[0].id,task.id);
 store.db.prepare('UPDATE objects SET owner=? WHERE id=?').run(authenticate(store,'reflection-other','test-password-long',true,'乙').user.id,shared.id);assert.equal(store.canRead(u.id,store.get(task.id)),false);assert.doesNotMatch(JSON.stringify(service.read(u.id,brief.id)),/PRIVATE_TEAM/);assert.equal(store.canRead(u.id,store.get(memory.id)),false);
});
