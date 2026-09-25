import test from 'node:test';
import assert from 'node:assert/strict';
import {Store,id} from '../../server/elfred/store.mjs';
import {authenticate} from '../../server/elfred/auth.mjs';
import {Service} from '../../server/elfred/service.mjs';

test('第二页固化能力使用真实工具版本，任务草稿与资料按账号保存',t=>{
  const store=new Store(':memory:');t.after(()=>store.close());
  const service=new Service(store,{status:()=>({configured:false})});
  const alice=authenticate(store,'page24-alice','local-test-password',true,'Alice').user;
  const bob=authenticate(store,'page24-bob','local-test-password',true,'Bob').user;
  service.initialize(alice);service.initialize(bob);
  const command=(user,action,input)=>service.command(user.id,id(),action,input);
  const note=command(alice,'knowledge.create',{title:'首页研究',content:'用户需要按时间段看到待办'});
  const document=command(alice,'document.create',{title:'访谈.md',content:'真实访谈记录'});
  const saved=command(alice,'tool.save',{title:'首页分析',instructions:'先核对资料，再给可验收的方案',kind:'Skill',system:'explore'});
  assert.equal(typeof saved.version,'number');
  command(alice,'tool.activate',{id:saved.id,version:saved.version});
  const draft=command(alice,'task.create',{goal:'用首页分析完成首页方案',criteria:'提供可核对的方案',system:'explore',mode:'compose',source_refs:[{id:note.id,version:1},{id:document.id,version:1}]});
  assert.equal(store.get(draft.id).data.status,'draft');
  assert.equal(store.get(draft.id).data.source_refs[0].id,note.id);
  assert.equal(store.get(draft.id).data.source_refs[1].id,document.id);
  assert.equal(service.list(alice.id,'skill').find(item=>item.id===saved.id).data.status,'active');
  assert.equal(service.list(bob.id,'skill').some(item=>item.id===saved.id),false);
  assert.equal(service.list(bob.id,'task').some(item=>item.id===draft.id),false);
});
