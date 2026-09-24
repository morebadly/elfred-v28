import test from 'node:test';
import assert from 'node:assert/strict';
import {Store,id} from '../../server/elfred/store.mjs';
import {Service} from '../../server/elfred/service.mjs';
import {Runtime} from '../../server/elfred/runtime.mjs';
import {authenticate} from '../../server/elfred/auth.mjs';
import {tickObservations} from '../../server/elfred/observation.mjs';
function setup(t){const s=new Store(':memory:');t.after(()=>s.close());let calls=0,urls=['https://example.org/a'];const p={status:()=>({web_search:'configured'}),research:async()=>{calls++;return {output:'公开资料，需要本人核对',citations:urls.map(url=>({url,title:'公开来源'})),usage:{total_tokens:20}}}},service=new Service(s,p),runtime=new Runtime(s,p),u=authenticate(s,'watch-user','watch-test-password',true,'本人').user;service.initialize(u);const cmd=(action,input)=>service.command(u.id,id(),action,input),ref=w=>({id:w.id,version:s.get(w.id).version}),make=(n=3)=>cmd('observation.create',{goal:'本地区公开比赛报名消息',interval_hours:1,max_checks:n,expires:new Date(Date.now()+86400000).toISOString()}),start=w=>cmd('observation.start',{...ref(w),confirm:true,model_consent:true}),due=w=>{const o=s.get(w.id);s.update(o,{...o.data,next_at:Date.now()-1},u.id)};return {s,p,service,runtime,u,cmd,ref,make,start,due,calls:()=>calls,urls:value=>urls=value};}
test('周期观察明确授权后检查，首次建基线，相同来源不重复提醒，有限次数后停止',async t=>{
 const {s,p,service,runtime,u,cmd,ref,make,start,due,calls,urls}=setup(t),watch=make();await runtime.tick();assert.equal(calls(),0);assert.throws(()=>cmd('observation.start',{...ref(watch),confirm:true}),{code:'CONSENT_REQUIRED'});start(watch);
 await runtime.tick();tickObservations(s,p);assert.equal(calls(),1);assert.equal(s.get(watch.id).data.baseline,true);assert.equal(s.list('feed').length,0);assert.equal(s.list('notification').length,0);
 urls(['https://example.org/a?utm_source=test#position']);due(watch);await runtime.tick();tickObservations(s,p);assert.equal(calls(),2);assert.equal(s.list('feed').length,0);
 urls(['https://example.org/a','https://example.org/b']);due(watch);await runtime.tick();tickObservations(s,p);assert.equal(calls(),3);assert.equal(s.get(watch.id).data.status,'completed');assert.equal(s.list('feed').length,1);assert.equal(s.list('notification').length,1);assert.equal(s.list('post').length,0);assert.equal(s.list('feed')[0].data.citations.length,1);assert.equal(s.list('feed')[0].data.citations[0].url,'https://example.org/b');
 for(let i=0;i<4;i++)await runtime.tick();assert.equal(calls(),3);assert.equal(s.db.prepare('SELECT spent FROM budget_accounts WHERE owner=?').get(u.id).spent,3000);
 const b=authenticate(s,'watch-other','watch-test-password',true,'乙').user;service.initialize(b);assert.equal(service.list(b.id,'observation').length,0);assert.equal(service.list(b.id,'feed').length,0);
});
test('未配置时零调用，暂停阻止已排队检查，恢复不重置累计上限，过期不补发',async t=>{
 const {s,p,runtime,cmd,ref,make,start,calls}=setup(t),watch=make(4);p.status=()=>({web_search:'not_configured'});start(watch);await runtime.tick();assert.equal(s.get(watch.id).data.status,'blocked');assert.equal(s.get(watch.id).data.checks,0);assert.equal(calls(),0);p.status=()=>({web_search:'configured'});start(watch);tickObservations(s,p);assert.equal(s.get(watch.id).data.checks,1);cmd('observation.pause',ref(watch));await runtime.tick();assert.equal(calls(),0);start(watch);await runtime.tick();assert.equal(calls(),1);assert.equal(s.get(watch.id).data.checks,2);
 tickObservations(s,p,Date.now()+2*86400000);assert.equal(s.get(watch.id).data.status,'expired');assert.throws(()=>start(watch),{code:'INVALID_STATE'});await runtime.tick();assert.equal(calls(),1);
});
test('调用结果未知不自动重试，观察总量与账户额度同时约束且失败明确可见',async t=>{
 const {s,p,runtime,u,cmd,ref,make,start,calls}=setup(t),watch=make();p.research=async()=>{throw new Error('network interrupted')};start(watch);await runtime.tick();await runtime.tick();const state=s.get(watch.id);assert.equal(state.data.status,'blocked');assert.equal(state.data.checks,1);assert.throws(()=>start(watch),{code:'RECONCILIATION_REQUIRED'});const jobs=s.list('run').length;await runtime.tick();assert.equal(s.list('run').length,jobs);
 const another=make();s.db.prepare('UPDATE budget_accounts SET limit_units=reserved+spent WHERE owner=?').run(u.id);start(another);await runtime.tick();assert.equal(s.get(another.id).data.status,'blocked');assert.match(s.get(another.id).data.last_error,/额度不足/);assert.equal(s.get(another.id).data.checks,0);
 assert.throws(()=>cmd('observation.create',{goal:'无限检查',interval_hours:0,max_checks:1000,expires:new Date(Date.now()+86400000).toISOString()}),{code:'INVALID_INPUT'});
});
test('供应商超额的累计用量在对账后仍保留，不能恢复下一轮绕过总上限',async t=>{
 const {s,p,runtime,cmd,make,start}=setup(t),watch=make(2);let calls=0;p.research=async()=>{calls++;throw Object.assign(new Error('供应商报告超出本次额度'),{code:'TOKEN_BUDGET_EXCEEDED',usage:{total_tokens:50000}})};
 start(watch);await runtime.tick();await runtime.tick();const entry=s.db.prepare("SELECT * FROM usage WHERE status='unknown'").get();cmd('usage.reconcile',{id:entry.id,actual_units:1000,note:'验收中的已知模拟供应商用量',confirm:true});assert.throws(()=>start(watch),{code:'STOP_LIMIT'});await runtime.tick();assert.equal(calls,1);assert.equal(s.list('task').find(t=>t.data.observation_id===watch.id).data.tokens,50000);
});
test('最后一次结果返回后暂停仍完成归档，不丢提醒且不新增调用',async t=>{
 const {s,p,runtime,cmd,ref,make,start,due,calls,urls}=setup(t),watch=make(2);start(watch);await runtime.tick();tickObservations(s,p);urls(['https://example.org/new']);due(watch);await runtime.tick();cmd('observation.pause',ref(watch));start(watch);await runtime.tick();assert.equal(calls(),2);assert.equal(s.list('feed').length,1);assert.equal(s.get(watch.id).data.status,'completed');
 const second=make(2);start(second);await runtime.tick();tickObservations(s,p);urls(['https://example.org/other']);due(second);await runtime.tick();cmd('observation.stop',ref(second));await runtime.tick();assert.equal(s.list('feed').length,2);assert.equal(s.get(second.id).data.status,'ended');assert.equal(calls(),4);
});
