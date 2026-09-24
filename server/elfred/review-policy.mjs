export function reviewPolicy(task,capability=task.data.capability||{}){
 const requested=task.data.review_mode||'auto';
 const required=capability.review_policy==='required'||/高风险|合同|法律|医疗|投资|财务|公开发布|有据可查|独立核验/.test(task.data.goal);
 const evidence=(task.data.source_refs||[]).length>0;
 const wanted=required||requested==='independent'||Boolean(task.data.reviewer_system)||(requested!=='single'&&evidence),support=(task.data.collaboration_steps||[]).length;
 return {wanted,required,reason:required?'任务或能力需要独立复核':requested==='independent'||task.data.reviewer_system?'本人要求独立复核':evidence&&requested!=='single'?'需核对提供的资料':'常规任务，一轮生成后由本人核对',available:!task.data.media_operation&&task.data.stop.maxCalls>=support+2&&task.data.stop.maxUnits>=(support+2)*1000};
}

export function collaborationLimit(task){const reserve=reviewPolicy(task).wanted?2:1;return Math.max(0,Math.min(12-reserve,task.data.stop.maxCalls-reserve,Math.floor(task.data.stop.maxUnits/1000)-reserve));}
export function plannedModelUnits(task){const r=reviewPolicy(task),n=(task.data.collaboration_steps||[]).length;return (!r.wanted||!r.available?n+1:n+3<=12&&task.data.stop.maxCalls>=n+3&&task.data.stop.maxUnits>=(n+3)*1000?n+3:n+2)*1000;}
