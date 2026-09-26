import {fail} from './store.mjs';
import {string,enumeration} from './policy.mjs';
import {taskCommand} from './runtime.mjs';
import {contextCommand} from './context-request.mjs';
const systems=['explore','advise','create','connect','execute'];

export function swarmCommand(store,user,action,input){
 if(action!=='swarm.create')return null;
 if(input.confirm!==true)fail('CONFIRMATION_REQUIRED','请确认协作目标与分工');
 const goal=string(input.goal,'共同目标',3000),system=enumeration(input.system,systems,'主责 Agent');
 if(!Array.isArray(input.steps)||input.steps.length<1||input.steps.length>4)fail('INVALID_INPUT','请选择 1—4 个协作 Agent');
 const unique=new Set(input.steps.map(step=>step.system));
 if(unique.size!==input.steps.length||unique.has(system))fail('INVALID_INPUT','协作 Agent 不能重复或与主责相同');
 const steps=input.steps.map((step,index)=>({id:'support-'+index,system:enumeration(step.system,systems,'协作 Agent'),goal:string(step.goal,'分工目标',2000),depends:input.mode==='pipeline'&&index>0?['support-'+(index-1)]:[],source_refs:[]}));
 enumeration(input.mode||'independent',['independent','pipeline'],'协作方式');
 const created=taskCommand(store,user,'task.create',{goal,system,mode:'compose',review_mode:'single',source_refs:[],constraints:'最终成果须汇总协作建议，说明分歧与待核对项。只产出可审查的建议或草稿，不联系他人、发布或修改外部系统。',stop:{maxCalls:8,maxTokens:48000,maxUnits:8000,maxSeconds:240,maxAttempts:2,maxReplans:1}});
 const task=store.get(created.id);
 contextCommand(store,user,'task.collaboration',{id:task.id,version:task.version,steps,confirm:true});
 const configured=store.get(task.id);
 store.update(configured,{...configured.data,swarm_mode:input.mode||'independent',swarm:true},user);
 return {id:task.id};
}
