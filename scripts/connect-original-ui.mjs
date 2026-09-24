import {readFileSync,writeFileSync} from 'node:fs';
function edit(path,fn){const source=readFileSync(path,'utf8').replace(/\r\n/g,'\n');writeFileSync(path,fn(source));}
function replace(source,old,next){if(!source.includes(old))throw new Error('Missing edit anchor: '+old.slice(0,100));return source.replace(old,next);}
function section(source,name,fn){const start=source.indexOf('export function '+name+'(');if(start<0)throw new Error(name);let end=source.indexOf('\nexport ',start+1);if(end<0)end=source.length;return source.slice(0,start)+fn(source.slice(start,end))+source.slice(end);}
edit('app/v28/features/home/home-page.tsx',source=>{
  source=replace(source,'import type { Screen } from "../../core/screen";','import type { Screen } from "../../core/screen";\nimport {useRuntime} from "../../core/runtime-context";\nimport type {V277AgentId} from "../../../v27-7-state";');
  source=replace(source,'  const [playerCollapsed','  const runtime=useRuntime();\n  const moments=runtime?(runtime.snapshot?.objects.feed||[]).filter(item=>!state.hiddenPostIds.includes(item.id)).map(item=>({id:item.id,agent:(item.data.system==="advise"?"advisor":item.data.system) as V277AgentId,variant:"brief" as const,type:"观点动态" as const,period:"今天" as const,time:new Date(item.created).toLocaleDateString("zh-CN"),title:String(item.data.title),summary:String(item.data.summary),target:{name:"task" as const,id:String(item.data.task_id)}})):agentMoments;\n  const [playerCollapsed');
  source=replace(source,'const item = dailyBriefs[kind];','const item = runtime?{...dailyBriefs[kind],summary:state.tasks.length?`${state.tasks.filter(task=>task.status!=="已完成").length} 项待推进，${state.tasks.filter(task=>task.status==="已完成").length} 项已验收。`:"从今天的一件真实需求开始。",stats:"依据你的任务记录 · 尚未自动调整计划"}:dailyBriefs[kind];');
  source=replace(source,'<small>L1</small>','<small>{runtime?"本人":"L1"}</small>');
  source=replace(source,'{agentMoments.slice(0, 6).map','{moments.slice(0, 6).map');
  source=replace(source,'<div className="v278-home-feed-list">','<div className="v278-home-feed-list">{runtime&&moments.length===0&&<div className="v277-empty"><p>尚无可发布的真实进展。</p><button onClick={()=>go({name:"new-task"})}>从一个目标开始</button></div>}');return source;
});
edit('app/v28/features/messages/messages-page.tsx',source=>{
  source=replace(source,'import type { Screen } from "../../core/screen";','import type { Screen } from "../../core/screen";\nimport {useRuntime} from "../../core/runtime-context";');
  source=replace(source,'  const [filter','  const runtime=useRuntime();\n  const [filter');
  source=replace(source,'  const contacts = [','  const contacts = runtime?(runtime.snapshot?.objects.conversation||[]).map(item=>({id:item.id,name:String(item.data.title),text:String(runtime.snapshot?.objects.message.filter(message=>message.space===item.id).sort((a,b)=>Number(b.data.seq)-Number(a.data.seq))[0]?.data.text||"暂无消息"),time:new Date(item.updated).toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"}),badge:item.unread||0,kind:item.data.kind==="group"?"群聊":"私聊",avatar:item.data.kind==="group"?"avatar-group":"avatar-lin"})):[');
  source=replace(source,'<section className="v277-story-row">','{!runtime&&<section className="v277-story-row">');
  source=replace(source,'</section>\n        <nav','</section>}\n        <nav');
  source=replace(source,'<section className="v277-conversations v277-reference-conversations">','<section className="v277-conversations v277-reference-conversations">{runtime&&visible.length===0&&<div className="v277-empty"><p>尚无真人会话。添加好友后由对方确认。</p></div>}');return source;
});
edit('app/v28/legacy/legacy-ui.tsx',source=>{
  source=section(source,'AgentMomentCard',part=>replace(part,'  const reply = replies[moment.agent];','  const runtime=useRuntime();\n  const reply = runtime?undefined:replies[moment.agent];'));
  source=section(source,'TasksPage',part=>{
    part=replace(part,'  const [view,','  const runtime=useRuntime();\n  const todayDate=runtime?String(new Date().getDate()):"14";\n  const [view,');
    part=replace(part,'useState("14")','useState(todayDate)');
    part=replace(part,'const handoffTask = (taskId: string) => {','const handoffTask = (taskId: string) => {\n    if(runtime){go({name:"task",id:taskId});notify("请核对范围后确认运行");return;}');
    part=replace(part,'  const schedule = [','  const schedule = runtime?state.tasks.filter(task=>task.status!=="已完成").map(task=>({taskId:task.id,category:"工作",time:task.updatedAt,title:task.title,meta:task.nextStep,action:task.nextStep,actionClass:task.status==="进行中"?"running":"waiting",icon:Clock3})):[');
    part=replace(part,'  const projects = [','  const projects = runtime?state.tasks.filter(task=>task.status==="已完成").map(task=>({taskId:task.id,title:task.title,copy:task.brief,progress:100,comments:0,links:task.knowledgeIds.length})):[');
    part=replace(part,'{[\n              ["一", "12"],','{(runtime?Array.from({length:6},(_,index)=>{const day=new Date();day.setDate(day.getDate()+index-2);return [["日","一","二","三","四","五","六"][day.getDay()],String(day.getDate())]}):[\n              ["一", "12"],');
    part=replace(part,'].map(([day, date])',']).map(([day, date])');
    part=part.replaceAll('selectedDate === "14"','selectedDate === todayDate');
    part=replace(part,'`9 月 ${selectedDate} 日`','`${new Date().getMonth()+1} 月 ${selectedDate} 日`');return part;
  });
  source=section(source,'AgentExperiencePage',part=>{
    part=replace(part,'  const agent =','  const runtime=useRuntime();\n  const agent =');
    part=replace(part,'    if (!input.trim()) return;','    if (!input.trim()) return;\n    if(runtime){void runtime.command("task.create",{goal:input.trim(),system:id==="advisor"?"advise":id,mode:/^(搜索|检索|查找)/.test(input)?"search":"compose"}).then(result=>go({name:"task",id:result.id})).catch(()=>{});return;}');
    part=part.replaceAll('{experience.level}','{runtime?"尚需理解证据":experience.level}');return part;
  });
  return source;
});
