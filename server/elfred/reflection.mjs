import {fail,now} from './store.mjs';
import {string,DEFAULT_STOP} from './policy.mjs';
import {taskCommand} from './runtime.mjs';
import {sourceRefs} from './knowledge.mjs';
import {resultReceipts} from './agent-plan.mjs';
import {briefFacts} from './home.mjs';
import {localDay} from '../../app/v28/core/local-day.mjs';

export function reflectionCommand(store,user,action,input){
 if(!['brief.reflect','brief.reflection.apply'].includes(action))return null;
 const brief=store.expect(store.owned(user,input.id,'brief'),input.version),timezone=store.visible(user,'settings')[0].data.timezone;
 if(brief.data.kind!=='evening'||brief.data.local_date!==localDay(new Date(),timezone))fail('BRIEF_EXPIRED','请在今日晚间回顾中核对');
 if(action==='brief.reflect'){
  if(input.confirm!==true||input.model_consent!==true)fail('CONSENT_REQUIRED','请确认所选记录与本次模型调用');
  const refs=sourceRefs(store,user,input.source_refs,20),today=briefFacts(store,user,timezone,brief.data.local_date).filter(f=>f.today);
  if(!refs.length)fail('SOURCE_REQUIRED','请选择至少一条今日任务记录');
  const facts=refs.map(ref=>{const fact=today.find(f=>f.task_id===ref.id&&f.version===ref.version);if(!fact)fail('SOURCE_CHANGED','所选今日记录已变化，请刷新后重选');return fact;});
  const resource=store.add('resource',user,{title:'晚间反思：本次选定的事实快照',content:JSON.stringify(facts),source_refs:refs,status:'active',internal_search:true});
  const task=taskCommand(store,user,'task.create',{system:'advise',goal:'作为 Person Agent 的晚间反思辅助，只依据本次事实快照提出可被否认的解释，不推断稳定人格，不替用户接受任务，不修改安排。只输出 JSON：{"explanation":"当前解释（明确是推断）","alternative":"替代解释或缺失信息","understanding":"一条待本人核对的新理解","evidence_ids":["实际快照中的任务ID"],"continuation":"下一步建议，不是已执行动作","routing":"最小必要上下文建议，不自动共享"}。没有依据时明确不知道。',review_mode:'single',source_refs:[{id:resource.id,version:resource.version}],stop:{...DEFAULT_STOP,maxCalls:1,maxUnits:1000}});
  store.update(store.get(task.id),{...store.get(task.id).data,internal_search:true,reflection_brief_id:brief.id,reflection_facts:facts},user);
  taskCommand(store,user,'task.confirm',{id:task.id,version:store.get(task.id).version,confirm:true,model_consent:true});taskCommand(store,user,'run.start',{id:task.id,version:store.get(task.id).version});
  return {id:store.update(brief,{...brief.data,reflection_task_id:task.id},user).id,task_id:task.id};
 }
 const task=store.owned(user,brief.data.reflection_task_id,'task'),run=store.expect(store.owned(user,task.data.run_id,'run'),input.run_version);
 if(input.run_id!==run.id||!['completed','awaiting_review'].includes(run.data.status))fail('RESULT_CHANGED','请核对当前已完成的反思结果');
 let parsed;try{parsed=JSON.parse(resultReceipts(run.data.receipts).find(r=>typeof r.output==='string')?.output.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));}catch{fail('REFLECTION_INVALID','反思格式不完整，保留原任务记录，可调整后重试');}
 const facts=task.data.reflection_facts;
 if(!Array.isArray(parsed.evidence_ids)||!parsed.evidence_ids.length||parsed.evidence_ids.some(id=>!facts.some(f=>f.task_id===id)))fail('REFLECTION_INVALID','反思缺少本次记录中的有效依据');
 for(const fact of facts)store.expect(store.read(user,fact.task_id,'task'),fact.version);
 const candidate=Object.fromEntries(['explanation','alternative','understanding','continuation','routing'].map(key=>[key,string(parsed[key],'反思内容',2000)]));
 return {id:store.update(brief,{...brief.data,reflection:{...candidate,evidence_ids:[...new Set(parsed.evidence_ids)],facts,task_id:task.id,run_id:run.id,run_version:run.version,generated_at:now(),status:'pending'},review:null},user).id};
}
