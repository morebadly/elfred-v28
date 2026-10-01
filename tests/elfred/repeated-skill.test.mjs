import test from 'node:test';
import assert from 'node:assert/strict';
import {Store,id} from '../../server/elfred/store.mjs';
import {Service} from '../../server/elfred/service.mjs';
import {ModelProvider} from '../../server/elfred/providers.mjs';
import {authenticate} from '../../server/elfred/auth.mjs';

test('两次同类已验收任务生成有 Evidence 的 Skill 建议，须本人确认创建',t=>{
 const store=new Store(':memory:'),service=new Service(store,new ModelProvider({}));t.after(()=>store.close());
 const owner=authenticate(store,'repeat-owner','local-test-password',true,'本人').user;service.initialize(owner);
 const command=(action,input)=>service.command(owner.id,id(),action,input);
 const complete=month=>{
  const created=command('task.create',{goal:`撰写${month}月周报`,system:'create',mode:'manual'});
  let task=store.get(created.id);
  command('task.confirm',{id:task.id,version:task.version,confirm:true});
  task=store.get(task.id);
  command('task.complete_manual',{id:task.id,version:task.version,confirm:true,result:`${month}月周报已交付并核对`});
  return store.get(task.id);
 };
 const first=complete(8);assert.equal(service.list(owner.id,'skill_suggestion').length,0);
 const second=complete(9),suggestion=service.list(owner.id,'skill_suggestion')[0];
 assert.equal(suggestion.data.status,'pending');
 assert.deepEqual(suggestion.data.evidence.map(row=>row.task_id).sort(),[first.id,second.id].sort());
 assert.equal(service.list(owner.id,'skill').length,0);
 assert.throws(()=>command('skill_suggestion.create',{id:suggestion.id,version:suggestion.version}),{code:'CONFIRMATION_REQUIRED'});
 const created=command('skill_suggestion.create',{id:suggestion.id,version:suggestion.version,confirm:true});
 const skill=store.get(created.id);
 assert.equal(skill.data.kind,'Skill');assert.equal(skill.data.status,'draft');
 assert.equal(skill.data.evidence.length,2);assert.ok(skill.data.version_id);
 assert.equal(store.get(suggestion.id).data.status,'created');
 assert.equal(service.bootstrap(owner.id).objects.skill_suggestion[0].id,suggestion.id);
});

test('继续观察不会自动创建工具；积累另外两次后才再次提示',t=>{
 const store=new Store(':memory:'),service=new Service(store,new ModelProvider({}));t.after(()=>store.close());
 const owner=authenticate(store,'repeat-watch','local-test-password',true,'本人').user;service.initialize(owner);
 const command=(action,input)=>service.command(owner.id,id(),action,input);
 for(let month=1;month<=4;month++){
  const created=command('task.create',{goal:`撰写${month}月周报`,system:'create',mode:'manual'});let task=store.get(created.id);
  command('task.confirm',{id:task.id,version:task.version,confirm:true});task=store.get(task.id);
  command('task.complete_manual',{id:task.id,version:task.version,confirm:true,result:`${month}月周报完成`});
  if(month===2){const suggestion=service.list(owner.id,'skill_suggestion')[0];command('skill_suggestion.observe',{id:suggestion.id,version:suggestion.version});}
  if(month===3)assert.equal(service.list(owner.id,'skill_suggestion').filter(item=>item.data.status==='pending').length,0);
 }
 assert.equal(service.list(owner.id,'skill_suggestion').filter(item=>item.data.status==='pending').length,1);
 assert.equal(service.list(owner.id,'skill').length,0);
});
