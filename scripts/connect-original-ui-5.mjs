import fs from 'node:fs';
const replace=(s,a,b)=>{if(!s.includes(a))throw Error(a.slice(0,100));return s.replace(a,b)};
let p='app/v28/legacy/legacy-ui.tsx',source=fs.readFileSync(p,'utf8');
const section=(name,fn)=>{const start=source.indexOf('export function '+name+'(');let end=source.indexOf('\nexport ',start+1);if(start<0)throw Error(name);if(end<0)end=source.length;source=source.slice(0,start)+fn(source.slice(start,end))+source.slice(end)};
section('ProfileEditPage',s=>{
 s=replace(s,'  const [profile, setProfile]', '  const runtime=useRuntime();\n  const [profile, setProfile]');
 s=replace(s,'    const url = URL.createObjectURL(file);',`    if(runtime){if(file.size>250000){notify('图片需小于 250 KB，支持 PNG、JPEG、WebP');return;}const reader=new FileReader();reader.onload=()=>{const data=String(reader.result);if(type==='cover')setCoverUrl(data);else setAvatarUrl(data)};reader.readAsDataURL(file);return;}
    const url = URL.createObjectURL(file);`);
 s=replace(s,'  const save = () => {',`  const save = () => {
    if(runtime?.snapshot){void runtime.command('profile.save',{...entityRef(runtime.snapshot.objects.profile[0]),...profile,...(coverUrl?{cover:coverUrl}:{}),...(avatarUrl?{avatar:avatarUrl}:{})}).then(()=>{notify('个人资料已保存');onBack()}).catch(()=>{});return;}`);
 s=replace(s,'              value={profile.username.replace(/^@/, "")}','              value={profile.username.replace(/^@/, "")}\n              readOnly={Boolean(runtime)}');
 s=replace(s,'<small>在公开主页显示当前等级和能力卡</small>','<small>{runtime?"在本人主页展示理解状态，不生成虚构等级":"在公开主页显示当前等级和能力卡"}</small>');return s;
});
section('FriendProfilePage',s=>{
 s=replace(s,'  const contact = chatDirectory[id] || chatDirectory["person-linjia"];',`  const runtime=useRuntime();
  const conversation=runtime?.snapshot?.objects.conversation.find(item=>item.id===id);
  const contact = runtime?{name:entityText(conversation,'title')||'会话当前不可访问'}:chatDirectory[id] || chatDirectory['person-linjia'];`);
 s=s.replace('<p>产品设计师 · 深圳</p>','<p>{runtime?conversation?.data.kind===\'group\'?"群聊成员":"已确认站内关系":"产品设计师 · 深圳"}</p>').replace('<i /> 在线','<i /> {runtime?"不提供在线状态":"在线"}').replace('<b>Personal Agent 产品体验</b>','<b>{runtime?"以对方明确表达为准":"Personal Agent 产品体验"}</b>').replace('<b>产品共创联系人</b>','<b>{runtime?conversation?.members?.map(member=>member.name).join("、"):"产品共创联系人"}</b>');
 s=s.replace('onClick={() => go({ name: "chat", id: "partner-agent-linjia" })}','onClick={() => go({ name: "chat", id:runtime?id:"partner-agent-linjia" })}').replace('        和 Ta 的 Agent 沟通','        {runtime?"返回真人会话":"和 Ta 的 Agent 沟通"}');return s;
});
section('AgentMomentsPage',s=>{
 s=replace(s,'  const agent =','  const runtime=useRuntime();\n  const agent =');
 s=replace(s,'  const posts = getAgentMomentPosts(id);',`  const feeds=runtime?.snapshot?.objects.feed.filter(item=>item.data.system===(id==='advisor'?'advise':id))||[];
  const posts:AgentMomentPost[] = runtime?feeds.map(item=>({id:item.id,date:new Date(item.created).toLocaleDateString('zh-CN'),title:entityText(item,'title'),summary:entityText(item,'summary'),tag:'专题',detail:[entityText(item,'summary')]})):getAgentMomentPosts(id);`);
 s=replace(s,'  const toggleSave = (postId: string) => {',`  const toggleSave = (postId: string) => {
    if(runtime){void runtime.command('feed.interact',{id:postId,kind:'save'}).catch(()=>{});return;}`);
 s=s.replace('{posts.length * 4} 条动态','{posts.length * (runtime?1:4)} 条动态');
 s=replace(s,'go({ name: "agent-moment-detail", id, postId: post.id });',`go(runtime?{name:'task',id:entityText(feeds.find(item=>item.id===post.id),'task_id')}:{ name: "agent-moment-detail", id, postId: post.id });`);
 s=replace(s,'          onSkill={() => {',`          onSkill={() => {
            if(runtime){setActionPost(null);go({name:'my-tools'});return;}`);return s;
});
fs.writeFileSync(p,source);
p='app/v28/core/runtime-context.tsx';source=fs.readFileSync(p,'utf8');source=source.replace("bio:text(profile,'bio'),role:","bio:text(profile,'bio'),showLevel:profile.data.showLevel===true,role:");fs.writeFileSync(p,source);
p='app/v28/features/home/home-page.tsx';source=fs.readFileSync(p,'utf8');source=source.replace('...dailyBriefs[kind],summary:',`...dailyBriefs[kind],title:kind==='morning'?'从今天的重点开始':kind==='noon'?'核对进展与待处理事项':'核对今日成果与理解',summary:`);fs.writeFileSync(p,source);
