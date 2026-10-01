import test from 'node:test';
import assert from 'node:assert/strict';
import {Store,id} from '../../server/elfred/store.mjs';
import {Service} from '../../server/elfred/service.mjs';
import {ModelProvider} from '../../server/elfred/providers.mjs';
import {authenticate} from '../../server/elfred/auth.mjs';

test('只有主动关注真人作者才接收其公开社区更新，原帖撤下后候选也不可读',t=>{
 const store=new Store(':memory:'),service=new Service(store,new ModelProvider({}));t.after(()=>store.close());
 const [author,follower,stranger]=['source-author','source-follower','source-stranger'].map(handle=>{const user=authenticate(store,handle,'local-test-password',true,handle).user;service.initialize(user);return user});
 const command=(user,action,input)=>service.command(user.id,id(),action,input);
 const first=command(author,'post.create',{title:'开始写产品日记',content:'这里是真人原帖',confirm:true});
 command(follower,'post.follow_author',{id:first.id});
 const second=command(author,'post.create',{title:'第二条产品进展',content:'这一条有真实进展和出处',confirm:true});
 const feed=service.list(follower.id,'feed').find(item=>item.data.source_post_id===second.id);
 assert.ok(feed);assert.equal(feed.data.system,'connect');assert.match(feed.data.reason,/主动关注/);
 assert.equal(feed.data.source_refs[0].id,second.id);
 assert.equal(service.list(stranger.id,'feed').length,0);
 command(author,'post.edit',{id:second.id,version:store.get(second.id).version,title:'修改后的真实进展',content:'更新后的原文',confirm:true});
 assert.match(service.list(follower.id,'feed').find(item=>item.id===feed.id).data.title,/修改后/);
 command(author,'post.withdraw',{id:second.id,version:store.get(second.id).version,confirm:true});
 assert.equal(service.list(follower.id,'feed').some(item=>item.id===feed.id),false);
});
