import test from 'node:test';
import assert from 'node:assert/strict';
import {Store,id} from '../../server/elfred/store.mjs';
import {Service} from '../../server/elfred/service.mjs';
import {authenticate} from '../../server/elfred/auth.mjs';
import {parseRss,validatedFeedUrl} from '../../server/elfred/rss.mjs';
import {tickRssObservations} from '../../server/elfred/observation.mjs';

test('RSS 和 Atom 只解析可回溯的公开条目，拒绝内网源与 XML 实体',()=>{
 assert.throws(()=>validatedFeedUrl('http://example.com/rss'),{code:'INVALID_FEED_URL'});
 assert.throws(()=>validatedFeedUrl('https://127.0.0.1/rss'),{code:'INVALID_FEED_URL'});
 assert.throws(()=>parseRss('<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss/>','https://example.org/rss'),{code:'INVALID_FEED'});
 assert.deepEqual(parseRss('<rss><channel><item><guid>1</guid><title>新产品 &amp; 服务</title><link>https://example.org/new</link><description><![CDATA[<p>公开更新</p>]]></description></item></channel></rss>','https://example.org/rss')[0],{id:'1',title:'新产品 & 服务',summary:'公开更新',url:'https://example.org/new',published_at:null});
 assert.equal(parseRss('<feed><entry><id>a</id><title>新消息</title><link href="/a"/><summary>内容</summary></entry></feed>','https://example.org/atom')[0].url,'https://example.org/a');
});

test('授权 RSS 首次只建基线，之后关键词命中才发私人动态，暂停和去重有效',async t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 const user=authenticate(store,'rss-owner','rss-password',true,'本人').user;
 const service=new Service(store,{status:()=>({})});service.initialize(user);
 const command=(action,input)=>service.command(user.id,id(),action,input);
 const watch=command('observation.create',{goal:'关注产品更新',source_url:'https://example.org/rss',keywords:'产品,发布',system:'explore',interval_hours:1,max_checks:4,expires:new Date(Date.now()+86400000).toISOString()});
 const ref=()=>({id:watch.id,version:store.get(watch.id).version});
 command('observation.start',{...ref(),confirm:true});
 let entries=[{id:'old',title:'产品旧消息',summary:'',url:'https://example.org/old',published_at:null}];
 const reader=async()=>entries;
 await tickRssObservations(store,reader);
 assert.equal(store.list('feed').length,0);
 assert.equal(store.get(watch.id).data.baseline,true);
 entries=[...entries,{id:'new',title:'产品发布',summary:'新内容',url:'https://example.org/new',published_at:null},{id:'other',title:'天气消息',summary:'晴',url:'https://example.org/weather',published_at:null}];
 let current=store.get(watch.id);store.update(current,{...current.data,next_at:Date.now()-1},user.id);
 await tickRssObservations(store,reader);
 const posts=store.list('feed');assert.equal(posts.length,1);assert.equal(posts[0].owner,user.id);assert.equal(posts[0].data.external_url,'https://example.org/new');assert.equal(store.list('post').length,0);
 assert.equal(store.list('notification').length,0);
 current=store.get(watch.id);store.update(current,{...current.data,next_at:Date.now()-1},user.id);
 await tickRssObservations(store,reader);assert.equal(store.list('feed').length,1);
 command('observation.pause',ref());
 entries=[...entries,{id:'late',title:'产品发布 2',summary:'新内容',url:'https://example.org/late',published_at:null}];
 await tickRssObservations(store,reader,Date.now()+3600000);assert.equal(store.list('feed').length,1);
});

test('话题关注、静音、合并和移除只更新私人筛选，不删除动态',t=>{
 const store=new Store(':memory:');t.after(()=>store.close());
 const user=authenticate(store,'topic-owner','topic-password',true,'本人').user;
 const service=new Service(store,{status:()=>({})});service.initialize(user);
 const command=(action,input)=>service.command(user.id,id(),action,input);
 store.add('feed',user.id,{title:'甲',summary:'',system:'explore',topic:'产品',status:'active'});
 store.add('feed',user.id,{title:'乙',summary:'',system:'create',topic:'项目',status:'active'});
 command('feed.topic.set',{topic:'产品',mode:'follow'});
 assert.equal(service.list(user.id,'settings')[0].data.feed_topics['产品'].mode,'follow');
 command('feed.topic.set',{topic:'产品',mode:'mute'});
 command('feed.topic.merge',{topic:'产品',into:'项目'});
 command('feed.topic.remove',{topic:'项目'});
 assert.equal(service.list(user.id,'settings')[0].data.feed_topics['产品'].alias,'项目');
 assert.equal(store.list('feed').length,2);
 assert.throws(()=>command('feed.topic.set',{topic:'不存在',mode:'follow'}),{code:'INVALID_INPUT'});
});
