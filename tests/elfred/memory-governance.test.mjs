import test from 'node:test';
import assert from 'node:assert/strict';
import {Store,id} from '../../server/elfred/store.mjs';
import {Service} from '../../server/elfred/service.mjs';
import {authenticate} from '../../server/elfred/auth.mjs';
import {sourceRefs} from '../../server/elfred/knowledge.mjs';
import {localSearch} from '../../server/elfred/search-engine.mjs';
test('K04 隐藏与到期理解不进入搜索或任务依据，可本人核对后恢复；旧版本不能覆盖',t=>{
 const store=new Store(':memory:');t.after(()=>store.close());const s=new Service(store,{status:()=>({configured:false})}),u=authenticate(store,'memory-governance','test-governance-password',true,'本人').user;s.initialize(u);const cmd=(a,i)=>s.command(u.id,id(),a,i),ref=o=>({id:o.id,version:store.get(o.id).version});
 const memory=cmd('memory.create',{content:'重视公开来源',scope:'explore',risk:'low'});cmd('memory.decide',{...ref(memory),decision:'confirm'});const before=ref(memory);cmd('memory.governance',{...before,hidden:true});assert.equal(localSearch(store,u.id,{query:'重视公开来源'}).hits.length,0);assert.throws(()=>sourceRefs(store,u.id,[ref(memory)]),{code:'SOURCE_INVALID'});assert.throws(()=>cmd('memory.governance',{...before,hidden:false}),{code:'VERSION_CONFLICT'});
 cmd('memory.governance',{...ref(memory),hidden:false,expires_at:new Date(Date.now()+60000).toISOString()});assert.equal(localSearch(store,u.id,{query:'重视公开来源'}).hits.length,1);
 const current=store.get(memory.id);store.update(current,{...current.data,expires_at:new Date(Date.now()-1).toISOString()},u.id);assert.throws(()=>sourceRefs(store,u.id,[ref(memory)]),{code:'SOURCE_INVALID'});assert.equal(localSearch(store,u.id,{query:'重视公开来源'}).hits.length,0);
 cmd('memory.governance',{...ref(memory),hidden:false,expires_at:null});assert.equal(sourceRefs(store,u.id,[ref(memory)]).length,1);
});
