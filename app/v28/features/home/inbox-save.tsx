"use client";
import {useState} from 'react';
import {useRuntime} from '../../core/runtime-context';
import type {Screen} from '../../core/screen';
export function InboxSave({objectId,go}:{objectId:string;go:(screen:Screen)=>void}){
 const runtime=useRuntime()!,[busy,setBusy]=useState(false),[savedHere,setSavedHere]=useState(false),[error,setError]=useState('');
 const item=runtime.snapshot?.objects.inbox.find(item=>item.data.object_id===objectId);
 const saved=item?item.data.status!=='dismissed':savedHere;
 return <div className="elfred-inbox-save"><button type="button" className="v277-secondary" disabled={busy} onClick={()=>{if(saved){go({name:'inbox'});return;}setBusy(true);setError('');void runtime.command('inbox.create',{object_id:objectId}).then(()=>setSavedHere(true)).catch(err=>setError(err instanceof Error?err.message:'保存失败，请重试')).finally(()=>setBusy(false));}}>{busy?'正在存入…':saved?'已存入 · 查看收件箱':'存入收件箱'}</button>{savedHere&&<span role="status">已保存，可在「我的工具 → 收件箱」查看</span>}{error&&<span role="alert">{error}</span>}</div>;
}
