import fs from 'node:fs';const p='app/v28/legacy/legacy-ui.tsx';let source=fs.readFileSync(p,'utf8');
const replace=(s,a,b)=>{if(!s.includes(a))throw Error(a.slice(0,100));return s.replace(a,b)};
const section=(name,fn)=>{const start=source.indexOf('export function '+name+'(');let end=source.indexOf('\nexport ',start+1);if(start<0)throw Error(name);if(end<0)end=source.length;source=source.slice(0,start)+fn(source.slice(start,end))+source.slice(end)};
section('NewTaskPage',s=>{
 s=replace(s,'useState("今天 14:00")','useState(runtime?"确认后立即":"今天 14:00")');
 s=replace(s,'useState("工作")','useState(runtime?"模型生成":"工作")');
 const start=s.indexOf("    if(runtime){void runtime.command('task.create'");const end=s.indexOf('\n    const task:',start);
 if(start<0||end<0)throw Error('task create');
 s=s.slice(0,start)+`    if(runtime){const notBefore=time==='明天 09:00'?new Date(new Date().getFullYear(),new Date().getMonth(),new Date().getDate()+1,9).getTime():time==='一小时后'?Date.now()+3600000:0;const projectEntity=runtime.snapshot?.objects.project.find(item=>item.data.title===project);void runtime.command('task.create',{goal:goal.trim().replace(/^(搜索|检索|查找)[：:\\s]*/,''),mode:mode==='快速待办'?'manual':type==='资料检索'||/^(搜索|检索|查找)/.test(goal.trim())?'search':type==='文件读取'?'read':'compose',system:mode==='Agent 执行'?'execute':'create',source_refs:sourceRefs,project_id:projectEntity?.id,not_before:notBefore}).then(result=>{notify('任务草稿已保存，确认后才运行');go({name:'task',id:result.id})}).catch(()=>{});return;}`+s.slice(end);
 s=replace(s,'options={["今天 14:00", "明天 09:00", "本周五 18:00"]}','options={runtime?["确认后立即","一小时后","明天 09:00"]:["今天 14:00", "明天 09:00", "本周五 18:00"]}');
 s=replace(s,'options={["工作", "个人", "协作"]}','options={runtime?["模型生成","资料检索","文件读取"]:["工作", "个人", "协作"]}');
 s=replace(s,'options={["未选择", "品牌官网", "V27.8 优化"]}','options={runtime?["未选择",...(runtime.snapshot?.objects.project.map(item=>entityText(item,"title"))||[])]:["未选择", "品牌官网", "V27.8 优化"]}');
 s=replace(s,'options={["暂不添加", "Mia", "Kevin"]}','options={runtime?["暂不添加"]:["暂不添加", "Mia", "Kevin"]}');
 s=replace(s,'      <section className="v281-task-settings">',`      {runtime&&<section className="v277-edit-card"><h3>选择已有资料（最多 20 项）</h3>{[...(runtime.snapshot?.objects.document||[]),...(runtime.snapshot?.objects.knowledge||[])].filter(item=>item.data.status!=='archived').map(item=><label key={item.id}><input type="checkbox" checked={sourceRefs.some(ref=>ref.id===item.id)} onChange={()=>setSourceRefs(prev=>prev.some(ref=>ref.id===item.id)?prev.filter(ref=>ref.id!==item.id):[...prev,entityRef(item)])}/>{entityText(item,'title')}</label>)}</section>}
      <section className="v281-task-settings">`);return s;
});
section('TaskDetail',s=>{
 s=replace(s,'  const [acceptance,setAcceptance]',"  const [feedback,setFeedback]=useState('');\n  const [acceptance,setAcceptance]");
 s=replace(s,'const item = v277Knowledge.find((entry) => entry.id === id);',`const entity=runtime?.snapshot?.objects.knowledge.find(entry=>entry.id===id);const item = runtime?entity?{title:entityText(entity,'title'),source:entity.type}:undefined:v277Knowledge.find((entry) => entry.id === id);`);
 s=replace(s,"{['ready','blocked','failed','partial','paused','cancelled'].includes(String(actual.data.status))&&<button", "{actual.data.mode!=='manual'&&['ready','blocked','failed','partial','paused','cancelled'].includes(String(actual.data.status))&&<button");
 s=replace(s,"          {run&&['queued','running']",`          {actual.data.mode==='manual'&&actual.data.status==='ready'&&<><label className="v277-field"><span>本人实际完成的结果</span><textarea value={feedback} onChange={event=>setFeedback(event.target.value)}/></label><button className="v277-primary" disabled={!feedback.trim()} onClick={()=>void runtime.command('task.complete_manual',{...entityRef(actual),confirm:true,result:feedback}).catch(()=>{})}>确认本人已完成并保存成果</button></>}
          {['blocked','failed','partial','paused','cancelled','ready'].includes(String(actual.data.status))&&<><label><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)}/>重新确认原目标、资料与模型发送范围</label><button className="v277-secondary" disabled={!consent} onClick={()=>void runtime.command('task.renew_approval',{...entityRef(actual),confirm:true,model_consent:consent}).catch(()=>{})}>更新已撤销或过期的授权</button></>}
          {actual.data.status==='partial'&&<button className="v277-secondary" onClick={()=>void runtime.command('run.replan',entityRef(actual)).catch(()=>{})}>按本人反馈进行有限修订</button>}
          {run&&['queued','running']`);
 s=replace(s,"feedback:'本人认为仍有缺口，需要修改'","feedback:feedback||'本人认为仍有缺口，需要修改'");
 s=replace(s,"{['awaiting_acceptance','awaiting_review'].includes(String(actual.data.status))&&<>","{['awaiting_acceptance','awaiting_review'].includes(String(actual.data.status))&&<><label className=\"v277-field\"><span>需要修订的具体缺口</span><textarea value={feedback} onChange={event=>setFeedback(event.target.value)}/></label>");
 s=replace(s,'        {runtime&&actual?<>',`        {runtime&&actual?<><p>验收标准：{entityText(actual,'criteria')}</p><p>权限边界：{entityText(actual,'constraints')}</p><p>有限停止条件：最多 {String((actual.data.stop as {maxAttempts:number}).maxAttempts)} 次尝试，{String((actual.data.stop as {maxCalls:number}).maxCalls)} 次工具调用。已调用 {String(actual.data.calls)} 次。</p>{Boolean(actual.data.not_before)&&<p>排期：{new Date(Number(actual.data.not_before)).toLocaleString('zh-CN')}（需本人启动后进入队列）</p>}`);
 return s;
});
fs.writeFileSync(p,source);
