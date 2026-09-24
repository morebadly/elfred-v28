import fs from 'node:fs';
const replace=(s,a,b)=>{if(!s.includes(a))throw Error(a.slice(0,100));return s.replace(a,b)};
const p='app/v28/legacy/legacy-ui.tsx';let source=fs.readFileSync(p,'utf8');
const section=(name,fn)=>{const start=source.indexOf('export function '+name+'(');let end=source.indexOf('\nexport ',start+1);if(start<0)throw Error(name);if(end<0)end=source.length;source=source.slice(0,start)+fn(source.slice(start,end))+source.slice(end)};
section('DailyBriefPage',s=>{
 s=replace(s,'  const [moreOpen, setMoreOpen]',`  const runtime=useRuntime();
  const localDate=new Intl.DateTimeFormat('en-CA',{timeZone:String(runtime?.snapshot?.objects.settings[0].data.timezone||'Asia/Shanghai'),year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const brief=runtime?.snapshot?.objects.brief.find(item=>item.data.kind===kind&&item.data.local_date===localDate);
  useEffect(()=>{if(runtime&&!brief)void runtime.command('brief.create',{kind}).catch(()=>{});},[kind,localDate]);
  const [moreOpen, setMoreOpen]`);
 s=replace(s,'    const shareText =',`    if(runtime){try{await navigator.clipboard.writeText(title+'\\n'+state.tasks.map(task=>task.title+' · '+task.nextStep).join('\\n'));notify('简报摘要已复制')}catch{notify('复制失败')}setMoreOpen(false);return;}
    const shareText =`);
 s=replace(s,'    const message: V277Message =',`    if(runtime){void runtime.command('task.create',{goal:question,mode:'compose',system:'execute'}).then(result=>go({name:'task',id:result.id})).catch(()=>{});return;}
    const message: V277Message =`);
 s=replace(s,'<p>{dailyBriefs[kind].summary}</p>','<p>{runtime?"依据当前真实任务记录，请核对今天的重点与进展。":dailyBriefs[kind].summary}</p>');
 s=replace(s,'<strong>{dailyBriefs[kind].stats}</strong>','<strong>{runtime?state.tasks.length+" 项任务 · "+state.tasks.filter(task=>task.status==="已完成").length+" 项已验收":dailyBriefs[kind].stats}</strong>');
 s=replace(s,'        {kind === "morning" && (',`        {runtime&&<><section className="v283-brief-section"><h3>{kind==='morning'?'今日安排':'当前进度'}</h3><div className="v283-status-list">{state.tasks.length?state.tasks.map(task=><button key={task.id} onClick={()=>go({name:'task',id:task.id})}><CheckCircle2 size={22}/><b>{task.title}</b><span>{task.nextStep}</span><ChevronRight size={18}/></button>):<p className="v277-empty">还没有任务，先明确一件想推进的事。</p>}</div></section><section className="v283-brief-section"><h3>需要你决定</h3><div className="v283-decision-card"><p>核对简报只保存本次确认；每项任务的目标、授权和验收在任务详情分别处理。</p><button className="v283-brief-primary" disabled={!brief} onClick={()=>brief&&void runtime.command('brief.confirm',{...entityRef(brief),note:'本人已核对当期任务记录'}).then(()=>notify('简报确认已保存')).catch(()=>{})}>{brief?.data.status==='acknowledged'?'已确认本次简报':'确认已核对'}</button><button className="v277-secondary" onClick={()=>brief&&void runtime.command('brief.refresh',entityRef(brief)).catch(()=>{})}>更新简报事实快照</button><button className="v277-secondary" onClick={()=>go({name:'new-task'})}>补充一个目标</button></div></section></>}
        {!runtime&&kind === "morning" && (`);
 s=replace(s,'{kind === "noon" && (','{!runtime&&kind === "noon" && (');
 s=replace(s,'<button type="button" aria-label="语音输入">','<button type="button" aria-label="语音输入" onClick={()=>notify("语音服务尚未配置")}>');return s;
});
section('BriefSettingsSheet',s=>{
 s=replace(s,'  const [morning, setMorning]',`  const runtime=useRuntime();
  initial={...initial,...runtime?.snapshot?.objects.settings[0].data.brief_preferences as Partial<BriefPreferences>};
  const [morning, setMorning]`);
 s=replace(s,'    window.localStorage.setItem(',`    if(runtime?.snapshot){void runtime.command('brief.preferences',{...entityRef(runtime.snapshot.objects.settings[0]),preferences:next}).then(()=>{onSave?.(next);onClose()}).catch(()=>{});return;}
    window.localStorage.setItem(`);return s;
});
section('FeedPage',s=>{
 s=replace(s,'  const [agentFilter, setAgentFilter]',`  const runtime=useRuntime();
  const moments:AgentMoment[]=runtime?(runtime.snapshot?.objects.feed||[]).filter(item=>!state.hiddenPostIds.includes(item.id)).map(item=>({id:item.id,agent:(item.data.system==='advise'?'advisor':item.data.system) as V277AgentId,variant:'brief',type:'观点动态',period:new Date(item.created).toDateString()===new Date().toDateString()?'今天':'本月',time:new Date(item.created).toLocaleDateString('zh-CN'),title:entityText(item,'title'),summary:entityText(item,'summary'),target:{name:'task',id:entityText(item,'task_id')}})):agentMoments;
  const [agentFilter, setAgentFilter]`);
 s=replace(s,'const visible = agentMoments.filter(','const visible = moments.filter(');return s;
});
section('AgentHistoryDrawer',s=>{
 s=replace(s,'onSelect: () => void;','onSelect: (taskId?:string) => void;');
 s=replace(s,'  const agent =','  const runtime=useRuntime();\n  const agent =');
 s=replace(s,'  const conversations = [',`  const tasks=runtime?.snapshot?.objects.task.filter(item=>item.data.system===(id==='advisor'?'advise':id))||[];
  const conversations = (runtime?tasks.map(item=>entityText(item,'title')):[`);
 s=replace(s,'  ].filter((item) => item.toLowerCase()', '  ]).filter((item) => item.toLowerCase()');
 s=replace(s,'onClick={onSelect}','onClick={()=>onSelect(runtime?tasks.find(item=>item.data.title===conversation)?.id:undefined)}');
 s=replace(s,'{experience.level} · {experience.duty}','{runtime?"本人任务记录":experience.level} · {experience.duty}');return s;
});
section('AgentExperiencePage',s=>{
 s=replace(s,'goal:input.trim(),','goal:input.trim().replace(/^(搜索|检索|查找)[：:\\s]*/,""),');
 s=replace(s,'<button type="button" aria-label="添加附件">','<button type="button" aria-label="添加附件" onClick={()=>go({name:"new-task"})}>');
 s=replace(s,'<button type="button" aria-label="语音输入">','<button type="button" aria-label="语音输入" onClick={()=>runtime?.report("语音服务尚未配置")}>');
 s=replace(s,'onSelect={() => {','onSelect={(taskId) => {');s=replace(s,'            go({ name: "chat", id });','            go(taskId?{name:"task",id:taskId}:{ name: "chat", id });');return s;
});
section('AgentSettingsPage',s=>{
 s=replace(s,'  const agent =',`  const runtime=useRuntime();
  const runtimeSetting=runtime?.snapshot?.objects.settings[0];
  const prefs=(runtimeSetting?.data.agents as Record<string,{enabled:boolean;duty:string;focus:string}>|undefined)?.[id==='advisor'?'advise':id];
  const agent =`);
 s=replace(s,'useMemo(() => readAgentSettings(id), [id])','useMemo(() => runtime?{enabled:prefs?.enabled!==false,values:{名称与职责:prefs?.duty||experience.duty,关注范围:prefs?.focus||"仅当前目标",知识来源:"仅任务中明确选择的资料",使用模型:runtime.snapshot?.provider.model||"未配置",主动频率:"本人发起",可用工具:"本地检索、文档读取、模型生成",外部操作确认:"始终询问"}}:readAgentSettings(id), [id])');
 s=replace(s,'    window.localStorage.setItem(','    if(runtime)return;\n    window.localStorage.setItem(');
 s=replace(s,'  const openEditor = (label: string, options: string[]) =>\n    setEditor({ label, value: values[label], options });',`  const savePreferences=(nextEnabled:boolean,nextValues:Record<string,string>)=>{if(runtime&&runtimeSetting)void runtime.command('agent.preferences',{...entityRef(runtimeSetting),system:id==='advisor'?'advise':id,enabled:nextEnabled,duty:nextValues.名称与职责,focus:nextValues.关注范围}).then(()=>{setEnabled(nextEnabled);setValues(nextValues)}).catch(()=>{});else {setEnabled(nextEnabled);setValues(nextValues)}};
  const openEditor = (label: string, options: string[]) => {
    if(runtime&&!['名称与职责','关注范围'].includes(label)){notify(label+'：'+values[label]);return;}
    setEditor({ label, value: values[label], options });
  };`);
 s=replace(s,'onClick={() => setEnabled((current) => !current)}','onClick={() => savePreferences(!enabled,values)}');
 s=replace(s,'          setEnabled(false);','          savePreferences(false,values);');
 s=replace(s,'            setValues((current) => ({ ...current, [editor.label]: value }));','            savePreferences(enabled,{ ...values, [editor.label]: value });');return s;
});
section('ProfileShareSheet',s=>{
 s=replace(s,'  const startY =','  const runtime=useRuntime();\n  const startY =');
 s=replace(s,'    const shareData =',`    if(runtime&&state.profileVisibility!=='public'){notify('请先确认公开称呼和简介');return;}
    if(runtime&&channel==='生成海报'){notify('请使用复制链接或系统分享');return;}
    const shareData =`);
 s=replace(s,'url: window.location.origin + window.location.pathname,','url: runtime?window.location.origin+"/api/elfred/profiles/"+encodeURIComponent(username):window.location.origin + window.location.pathname,');
 s=replace(s,'    } catch {}\n    notify(channel', '    } catch {notify("复制失败，请重试");return;}\n    notify(channel');
 s=replace(s,'                onClick={() =>\n                  setState((current) => ({','                onClick={() => {if(runtime?.snapshot){if(value==="contacts"){notify("联系人可见尚未开放，请选择公开或仅自己");return;}void runtime.command("profile.publish",{...entityRef(runtime.snapshot.objects.profile[0]),confirm:true,publish:value==="public"}).catch(()=>{});return;}\n                  setState((current) => ({');
 s=replace(s,'                    profileVisibility: value,\n                  }))\n                }','                    profileVisibility: value,\n                  }));}\n                }');return s;
});
fs.writeFileSync(p,source);
