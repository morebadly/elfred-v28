"use client";
import {useRuntime} from '../../core/runtime-context';
import {Field} from '../../core/runtime-panels';
export type ToolStep={id:string;system:string;goal:string;depends:string[]};
export function ToolWorkflow({value,onChange,main}:{value:ToolStep[];onChange:(steps:ToolStep[])=>void;main:string}){
 const systems=useRuntime()!.snapshot!.systems;
 return <details><summary>可复用协作流程 · {value.length} 个前置步骤</summary><p>按需要加入前置步骤，最后由主责系统交付完整成果。本次填写的输入会用于这些步骤；仍需在任务中确认范围和总额度。</p>{value.map((step,index)=><section key={step.id}><label>步骤 {index+1} · 负责系统<select value={step.system} onChange={e=>onChange(value.map(s=>s.id===step.id?{...s,system:e.target.value}:s))}>{systems.filter(s=>s.id!==main).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><Field name="此步骤要完成什么" area value={step.goal} onChange={goal=>onChange(value.map(s=>s.id===step.id?{...s,goal}:s))}/>{value.slice(0,index).map(prior=><label key={prior.id}><input type="checkbox" checked={step.depends.includes(prior.id)} onChange={e=>onChange(value.map(s=>s.id===step.id?{...s,depends:e.target.checked?[...s.depends,prior.id]:s.depends.filter(id=>id!==prior.id)}:s))}/>使用步骤 {value.indexOf(prior)+1} 的结果</label>)}<button onClick={()=>onChange(value.filter(s=>s.id!==step.id).map(s=>({...s,depends:s.depends.filter(id=>id!==step.id)})))}>移除步骤</button></section>)}<button disabled={value.length>=5} onClick={()=>onChange([...value,{id:'step-'+Date.now(),system:systems.find(s=>s.id!==main)!.id,goal:'',depends:[]}])}>添加前置步骤</button></details>;
}
