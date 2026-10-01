import {fail,now} from './store.mjs';
import {toolLibraryCommand} from './tool-library.mjs';

const excluded=task=>task.data.agent_chat||task.data.internal_search||task.data.internal_tool_generation||task.data.internal_peer_comment||task.data.test_run||task.data.project_id||task.data.skill_id;
const pattern=goal=>String(goal||'').toLocaleLowerCase().replace(/\d{4}[-/.年]\d{1,2}(?:[-/.月]\d{1,2}日?)?/g,'<日期>').replace(/\d+(?:\.\d+)?/g,'<数字>').replace(/[\s，。！？、：:；;（）()\[\]【】]/g,'').slice(0,160);
const sequence=run=>(run?.data.plan?.steps||[]).map(step=>step.tool).join('|');
const stepName=tool=>({'owner.report':'记录本人完成结果','search.local':'检索已授权资料','document.read':'读取已授权资料','text.compose':'整理并生成成果','web.search':'检索公开来源'}[tool]||'完成已授权的工作步骤');

export function suggestRepeatedSkill(store,user,task){
 if(excluded(task)||task.data.status!=='completed')return null;
 const signature=pattern(task.data.goal),run=store.get(task.data.run_id),steps=sequence(run);
 if(signature.length<5||!steps)return null;
 const matches=store.list('task').filter(other=>other.owner===user&&other.id!==task.id&&other.data.status==='completed'&&!excluded(other)&&other.data.system===task.data.system&&pattern(other.data.goal)===signature&&sequence(store.get(other.data.run_id))===steps&&store.get(other.data.outcome_id)?.data.verdict==='accepted');
 if(!matches.length)return null;
 const previous=store.list('skill_suggestion').filter(item=>item.owner===user&&item.data.signature===signature&&item.data.system===task.data.system&&item.data.step_signature===steps).sort((a,b)=>b.created.localeCompare(a.created))[0];
 if(previous&&previous.data.status!=='observing'||previous&&matches.length+1<(previous.data.observed_count||2)+2)return null;
 const first=matches[0],commonSteps=[...new Set((run.data.plan.steps||[]).map(step=>stepName(step.tool)))];
 const evidence=[first,task].map(item=>({task_id:item.id,outcome_id:item.data.outcome_id,run_id:item.data.run_id,title:item.data.title}));
 const title=String(task.data.title||task.data.goal).replace(/\d{4}[-/.年]\d{1,2}(?:[-/.月]\d{1,2}日?)?/g,'定期').replace(/\d+(?:\.\d+)?/g,'本次').slice(0,60);
 return store.add('skill_suggestion',user,{title,signature,system:task.data.system,step_signature:steps,common_steps:commonSteps,evidence,observed_count:matches.length+1,status:'pending',created_at:now()});
}

export function repeatedSkillCommand(store,user,action,input){
 if(action!=='skill_suggestion.create'&&action!=='skill_suggestion.observe')return null;
 const suggestion=store.expect(store.owned(user,input.id,'skill_suggestion'),input.version);
 if(suggestion.data.status!=='pending')fail('INVALID_STATE','这条建议已经处理',409);
 if(action==='skill_suggestion.observe')return {id:store.update(suggestion,{...suggestion.data,status:'observing'},user).id};
 if(input.confirm!==true)fail('CONFIRMATION_REQUIRED','请先确认把这两次已验收任务整理为 Skill');
 for(const evidence of suggestion.data.evidence){const task=store.owned(user,evidence.task_id,'task'),outcome=store.owned(user,evidence.outcome_id,'outcome');if(task.data.status!=='completed'||task.data.outcome_id!==outcome.id||outcome.data.verdict!=='accepted')fail('EVIDENCE_CHANGED','任务验收依据已变化，请重新核对',409);}
 const instructions=`适用场景：${suggestion.data.title}。每次由本人确认具体目标、输入资料与权限。\n步骤：${suggestion.data.common_steps.map((step,index)=>`${index+1}. ${step}`).join('；')}。\n输出：按本次目标生成成果，并由本人核对来源与结果；不得自动对外发布或执行。`;
 const result=toolLibraryCommand(store,user,'tool.save',{kind:'Skill',title:suggestion.data.title,instructions,system:suggestion.data.system});
 const tool=store.get(result.id);store.update(tool,{...tool.data,suggestion_id:suggestion.id,evidence:suggestion.data.evidence},user);
 store.update(suggestion,{...suggestion.data,status:'created',tool_id:tool.id},user);
 return {id:tool.id,suggestion_id:suggestion.id};
}
