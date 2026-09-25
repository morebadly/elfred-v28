"use client";
import {useRuntime} from '../../core/runtime-context';
import {Action} from '../../core/runtime-panels';
import type {Screen} from '../../core/screen';
export function ContextRecovery({go}:{go:(screen:Screen)=>void}){
 const r=useRuntime();if(!r?.snapshot)return null;
 const requests=r.snapshot.objects.context_request.filter(q=>q.data.status==='revoked'||Number(q.data.expires)<Date.parse(r.snapshot!.server_time)||(q.data.recovery_task as {source_invalid?:boolean}|null)?.source_invalid),tasks=[...new Map(requests.map(q=>q.data.recovery_task as {id:string;version:number;status:string}|null).filter(t=>t&&['ready','blocked','failed','partial','paused','cancelled'].includes(t.status)).map(t=>[t!.id,t!])).values()];
 return tasks.length?<section className="v277-edit-card"><h3>资料授权需要重新核对 · {tasks.length} 项</h3><p>这些任务的旧资料已到期或撤销。重新选择会清空原资料和协作选择，保留目标、历史记录与累计用量。</p>{tasks.map(t=><Action key={t.id} run={async()=>{await r.command('task.reopen_context',{id:t.id,version:t.version,confirm:true});go({name:'task',id:t.id})}}>重新核对原任务资料</Action>)}</section>:null;
}
