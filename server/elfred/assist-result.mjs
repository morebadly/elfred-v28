import {fail} from './store.mjs';
import {resultReceipts} from './agent-plan.mjs';
export function assistResult(store,user,assistId){
 const assist=store.owned(user,assistId,'assist');
 const conversation=store.read(user,assist.data.conversation_id,'conversation');
 const task=store.owned(user,assist.data.task_id,'task'),run=store.owned(user,task.data.run_id,'run');
 const output=resultReceipts(run.data.receipts||[]).find(r=>typeof r.output==='string')?.output;
 if(!output)fail('RESULT_REQUIRED','辅助尚无可用结果');
 return {assist,conversation,task,run,output};
}
export function checkedAssistResult(store,user,input){const result=assistResult(store,user,input.id);if(input.run_id!==result.run.id)fail('RESULT_CHANGED','辅助结果已变化，请重新预览后操作');store.expect(result.assist,input.version);store.expect(result.run,input.run_version);return result;}
