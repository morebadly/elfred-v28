import test from 'node:test';
import assert from 'node:assert/strict';
import {Store,id} from '../../server/elfred/store.mjs';
import {Service} from '../../server/elfred/service.mjs';
import {ModelProvider} from '../../server/elfred/providers.mjs';
import {authenticate} from '../../server/elfred/auth.mjs';
import {tickRssObservations,observationCommand} from '../../server/elfred/observation.mjs';
import {simulateFixtureAgents} from '../../scripts/fixture-agents.mjs';

function setup(t){
 const store=new Store(':memory:'),service=new Service(store,new ModelProvider({}));t.after(()=>store.close());
 const user=authenticate(store,'meeting-qa','local-test-password',true,'测试用户').user;service.initialize(user);
 const cmd=(action,input)=>service.command(user.id,id(),action,input);
 const session=()=>service.list(user.id,'onboarding')[0];
 const ref=object=>({id:object.id,version:store.get(object.id).version});
 for(const [question_id,option] of [['direction','opportunity'],['format','product']])cmd('onboarding.choice.answer',{...ref(session()),question_id,option});
 return {store,service,user,cmd,session,ref};
}
test('初始化确认后自动发现匹配资讯，非相关内容不发布，多个源去重且不进入真人社区',async t=>{
 const {store,service,user,cmd,session,ref}=setup(t);
 cmd('onboarding.choice.confirm',{...ref(session()),confirm:true,auto_discovery:true});
 const watch=service.list(user.id,'observation')[0];assert.equal(watch.data.status,'active');assert.equal(watch.data.auto_managed,true);
 const article={id:'news-1',title:'创业产品开发机会',summary:'新工具与市场需求',url:'https://example.org/product',published_at:new Date().toISOString()};
 await tickRssObservations(store,async()=>[article,{...article,id:'unrelated',url:'https://example.org/weather',title:'明日降雨概率',summary:'天气预报'}]);
 assert.equal(service.list(user.id,'feed').length,1);assert.equal(service.list(user.id,'post').length,0);
 assert.equal(service.list(user.id,'feed')[0].data.external_url,article.url);
 assert.equal(store.get(watch.id).data.last_new_sources,1);
 const current=store.get(watch.id);store.update(current,{...current.data,next_at:Date.now()-1},user.id);
 await tickRssObservations(store,async()=>[article]);assert.equal(service.list(user.id,'feed').length,1);
});
test('资讯失败自动退避并从备用源恢复；暂停期间不读取，恢复后不受旧期限影响',async t=>{
 const {store,service,user,cmd,session,ref}=setup(t);
 cmd('onboarding.choice.confirm',{...ref(session()),confirm:true,auto_discovery:true});let watch=service.list(user.id,'observation')[0];
 await tickRssObservations(store,async()=>{throw new Error('offline')});watch=store.get(watch.id);
 assert.equal(watch.data.status,'active');assert.equal(watch.data.failures,1);assert.ok(watch.data.next_at>Date.now());assert.equal(service.list(user.id,'feed').length,0);
 watch=store.update(watch,{...watch.data,next_at:Date.now()-1,expires:Date.now()-1,checks:30},user.id);
 observationCommand(store,user.id,'observation.pause',ref(watch));
 await tickRssObservations(store,async()=>{throw new Error('paused must not read')});assert.equal(store.get(watch.id).data.failures,1);
 observationCommand(store,user.id,'observation.start',{...ref(watch),confirm:true});
 await tickRssObservations(store,async url=>{if(url.includes('google'))throw new Error('primary down');return [{id:'fallback',title:'开发一款创业产品',summary:'市场实践',url:'https://example.org/fallback'}]});
 assert.equal(service.list(user.id,'feed').length,1);assert.equal(store.get(watch.id).data.status,'active');assert.equal(store.get(watch.id).data.failures,0);
});
test('初始化关闭自动发现和后续暂停均被尊重，重复确认不擅自恢复',t=>{
 const {store,service,user,cmd,session,ref}=setup(t);
 cmd('onboarding.choice.confirm',{...ref(session()),confirm:true,auto_discovery:false});let watch=service.list(user.id,'observation')[0];assert.equal(watch.data.status,'draft');
 cmd('onboarding.choice.confirm',{...ref(session()),confirm:true,auto_discovery:true});watch=store.get(watch.id);assert.equal(watch.data.status,'active');
 cmd('onboarding.choice.confirm',{...ref(session()),confirm:true,auto_discovery:false});assert.equal(store.get(watch.id).data.status,'paused');
 cmd('onboarding.choice.confirm',{...ref(session()),confirm:true,auto_discovery:true});assert.equal(store.get(watch.id).data.status,'paused');
});
test('千级隔离 Agent 各有身份、职责和目标，生成对应动态，不建立真实账号或调用模型',()=>{
 const simulations=simulateFixtureAgents();assert.equal(simulations.length,1000);
 assert.equal(new Set(simulations.map(item=>item.actor.id)).size,1000);
 for(const system of ['explore','advise','create','connect','execute'])assert.equal(simulations.filter(item=>item.actor.system===system).length,200);
 assert.ok(simulations.every(item=>item.post.fixture_agent_id===item.actor.id&&item.post.synthetic&&item.actor.synthetic&&item.post.system===item.actor.system));
 assert.equal(new Set(simulations.map(item=>item.actor.goal)).size,10);
});

test('旧初始化关注迁移和偏好修改同步筛选规则，并尊重停用和暂停',async t=>{
 const {store,service,user,cmd,session,ref}=setup(t);
 cmd('onboarding.choice.confirm',{...ref(session()),confirm:true,auto_discovery:true});let watch=service.list(user.id,'observation')[0];
 const legacy={...watch.data};delete legacy.interests;delete legacy.source_urls;delete legacy.auto_managed;
 store.update(watch,legacy,user.id);
 cmd('onboarding.choice.confirm',{...ref(session()),confirm:true,auto_discovery:true});watch=store.get(watch.id);
 assert.ok(watch.data.interests.includes('创业'));assert.equal(watch.data.source_urls.length,3);assert.equal(watch.data.auto_managed,true);
 for(const [question_id,option] of [['direction','ability'],['format','content']])cmd('onboarding.choice.answer',{...ref(session()),question_id,option});
 cmd('onboarding.choice.confirm',{...ref(session()),confirm:true,auto_discovery:true});watch=store.get(watch.id);
 assert.ok(watch.data.interests.includes('技能'));assert.ok(!watch.data.interests.includes('创业'));
 const settings=service.list(user.id,'settings')[0];store.update(settings,{...settings.data,agents:{...settings.data.agents,explore:{...settings.data.agents?.explore,enabled:false}}},user.id);
 await tickRssObservations(store,async()=>{assert.fail('停用 Agent 不能抓取')});assert.equal(store.get(watch.id).data.status,'paused');
});
test('过期初始化草稿可由新的明确授权启动，不阻断初始化保存',t=>{
 const {store,service,user,cmd,session,ref}=setup(t);
 cmd('onboarding.choice.confirm',{...ref(session()),confirm:true,auto_discovery:false});let watch=service.list(user.id,'observation')[0];
 store.update(watch,{...watch.data,expires:Date.now()-1},user.id);
 cmd('onboarding.choice.confirm',{...ref(session()),confirm:true,auto_discovery:true});
 assert.equal(store.get(watch.id).data.status,'active');assert.equal(store.get(watch.id).data.auto_managed,true);
});
test('跨资讯源相同局部 GUID 不漏掉新网址，已见网址不重复发布',async t=>{
 const {store,service,user,cmd,session,ref}=setup(t);
 cmd('onboarding.choice.confirm',{...ref(session()),confirm:true,auto_discovery:true});let watch=service.list(user.id,'observation')[0];
 const article=url=>({id:'42',title:'创业产品开发机会',summary:'市场需求',url});
 await tickRssObservations(store,async()=>[article('https://example.org/a')]);
 watch=store.get(watch.id);store.update(watch,{...watch.data,next_at:Date.now()-1},user.id);
 await tickRssObservations(store,async()=>[article('https://example.org/a'),article('https://example.org/c')]);
 assert.equal(service.list(user.id,'feed').length,2);assert.equal(store.get(watch.id).data.last_new_sources,1);
});
