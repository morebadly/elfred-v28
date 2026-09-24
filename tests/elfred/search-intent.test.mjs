import test from 'node:test';
import assert from 'node:assert/strict';
import {relativeRange,resolveSearchContext} from '../../server/elfred/search-intent.mjs';
import {Store} from '../../server/elfred/store.mjs';
import {authenticate} from '../../server/elfred/auth.mjs';
test('S 自然周跨月跨年、自然日按本人时区和夏令时边界解析',()=>{
 assert.deepEqual(relativeRange('找上周资料','Asia/Shanghai',new Date('2026-09-21T03:00:00Z')),{after:'2026-09-13T16:00:00.000Z',before:'2026-09-20T16:00:00.000Z',label:'上周按周一开始的自然周，时区 Asia/Shanghai'});
 const newYear=relativeRange('本周','Asia/Shanghai',new Date('2026-01-01T12:00:00Z'));assert.equal(newYear.after,'2025-12-28T16:00:00.000Z');
 const dst=relativeRange('今天','America/New_York',new Date('2026-03-08T12:00:00Z'));assert.equal(Date.parse(dst.before)-Date.parse(dst.after),23*3600000);
 assert.equal(relativeRange('只本周且只上周').conflict,true);
});
test('S 发送者仅在可读关系中精确消歧，同名需选择；手动条件优先且范围不扩大',t=>{
 const store=new Store(':memory:');t.after(()=>store.close());const users=['a','b','c','d'].map(h=>authenticate(store,'search-'+h,'test-search-password',true,h==='b'||h==='c'?'小林':h).user),[a,b,c,d]=users;
 const room=store.add('conversation',a.id,{title:'项目群',kind:'group'},{visibility:'members'});store.join(room.id,a.id);store.join(room.id,b.id);
 let result=resolveSearchContext(store,a.id,'找小林在项目群发的报名说明',{});assert.equal(result.resolved.author,b.id);assert.equal(result.resolved.space,room.id);assert.equal(result.uncertainties.length,0);
 store.join(room.id,c.id);result=resolveSearchContext(store,a.id,'找小林发的资料',{space:room.id});assert.equal(result.resolved.author,undefined);assert.ok(result.uncertainties.length);
 result=resolveSearchContext(store,a.id,'找小林发的资料',{space:room.id,author:b.id,after:'2026-01-01'});assert.equal(result.resolved.author,b.id);assert.equal(result.resolved.after,'2026-01-01');
 const hidden=store.add('conversation',d.id,{title:'秘密群',kind:'group'},{visibility:'members'});store.join(hidden.id,d.id);assert.equal(resolveSearchContext(store,a.id,'找秘密群发的资料',{}).resolved.space,undefined);
});
