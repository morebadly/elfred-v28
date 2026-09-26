import test from 'node:test';
import assert from 'node:assert/strict';
import {Store,id} from '../../server/elfred/store.mjs';
import {authenticate} from '../../server/elfred/auth.mjs';
import {Service} from '../../server/elfred/service.mjs';
import {Runtime} from '../../server/elfred/runtime.mjs';
function setup(t){
 const store=new Store(':memory:');t.after(()=>store.close());const calls=[];
 const provider={status:()=>({configured:true}),generate:async input=>{calls.push(input);return {output:input.goal.phase==='collaboration'?'本步协作结果':'汇总完成的成果',usage:{total_tokens:12}}}};
 const service=new Service(store,provider),user=authenticate(store,'swarm-test','local-test-password',true,'测试用户').user;service.initialize(user);
 return {store,service,user,calls,runtime:new Runtime(store,provider),cmd:(action,input,key=id())=>service.command(user.id,key,action,input),ref:object=>({id:object.id,version:store.get(object.id).version})};
}
const input={goal:'一起完成产品说明',system:'create',mode:'pipeline',confirm:true,steps:[{system:'explore',goal:'整理产品使用场景'},{system:'advise',goal:'比较可行方案'}]};
test('蜂群方案原子创建、重复点击幂等，保存不调用模型；启动后接力再汇总',async t=>{
 const {store,calls,runtime,cmd,ref}=setup(t),key=id(),task=cmd('swarm.create',input,key);
 assert.equal(cmd('swarm.create',input,key).id,task.id);assert.equal(store.list('task').length,1);assert.equal(calls.length,0);
 const plan=store.get(task.id);assert.equal(plan.data.status,'draft');assert.deepEqual(plan.data.collaboration_steps[1].depends,['support-0']);
 cmd('task.confirm',{...ref(task),confirm:true,model_consent:true});cmd('run.start',ref(task));await runtime.tick();
 assert.equal(calls.length,3);assert.equal(calls[1].goal.collaboration_evidence.length,1);assert.equal(calls[2].goal.collaboration_evidence.length,2);
 const run=store.get(store.get(task.id).data.run_id);assert.equal(run.data.receipts.filter(receipt=>receipt.status==='succeeded').length,3);
});
test('蜂群拒绝重复系统及停用系统，失败不留下孤立任务，也不读取未选资料',t=>{
 const {store,user,cmd}=setup(t);
 assert.throws(()=>cmd('swarm.create',{...input,steps:[input.steps[0],input.steps[0]]}),{code:'INVALID_INPUT'});assert.equal(store.list('task').length,0);
 const settings=store.visible(user.id,'settings')[0];store.update(settings,{...settings.data,agents:{...settings.data.agents,explore:{enabled:false}}},user.id);
 assert.throws(()=>cmd('swarm.create',input),{code:'AGENT_DISABLED'});assert.equal(store.list('task').length,0);
 const task=cmd('swarm.create',{...input,mode:'independent',steps:[input.steps[1]]});assert.deepEqual(store.get(task.id).data.collaboration_steps[0].source_refs,[]);assert.deepEqual(store.get(task.id).data.collaboration_steps[0].depends,[]);
});
