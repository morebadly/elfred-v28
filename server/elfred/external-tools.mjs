import {taskCommand} from './runtime.mjs';
import {enumeration,string,DEFAULT_STOP} from './policy.mjs';
export function externalToolCommand(store,user,action,input){
 if(action!=='external.prepare')return null;
 const operation=enumeration(input.operation,['web_search','image_generate'],'执行能力'),goal=string(input.goal,'本次问题或图片描述',3000);
 const task=taskCommand(store,user,'task.create',{goal,system:operation==='web_search'?'explore':'create',review_mode:'single',source_refs:[],constraints:operation==='web_search'?'仅将本次问题提交公开互联网检索，不读取私人库，不自动发送或发布。':'只生成一张 1024 × 1024 的低质量预览图，不发送或公开发布。',stop:{...DEFAULT_STOP,maxCalls:1,maxUnits:1000,maxTokens:24000}});
 return {id:store.update(store.get(task.id),{...store.get(task.id).data,media_operation:operation},user).id};
}
