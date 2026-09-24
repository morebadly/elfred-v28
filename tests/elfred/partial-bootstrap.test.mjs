import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../../server/elfred/store.mjs';
import {authenticate} from '../../server/elfred/auth.mjs';
import {Service} from '../../server/elfred/service.mjs';
test('首页局部数据失败保留其他模块，失败有明确状态且重试恢复；核心身份失败不返回部分身份',t=>{
 const store=new Store(':memory:');t.after(()=>store.close());const service=new Service(store,{status:()=>({configured:false})}),u=authenticate(store,'partial-user','partial-test-password',true,'本人').user;service.initialize(u);store.add('knowledge',u.id,{title:'应保留的笔记',content:'正文'});
 const list=service.list.bind(service);let broken='feed';service.list=(user,type)=>{if(type===broken)throw new Error('internal path or sensitive details');return list(user,type);};const snapshot=service.bootstrap(u.id);assert.equal(snapshot.objects.knowledge.length,1);assert.equal(snapshot.objects.feed.length,0);assert.ok(snapshot.module_errors.feed);assert.doesNotMatch(JSON.stringify(snapshot.module_errors),/sensitive/);broken='';assert.deepEqual(service.bootstrap(u.id).module_errors,{});broken='settings';assert.throws(()=>service.bootstrap(u.id));
});
