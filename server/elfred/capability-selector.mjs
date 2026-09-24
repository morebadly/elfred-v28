import {DEFINITIONS} from './catalog.mjs';
import {fail} from './store.mjs';

// Optional judge boundary: a future Jev adapter may suggest one of these IDs.
// It cannot add tools, change system ownership, approve actions or accept work.
export function selectionQuestion(system,goal){
 return {state:{system,goal},questions:{capability:{type:'choice',instructions:'选择本系统最适合目标的一项能力；没有合适项时选择 none。',criteria:Object.fromEntries([...DEFINITIONS.filter(d=>d.system===system).map(d=>[d.id,d.purpose]),['none','没有合适能力或资料不足']])}}};
}
export function selectCapability(system,goal,{explicitId,judgeDecision,minimumConfidence=0.85}={}){
 const candidates=DEFINITIONS.filter(d=>d.system===system);
 if(!candidates.length)fail('INVALID_SYSTEM','系统不存在');
 if(explicitId){const capability=candidates.find(d=>d.id===explicitId);if(!capability)fail('INVALID_CAPABILITY','能力不属于当前系统');return {capability,selection:{provider:'owner',reason:'本人指定',judge_status:'not_used'}};}
 if(judgeDecision){const answer=judgeDecision.answers?.capability,capability=candidates.find(d=>d.id===answer?.choice);if(capability&&answer.type==='choice'&&Number.isFinite(answer.confidence)&&answer.confidence>=minimumConfidence&&answer.confidence<=1)return {capability,selection:{provider:'judge',reason:'候选选择建议',judge_status:'accepted',confidence:answer.confidence,model:judgeDecision.model||null}};}
 // Specific checks/tools beat broad verbs such as 写/分析/计划.
 const ordered=[...candidates.slice(1),candidates[0]].sort((a,b)=>Number(b.kind==='check')-Number(a.kind==='check'));
 const capability=ordered.find(d=>new RegExp(d.trigger).test(goal))||candidates[0];
 return {capability,selection:{provider:'local-rules',reason:'按目标匹配本系统能力',judge_status:judgeDecision?'fallback':'not_connected'}};
}
