import {fail,now} from './store.mjs';
import {taskCommand} from './runtime.mjs';
import {knowledgeCommand} from './knowledge.mjs';
import {enumeration,string} from './policy.mjs';
import {dailyTasks,localDay} from '../../app/v28/core/local-day.mjs';

export function briefFacts(store,user,timezone,day) {
  const all=store.visible(user,'task').filter(task=>!task.data.internal_search),today=new Set(dailyTasks(all,timezone,day).map(task=>task.id));
  return all.filter(task=>today.has(task.id)||task.data.status==='draft').map(task=>({task_id:task.id,today:today.has(task.id),version:task.version,title:task.data.title,status:task.data.status,planned_date:task.data.planned_date||null,plan_note:task.data.plan_note||'',focus:task.data.focus_date===day}));
}
function suggestions(facts,day){
 const tomorrow=new Date(Date.parse(day+'T00:00:00Z')+86400000).toISOString().slice(0,10);
 return facts.filter(f=>f.today&&!['completed','cancelled','archived'].includes(f.status)).map(f=>({id:f.task_id+':'+f.version,task_id:f.task_id,version:f.version,kind:['blocked','failed','partial'].includes(f.status)?'help':f.status==='paused'?'defer':'continue',reason:['blocked','failed','partial'].includes(f.status)?'任务状态显示遇到阻塞，需要先核对缺失条件':f.status==='paused'?'任务已暂停，可将安排顺延后再确认启动':'当前仍有未完成事项，建议保持重点并核对进展',note:['blocked','failed','partial'].includes(f.status)?'先查看运行错误与缺失条件，必要时向协作者求助':f.status==='paused'?'顺延此事项，保留已完成结果':'继续当前重点，完成后核对成果',planned_date:f.status==='paused'?tomorrow:day}));
}

export function homeCommand(store,user,action,input) {
  if(action==='brief.followup'){
    const brief=store.expect(store.owned(user,input.id,'brief'),input.version);
    if(!['confirmed','corrected'].includes(brief.data.review?.decision)||input.confirm!==true)fail('CONFIRMATION_REQUIRED','先核对反思，再确认具体延续内容');
    for(const fact of brief.data.reflection?.facts||[])store.expect(store.read(user,fact.task_id,'task'),fact.version);
    const kind=enumeration(input.kind,['task','memory'],'处理方式'),content=string(input.content,'延续内容',3000);
    const source_refs=(brief.data.reflection?.facts||[]).map(f=>({id:f.task_id,version:f.version}));
    const result=kind==='task'?taskCommand(store,user,'task.create',{goal:content,mode:'manual',system:'execute',source_refs}):knowledgeCommand(store,user,'memory.create',{content,scope:input.system||'owner',risk:'high',source_refs,purpose:'来自本人核对的晚间反思'});
    const object=store.get(result.id);store.update(object,{...object.data,origin_brief_id:brief.id},user);return result;
  }
  if (!['brief.create','brief.refresh','brief.confirm','brief.suggestion'].includes(action)) return null;
  const settings=store.visible(user,'settings')[0],timezone=settings.data.timezone;
  const today=localDay(new Date(),timezone);
  if(action==='brief.create') {
    const kind=enumeration(input.kind,['morning','noon','evening'],'时段');
    const facts=briefFacts(store,user,timezone,today);
    return {id:store.unique('brief',`${user}:${timezone}:${today}:${kind}`,()=>store.add('brief',user,{local_date:today,timezone,kind,status:'ready',facts,suggestions:suggestions(facts,today),proposal:'依据当前任务状态提出安排建议，由本人接受、修改或拒绝。',acknowledged_actions:[]})).id};
  }
  const brief=store.expect(store.owned(user,input.id,'brief'),input.version);
  if(brief.data.local_date!==today||brief.data.timezone!==timezone) fail('BRIEF_EXPIRED','这是历史简报，请回到今天的简报操作',409);
  if(action==='brief.refresh'){const facts=briefFacts(store,user,timezone,today);return {id:store.update(brief,{...brief.data,facts,suggestions:suggestions(facts,today),refreshed_at:now()},user).id};}
  if(action==='brief.suggestion'){
    const proposal=(brief.data.suggestions||[]).find(s=>s.id===input.suggestion_id);if(!proposal)fail('NOT_FOUND','建议不存在，请更新事实快照');
    if((brief.data.suggestion_decisions||[]).some(d=>d.id===proposal.id))fail('ALREADY_REVIEWED','这项建议已处理');
    const decision=enumeration(input.decision,['accept','reject'],'建议决定');
    if(decision==='accept'){
      const task=store.expect(store.owned(user,proposal.task_id,'task'),proposal.version);
      if(['completed','archived','cancelled'].includes(task.data.status))fail('INVALID_STATE','任务状态已变化');
      store.update(task,{...task.data,planned_date:proposal.planned_date,focus_date:proposal.planned_date,plan_note:proposal.note,plan_brief_id:brief.id},user);
    }
    return {id:store.update(brief,{...brief.data,suggestion_decisions:[...(brief.data.suggestion_decisions||[]),{id:proposal.id,decision,at:now()}],facts:briefFacts(store,user,timezone,today)},user).id};
  }
  const actions=input.actions||[];
  if(!Array.isArray(actions)||actions.length>30) fail('INVALID_INPUT','每次最多确认 30 项安排');
  const seen=new Set();
  // Validate the entire batch before writing; the surrounding command is transactional.
  const checked=actions.map(item=>{
    if(!item||seen.has(item.task_id)) fail('INVALID_INPUT','同一任务只能确认一项调整');
    seen.add(item.task_id);
    const fact=brief.data.facts.find(fact=>fact.task_id===item.task_id);
    if(!fact||fact.version!==item.version) fail('VERSION_CONFLICT','简报来源已变化，请更新事实快照后重新确认',409);
    const task=store.expect(store.owned(user,item.task_id,'task'),item.version);
    if(['completed','archived','cancelled'].includes(task.data.status)) fail('INVALID_STATE','已结束的任务不能调整今日安排',409);
    const kind=enumeration(item.kind,['focus','adjust'],'简报动作');
    const note=kind==='adjust'?string(item.note,'下一步调整',1000):'';
    return {task,kind,note};
  });
  const applied=checked.map(({task,kind,note})=>{
    const updated=store.update(task,{...task.data,focus_date:today,...(kind==='adjust'?{plan_note:note}:{}),planned_date:today,today_admission:{important:true,relevant:true,actionable:true,confirmed_at:now()},plan_brief_id:brief.id},user);
    return {task_id:task.id,kind,note,from_version:task.version,to_version:updated.version,at:now()};
  });
  return {id:store.update(brief,{...brief.data,status:'acknowledged',note:typeof input.note==='string'?input.note.slice(0,2000):'',facts:briefFacts(store,user,timezone,today),acknowledged_actions:[...(brief.data.acknowledged_actions||[]),...applied]},user).id};
}
