import {fail} from './store.mjs';
import {string} from './policy.mjs';
export function parameterSchema(input=[]){
 if(!Array.isArray(input)||input.length>8)fail('INVALID_PARAMETERS','最多定义 8 项输入');const seen=new Set();
 return input.map(item=>{const name=string(item?.name,'输入名称',60);if(seen.has(name))fail('INVALID_PARAMETERS','输入名称不能重复');seen.add(name);return {name,required:item.required===true,hint:typeof item.hint==='string'?item.hint.slice(0,300):'',default_value:typeof item.default_value==='string'?item.default_value.slice(0,1000):''};});
}
export function parameterValues(schema,input={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(name=>!schema.some(item=>item.name===name)))fail('INVALID_PARAMETERS','存在未定义的输入项');
 return Object.fromEntries(schema.map(item=>{const value=Object.hasOwn(input,item.name)?input[item.name]:item.default_value;if(typeof value!=='string'||value.length>1000)fail('INVALID_PARAMETERS','每项输入限 1000 字');if(item.required&&!value.trim())fail('PARAMETER_REQUIRED','请填写：'+item.name);return [item.name,value];}));
}
export function toolActivity(tool,at=Date.now()){
 const since=Date.parse(tool.data.last_used_at||tool.created),days=tool.data.idle_days;
 return tool.data.status==='archived'?'archived':Number.isInteger(days)&&at-since>=days*86400000?'idle':'active';
}
export function toolWorkflow(steps=[],main){
 if(!Array.isArray(steps)||steps.length>5)fail('INVALID_WORKFLOW','默认调用额度支持五个前置步骤与一次主责交付');const seen=new Set();
 return steps.map(step=>{const id=string(step.id,'步骤编号',60);if(!/^[a-z][a-z0-9_-]*$/.test(id)||seen.has(id))fail('INVALID_WORKFLOW','步骤编号无效或重复');if(!['explore','advise','create','connect','execute'].includes(step.system)||step.system===main)fail('INVALID_WORKFLOW','前置步骤请选择与主责不同的系统');const depends=step.depends||[];if(!Array.isArray(depends)||depends.some(id=>!seen.has(id)))fail('INVALID_WORKFLOW','步骤只能依赖前面的步骤');seen.add(id);return {id,system:step.system,goal:string(step.goal,'步骤目标',2000),depends:[...new Set(depends)]};});
}
