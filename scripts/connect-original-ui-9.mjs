import fs from 'node:fs';
const edit=(path,fn)=>fs.writeFileSync(path,fn(fs.readFileSync(path,'utf8')));
edit('app/v28/core/runtime-panels.tsx',s=>s.replace('<header className="v277-app-head"><button type="button" aria-label="返回" onClick={onBack}><ArrowLeft size={21}/></button><h2>{title}</h2></header>','<header className="v277-page-head"><button className="v277-icon-button" type="button" aria-label="返回" onClick={onBack}><ArrowLeft size={21}/></button><div><h1>{title}</h1></div><span className="v277-head-right"/></header>'));
edit('app/v28/legacy/legacy-ui.tsx',s=>{
 s=s.replace('onClick={() => runtime?go({name:"community-post",id:item.taskId}):openTask(item.taskId)}','onClick={() => openTask(item.taskId)}');
 const start=s.indexOf('<section className="v277-project-list">');
 s=s.slice(0,start)+s.slice(start).replace('runtime.snapshot.objects.feedback','runtime.snapshot!.objects.feedback').replace('runtime.snapshot.objects.release','runtime.snapshot!.objects.release').replace('onClick={() => openTask(item.taskId)}','onClick={() => runtime?go({name:"community-post",id:item.taskId}):openTask(item.taskId)}');
 s=s.replace('runtime?state.tasks.filter(task=>task.status!=="已完成").map',`runtime?state.tasks.filter(task=>task.status!=="已完成"&&String(new Date(Number(runtime.snapshot?.objects.task.find(item=>item.id===task.id)?.data.not_before)||Date.now()).getDate())===selectedDate).map`);
 s=s.replace('{selectedDate === todayDate && visibleSchedule.length ? (','{(runtime||selectedDate === todayDate) && visibleSchedule.length ? (');
 return s;
});
edit('app/v28/features/knowledge/knowledge-page.tsx',s=>s.replace('      className="v277-page v277-library-page v277-knowledge-overview"','      data-connected={runtime?"true":undefined}\n      className="v277-page v277-library-page v277-knowledge-overview"').replaceAll('if (event.currentTarget.scrollTop !== 0)','if (!runtime&&event.currentTarget.scrollTop !== 0)'));
