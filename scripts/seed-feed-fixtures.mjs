import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Store,id} from '../server/elfred/store.mjs';
import {authenticate} from '../server/elfred/auth.mjs';
import {Service} from '../server/elfred/service.mjs';
import {ModelProvider} from '../server/elfred/providers.mjs';
import {SEARCH_TYPES,localSearch} from '../server/elfred/search-engine.mjs';
import {localDay} from '../app/v28/core/local-day.mjs';
import {simulateFixtureAgents} from './fixture-agents.mjs';

// Always seed a fresh, isolated database. Fixtures never enter a user's data directory.
const directory=mkdtempSync(path.join(tmpdir(),'elfred-fixtures-'));
const store=new Store(path.join(directory,'elfred.sqlite'));
const user=authenticate(store,'fixture-review','fixture-review-only',true,'验收账号').user;
const service=new Service(store,new ModelProvider({}));
service.initialize(user);
const onboarding=service.list(user.id,'onboarding')[0];
service.command(user.id,id(),'onboarding.complete',{id:onboarding.id,version:onboarding.version,skip:true});
const simulations=simulateFixtureAgents();
for(const {post} of simulations)store.add('feed',user.id,post);
writeFileSync(path.join(directory,'fixture-agents.json'),JSON.stringify({synthetic:true,count:simulations.length,actors:simulations.map(item=>item.actor)},null,2));
const collaborator=authenticate(store,'fixture-partner','fixture-review-only',true,'验收协作者').user;
const conversation=store.add('conversation',user.id,{title:'【测试数据】QAFINDCONVERSATION 验收群聊',kind:'group',status:'active',seq:1},{visibility:'members'});
store.join(conversation.id,user.id,'owner');store.join(conversation.id,collaborator.id,'member');
for(const type of SEARCH_TYPES){
  const keyword=`QAFIND${type.toUpperCase()}`;
  if(type==='conversation')continue;
  if(type==='friend'){
    store.add('friend',user.id,{recipient:collaborator.id,status:'accepted',intro:`【测试数据】${keyword} 联系人检索`});
    continue;
  }
  const data={title:`【测试数据】${keyword} ${type} 检索条目`,content:`仅供隔离验收：${keyword}`,text:`仅供隔离验收：${keyword}`,status:'active',synthetic:true};
  if(type==='message')store.add(type,user.id,{...data,seq:1,conversation_id:conversation.id},{space:conversation.id,visibility:'members'});
  else if(type==='assist')store.add(type,user.id,{...data,conversation_id:conversation.id},{space:conversation.id});
  else store.add(type,user.id,data);
}
const today=localDay(new Date(),'Asia/Shanghai');
for(const [period,status] of [['早间','draft'],['午间','awaiting_review'],['晚间','completed']]){
  store.add('task',user.id,{title:`【测试数据】${period}时段卡片验收任务`,goal:`隔离测试 ${period} 卡片的真实数据路径`,status,system:'execute',focus_date:today,synthetic:true});
}
for(const type of SEARCH_TYPES){
  const keyword=`QAFIND${type.toUpperCase()}`;
  const found=localSearch(store,user.id,{query:keyword,types:[type]});
  if(!found.hits.some(hit=>hit.type===type))throw new Error(`搜索验收数据缺少 ${type}`);
}
store.close();
console.log(`已在隔离目录运行 1000 个模拟 Agent，生成 1000 条测试动态、${SEARCH_TYPES.length} 类可检索样本及三时段卡片任务：${directory}`);
console.log('如需查看，另启服务并设置 ELFRED_DATA_DIR 为此目录；登录 fixture-review / fixture-review-only。');
