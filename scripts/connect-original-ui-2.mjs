import fs from 'node:fs';
const path='app/v28/legacy/legacy-ui.tsx';let source=fs.readFileSync(path,'utf8');
const replace=(s,a,b)=>{if(!s.includes(a))throw new Error('Missing anchor: '+a.slice(0,100));return s.replace(a,b)};
const section=(name,fn)=>{const start=source.indexOf('export function '+name+'(');if(start<0)throw new Error(name);let end=source.indexOf('\nexport ',start+1);if(end<0)end=source.length;source=source.slice(0,start)+fn(source.slice(start,end))+source.slice(end)};
source=source.replace('"use client";','"use client";\nimport {ConnectedUtility,ConnectedSettings,PrivateAssist,AssetEditor,MethodsPanel} from "../core/runtime-panels";\nimport {text as entityText,statuses as runtimeStatuses} from "../features/live/types";');
section('ChatPage',s=>{
 s=replace(s,'  const [text, setText] = useState("");',`  const runtime=useRuntime();
  const conversation=runtime?.snapshot?.objects.conversation.find(item=>item.id===id);
  const [assistOpen,setAssistOpen]=useState(false),[chatQuery,setChatQuery]=useState(''),[mentions,setMentions]=useState<string[]>([]),[sending,setSending]=useState(false);
  const [text, setText] = useState("");
  useEffect(()=>{if(!runtime||!conversation)return;setText(entityText(runtime.snapshot?.objects.draft.find(item=>item.data.conversation_id===id),'text'));},[id]);
  useEffect(()=>{if(!runtime||!conversation)return;void runtime.command('conversation.read',{id,seq:conversation.data.seq}).catch(()=>{});},[id,conversation?.data.seq]);
  const saveDraft=()=>{if(runtime&&conversation)void runtime.command('draft.save',{conversation_id:id,text}).catch(()=>{});};`);
 s=replace(s,'  const contact = chatDirectory[id];',`  const contact = conversation?{name:entityText(conversation,'title'),subtitle:conversation.data.kind==='group'?'群聊 · '+conversation.members?.length+' 人':'真人会话',greeting:''}:runtime?undefined:chatDirectory[id];`);
 s=replace(s,'Boolean(contact && id.startsWith("person-"))','Boolean(conversation || (contact && id.startsWith("person-")))');
 s=replace(s,'    defaultMessages;','    (runtime?[]:defaultMessages);');
 s=replace(s,'    if (!input) return;',`    if (!input||sending) return;
    if(runtime){setSending(true);void (conversation?runtime.command('message.send',{id,text:input,mentions}):runtime.command('task.create',{goal:input,mode:/^(搜索|检索|查找)/.test(input)?'search':'compose',system:agent?.id==='advisor'?'advise':agent?.id||'execute'})).then(async result=>{setText('');setMentions([]);if(conversation)await runtime.command('draft.save',{conversation_id:id,text:''});else go({name:'task',id:result.id})}).catch(()=>{}).finally(()=>setSending(false));return;}`);
 s=replace(s,'    const existing = state.tasks.find(',`    if(runtime){void runtime.command('task.create',{goal:latest,mode:'compose',system:'execute'}).then(result=>go({name:'task',id:result.id})).catch(()=>{});return;}
    const existing = state.tasks.find(`);
 s=replace(s,'<b>{contact.name}</b>','<b>{contact?.name}</b>');s=replace(s,'<small>{contact.subtitle}</small>','<small>{contact?.subtitle}</small>');
 s=replace(s,'<time>今天 14:20</time>','<time>{runtime?new Date().toLocaleDateString("zh-CN"):"今天 14:20"}</time>');
 s=replace(s,'{messages.map((message, index) => (','{messages.filter(message=>!chatQuery||message.text.includes(chatQuery)).map((message, index) => (');
 s=replace(s,'<button type="button" aria-label="添加内容">','<button type="button" aria-label="添加内容" onClick={()=>{saveDraft();setAssistOpen(true)}}>');
 s=replace(s,'            aria-label="发消息"','            aria-label="发消息"\n            onBlur={saveDraft}');
 s=replace(s,'<button type="button" aria-label="语音输入">','<button type="button" aria-label="语音输入" onClick={()=>notify("语音服务尚未配置")}>');
 s=s.replaceAll('disabled={!text.trim()}','disabled={!text.trim()||sending}');
 s=replace(s,'<input autoFocus placeholder="搜索与林嘉的聊天内容" />','<input autoFocus placeholder="搜索当前会话" value={chatQuery} onChange={event=>setChatQuery(event.target.value)}/>');
 s=replace(s,'onClick={() => go({ name: "chat", id: "partner-agent-linjia" })}','onClick={() => {saveDraft();setMoreOpen(false);setAssistOpen(true)}}');
 s=replace(s,'<span>和 Ta 的 Personal Agent 沟通</span>','<span>{runtime?"本人私密辅助":"和 Ta 的 Personal Agent 沟通"}</span>');
 s=replace(s,'        {searchOpen && (',`        {runtime&&conversation&&assistOpen&&<RootPortal><button className="v278-sheet-backdrop" aria-label="关闭辅助" onClick={()=>setAssistOpen(false)}/><section className="v278-half-sheet" role="dialog" aria-modal="true" style={{overflowY:'auto',maxHeight:'80%'}}><button className="v277-secondary" onClick={()=>setAssistOpen(false)}>关闭</button><PrivateAssist conversation={conversation} onFill={setText} go={go}/><section className="v277-edit-card"><h3>@ 会话成员</h3>{conversation.members?.filter(member=>member.id!==runtime.snapshot?.user.id).map(member=><label key={member.id}><input type="checkbox" checked={mentions.includes(member.id)} onChange={()=>setMentions(prev=>prev.includes(member.id)?prev.filter(value=>value!==member.id):[...prev,member.id])}/>{member.name}</label>)}<p>勾选后，下一条消息会向这些真人成员发送站内提醒。</p></section></section></RootPortal>}
        {searchOpen && (`);
 return s;
});
section('KnowledgeDetail',s=>{
 s=replace(s,'  const current =',"  const runtime=useRuntime();\n  const entity=runtime?.snapshot&&Object.values(runtime.snapshot.objects).flat().find(entry=>entry.id===item.id);\n  const current =");
 s=replace(s,'    if (!current || used) return;',`    if(runtime&&entity){void runtime.command('task.create',{goal:'阅读并核对资料：'+item.title,mode:entity.type==='document'?'read':'compose',source_refs:[entityRef(entity)],system:'explore'}).then(result=>go({name:'task',id:result.id})).catch(()=>{});return;}
    if (!current || used) return;`);
 s=replace(s,'<b>使用示例</b>','<b>{runtime?"正文":"使用示例"}</b>');
 s=replace(s,'<p>{item.example}</p>','<p style={{whiteSpace:"pre-wrap"}}>{item.example}</p>');
 s=replace(s,'disabled={!current || used}','disabled={runtime?!entity:!current || used}');
 s=replace(s,'{!current\n            ?', '{runtime?"以此资料创建任务草稿":!current\n            ?');return s;
});
section('MemoryDetail',s=>{
 s=replace(s,'  const [value, setValue]',"  const runtime=useRuntime();\n  const entity=runtime?.snapshot?.objects.memory.find(entry=>entry.id===item.id);\n  const [value, setValue]");
 s=replace(s,'  const save = () => {',`  const save = () => {
    if(runtime&&entity){void runtime.command('memory.decide',{...entityRef(entity),decision:value===item.value?'confirm':'correct',content:value}).then(()=>{notify('理解已保存');go({name:'memory'})}).catch(()=>{});return;}`);
 s=replace(s,'  const remove = () => {',`  const remove = () => {
    if(runtime&&entity){void runtime.command('memory.decide',{...entityRef(entity),decision:'delete'}).then(()=>go({name:'memory'})).catch(()=>{});return;}`);
 s=replace(s,'disabled={!value.trim() || value === item.value}','disabled={!value.trim() || (!runtime&&value === item.value)}');
 s=replace(s,'          保存修改','          {runtime&&value===item.value?"确认这条理解":"保存修改"}');
 s=replace(s,'      </section>\n    </main>',`        {runtime&&entity&&<div>{['defer','reject'].map(decision=><button className="v277-secondary" key={decision} onClick={()=>void runtime.command('memory.decide',{...entityRef(entity),decision}).then(()=>go({name:'memory'})).catch(()=>{})}>{decision==='defer'?'搁置':'否认'}</button>)}</div>}
      </section>\n    </main>`);return s;
});
section('MemoryPage',s=>{
 s=replace(s,'  const [filter, setFilter]', '  const runtime=useRuntime();\n  const [filter, setFilter]');
 s=s.replace('<b>128</b>有效记忆','<b>{runtime?state.memories.length:128}</b>有效记忆').replace('<b>7</b>天持续更新','<b>{runtime?state.memories.filter(item=>item.status===\'待确认\').length:7}</b>{runtime?"待确认":"天持续更新"}').replace('<b>94%</b>可信度','<b>{runtime?"待验证":"94%"}</b>{runtime?"跨情境理解":"可信度"}');
 s=s.replace('state.profile.role || "Elfred 产品负责人"','state.profile.role || (runtime?"尚未填写":"Elfred 产品负责人")').replace('<p>正在打造帮助用户发现机会并完成价值交付的 Personal Agent。</p>','<p>{runtime?state.profile.bio:"正在打造帮助用户发现机会并完成价值交付的 Personal Agent。"}</p>').replace('<small>9 条基础信息 · 今天更新</small>','<small>{runtime?"由本人维护的个人资料":"9 条基础信息 · 今天更新"}</small>').replace('<em>产品负责人</em>','<em>{runtime?state.profile.role:"产品负责人"}</em>');
 s=replace(s,'{showSocial && (','{showSocial && !runtime && (');
 s=replace(s,'      </div>\n      {alignmentOpen',`        {runtime&&<><section className="v277-memory-showcase"><h2>理解与来源</h2>{state.memories.filter(item=>filter==='全部'||item.group===filter).map(item=><button className="v277-identity-card" key={item.id} onClick={()=>go({name:'memory-detail',id:item.id})}><span><b>{item.label} · {item.status}</b><p>{item.value}</p></span><ChevronRight size={18}/></button>)}</section><AssetEditor onSaved={()=>{}}/></>}
      </div>\n      {alignmentOpen`);return s;
});
section('UtilityPage',s=>{
 s=replace(s,'  const [contact, setContact]', '  const runtime=useRuntime();\n  const [contact, setContact]');
 s=replace(s,'  if (kind === "add-friend")','  if(runtime)return <ConnectedUtility kind={kind} go={go} onBack={onBack}/>;\n  if (kind === "add-friend")');return s;
});
section('SettingsPage',s=>{
 const anchor='  const [active, setActive]';s=replace(s,anchor,'  const runtime=useRuntime();\n'+anchor);
 s=s.replace('86% · Lv.4','尚需验证');
 s=replace(s,'{active === "notifications" ? (','{runtime?<ConnectedSettings active={active} go={go}/>:active === "notifications" ? (');return s;
});
section('CommunityPage',s=>{
 s=replace(s,'  const [searchOpen, setSearchOpen]', '  const runtime=useRuntime();\n  const [searchOpen, setSearchOpen]');
 s=replace(s,'  const visiblePosts = communityPosts;',`  const visiblePosts:SocialPost[]=runtime?(runtime.snapshot?.objects.post||[]).filter(item=>!state.hiddenPostIds.includes(item.id)).map(item=>({id:item.id,name:entityText(item,'title'),date:new Date(item.created).toLocaleDateString('zh-CN'),text:entityText(item,'content'),likes:Number(item.data.likes||0),comments:Number(item.data.comments||0),avatar:'lin'})):communityPosts;`);
 s=replace(s,'  const toggleSaved = (id: string) => {',`  const toggleSaved = (id: string) => {
    if(runtime){void runtime.command('post.interact',{id,kind:'save'}).catch(()=>{});return;}`);
 s=replace(s,'onClick={() => go({ name: "community-post", id: communityPosts[0].id })}','onClick={() => go({ name: "community-post", id: runtime?"new":communityPosts[0].id })}');
 s=replace(s,'<b>本周值得参与的 3 个讨论</b>','<b>{runtime?"发起一个共同目标":"本周值得参与的 3 个讨论"}</b>');s=replace(s,'<small>社区精选 · 刚刚更新</small>','<small>{runtime?"明确任务、参与承诺与验收标准":"社区精选 · 刚刚更新"}</small>');
 s=replace(s,'const isLiked = liked.includes(post.id);',"const isLiked = runtime?runtime.snapshot?.objects.interaction.some(item=>item.data.object_id===post.id&&item.data.kind==='like'&&item.data.active):liked.includes(post.id);");
 s=replace(s,'                    setLiked((items) =>',"                    runtime?void runtime.command('post.interact',{id:post.id,kind:'like'}).catch(()=>{}):setLiked((items) =>");
 s=replace(s,'{post.likes + (isLiked ? 1 : 0)}','{post.likes + (!runtime&&isLiked ? 1 : 0)}');
 s=replace(s,'onClick={() => notify("帖子链接已复制")}',`onClick={() => {void navigator.clipboard.writeText(location.origin+location.pathname+'?post='+post.id).then(()=>notify('帖子链接已复制')).catch(()=>notify('复制失败，请重试'))}}`);
 s=replace(s,'      <section className="v277-social-feed">',`      {runtime&&runtime.snapshot?.objects.project.map(item=><button className="v277-community-featured" key={item.id} onClick={()=>go({name:'community-post',id:item.id})}><span><b>{entityText(item,'title')}</b><small>本人参与的项目 · 修订 {String(item.data.revision)}</small></span><ChevronRight size={20}/></button>)}
      <section className="v277-social-feed">`);return s;
});
section('CommunitySearchSheet',s=>{
 s=replace(s,'  const [query, setQuery]',"  const runtime=useRuntime();\n  const posts=runtime?(runtime.snapshot?.objects.post||[]).map(item=>({id:item.id,name:entityText(item,'title'),text:entityText(item,'content'),avatar:'lin'})):communityPosts;\n  const [query, setQuery]");
 s=s.replace('communityPosts.filter','posts.filter').replace(': communityPosts;',': posts;');return s;
});
section('MyToolsPage',s=>{s=replace(s,'  const [tab, setTab]', '  const runtime=useRuntime();\n  const [tab, setTab]');const idx=s.indexOf('  return (');s=s.slice(0,idx)+`  if(runtime)return <main className="v277-page v278-utility-page"><AppHeader title="我的工具" onBack={onBack}/><MethodsPanel go={go}/></main>;\n`+s.slice(idx);return s;});
fs.writeFileSync(path,source);
