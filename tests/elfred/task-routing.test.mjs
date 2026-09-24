import test from 'node:test';
import assert from 'node:assert/strict';
import {routeSuggestion} from '../../server/elfred/task-routing.mjs';
import {Store,id} from '../../server/elfred/store.mjs';
import {Service} from '../../server/elfred/service.mjs';
import {authenticate} from '../../server/elfred/auth.mjs';
test('按最终交付建议主责，保留必要前置与歧义，不按途经工具抢主责',()=>{
 assert.equal(routeSuggestion('调研竞品并提供资料').system,'explore');
 assert.deepEqual(routeSuggestion('调研竞品后建议选择方案').collaborators,['explore']);
 assert.equal(routeSuggestion('调研竞品后建议选择方案').system,'advise');
 assert.equal(routeSuggestion('调研竞品，形成产品方案').system,'create');
 assert.equal(routeSuggestion('寻找设计师并发送邀请').system,'execute');
 assert.equal(routeSuggestion('分析并调研这个问题'),null);
});
test('明确所选入口不被静默覆盖，转交保持同一草稿且不自动调模型',t=>{
 const s=new Store(':memory:');t.after(()=>s.close());const service=new Service(s,{status:()=>({configured:false})}),u=authenticate(s,'route-user','routing-test-password',true,'本人').user;service.initialize(u);const cmd=(a,i)=>service.command(u.id,id(),a,i),task=cmd('task.create',{goal:'调研竞品后建议选择方案',system:'create'}),object=s.get(task.id);assert.equal(object.data.system,'create');assert.equal(object.data.routing_suggestion.system,'advise');assert.equal(object.data.status,'draft');const result=cmd('task.route',{id:task.id,version:object.version,system:'advise',reason:object.data.routing_suggestion.reason,confirm:true});assert.equal(result.id,task.id);assert.equal(s.get(task.id).data.routing_suggestion,null);assert.equal(s.list('run').length,0);const auto=cmd('task.create',{goal:'调研竞品后建议选择方案'});assert.equal(s.get(auto.id).data.system,'advise');assert.equal(s.get(auto.id).data.status,'draft');
});
