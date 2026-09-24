"use client";
import {useState} from 'react';
import {useRuntime,entityRef} from '../../core/runtime-context';
import {Action,Field} from '../../core/runtime-panels';
import type {Entity} from '../live/types';
export function EveningFollowup({brief}:{brief:Entity}){
 const runtime=useRuntime()!,[content,setContent]=useState(''),[kind,setKind]=useState('task'),[saved,setSaved]=useState('');
 const review=brief.data.review as {decision:string}|undefined;
 return <section className="v277-edit-card"><h3>确认后续安排</h3><label className="v277-field"><span>处理方式</span><select value={kind} onChange={e=>setKind(e.target.value)}><option value="task">创建本人待办草稿</option><option value="memory">保存为待确认理解</option></select></label><Field name="由你确认的具体内容" value={content} onChange={setContent} area/><Action disabled={!content.trim()||!['confirmed','corrected'].includes(review?.decision||'')} run={async()=>{await runtime.command('brief.followup',{...entityRef(brief),kind,content,confirm:true});setSaved(kind==='task'?'已保存到任务列表，确认后可记录完成。':'已保存到记忆库，仍需核对理解依据。');setContent('')}}>确认保存后续安排</Action>{saved&&<p role="status">{saved}</p>}</section>;
}
