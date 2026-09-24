"use client";
import {useState} from 'react';
import {useRuntime} from '../../core/runtime-context';
import {Action,Field} from '../../core/runtime-panels';
import {type Entity,text} from '../live/types';
export function KnowledgeEditor({item,onArchived}:{item:Entity;onArchived:()=>void}){
 const runtime=useRuntime()!,[open,setOpen]=useState(false),[version,setVersion]=useState(item.version),[title,setTitle]=useState(text(item,'title')),[content,setContent]=useState(text(item,'content'));
 return <section><button className="v277-secondary" onClick={()=>{setVersion(item.version);setTitle(text(item,'title'));setContent(text(item,'content'));setOpen(true)}}>编辑笔记</button>{open&&<div className="v277-edit-card"><Field name="笔记标题" value={title} onChange={setTitle}/><Field name="笔记正文" value={content} onChange={setContent} area/>{version!==item.version&&<p role="alert">笔记已更新，请取消后重新打开编辑，避免覆盖其他修改。</p>}<Action disabled={!title.trim()||!content.trim()||version!==item.version} run={async()=>{await runtime.command('knowledge.update',{id:item.id,version,title,content});setOpen(false)}}>保存修改</Action><button onClick={()=>setOpen(false)}>取消</button><Action run={async()=>{await runtime.command('knowledge.archive',{id:item.id,version});onArchived()}}>归档笔记</Action></div>}</section>;
}
