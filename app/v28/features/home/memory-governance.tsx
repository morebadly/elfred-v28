"use client";
import {useState} from 'react';
import {useRuntime,entityRef} from '../../core/runtime-context';
import {Action,Field} from '../../core/runtime-panels';
import {text,type Entity} from '../live/types';
export function MemoryGovernance({item}:{item:Entity}){
 const runtime=useRuntime()!,[expires,setExpires]=useState(item.data.expires_at?new Date(Date.parse(text(item,'expires_at'))-new Date(text(item,'expires_at')).getTimezoneOffset()*60000).toISOString().slice(0,16):'');
 return <details className="v277-edit-card"><summary>适用期限与显示</summary><p>事实是待核对的陈述；假设是推断；本人确认、真实情境验证与长期稳定分别记录。隐藏不代表删除，会停止将此理解用于新任务。</p><Field name="到期时间（留空长期保留）" type="datetime-local" value={expires} onChange={setExpires}/><Action run={()=>runtime.command('memory.governance',{...entityRef(item),hidden:!!item.data.hidden,expires_at:expires?new Date(expires).toISOString():null})}>核对并保存有效期</Action><Action run={()=>runtime.command('memory.governance',{...entityRef(item),hidden:!item.data.hidden,expires_at:item.data.expires_at||null})}>{item.data.hidden?'恢复显示':'隐藏并暂停使用'}</Action></details>;
}
export function InactiveMemories(){
 const runtime=useRuntime()!,items=runtime.snapshot!.objects.memory.filter(m=>!['deleted','rejected','superseded'].includes(text(m,'status'))&&(m.data.hidden||m.data.expires_at&&Date.parse(text(m,'expires_at'))<=Date.now()));
 return items.length?<details className="v277-edit-card"><summary>已隐藏或到期的理解 · {items.length}</summary>{items.map(m=><article key={m.id}><p>{text(m,'content')}</p><small>{m.data.hidden?'已隐藏':'已到期'}，当前不用于任务</small><Action run={()=>runtime.command('memory.governance',{...entityRef(m),hidden:false,expires_at:null})}>本人重新核对，恢复使用并清除旧期限</Action></article>)}</details>:null;
}
