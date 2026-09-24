import {localDay} from './local-day.mjs';
export function importantBriefEvent(tasks,timezone,day){
 const priorities={blocked:0,failed:0,reconciliation_required:0,awaiting_acceptance:1,awaiting_review:1,completed:2};
 const candidates=tasks.filter(t=>Object.hasOwn(priorities,t.data.status)&&localDay(new Date(t.updated),timezone)===day&&(t.data.focus_date===day||t.data.today_admission?.important===true&&t.data.planned_date===day));
 candidates.sort((a,b)=>priorities[a.data.status]-priorities[b.data.status]||b.updated.localeCompare(a.updated));const task=candidates[0];
 if(!task)return null;return {key:task.id+':'+task.data.status+':'+(task.data.run_id||task.data.outcome_id||''),index:task.data.status==='completed'?2:1,title:task.data.title,reason:priorities[task.data.status]===0?'今日重点遇到阻塞，请先核对':priorities[task.data.status]===1?'今日重点已有结果，等待你核对':'今日重点已验收，可回顾结果'};
}
