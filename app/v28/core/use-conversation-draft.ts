"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {useRuntime} from './runtime-context';
import {type Entity,text as entityText} from '../features/live/types';

// Serialize saves so typing during an in-flight request cannot reverse their order.
// A stale version is retained on conflict; another browser's draft is never overwritten.
export function useConversationDraft(id:string,enabled:boolean) {
  const runtime=useRuntime();
  const server=runtime?.snapshot?.objects.draft.find(item=>item.data.conversation_id===id);
  const [text,setText]=useState(enabled?entityText(server,'text'):'');
  const [saving,setSaving]=useState(false);
  const state=useRef({id,text,saved:text,version:server?.version,active:Promise.resolve() as Promise<unknown>,entityId:server?.id});
  const services=useRef(runtime);useEffect(()=>{services.current=runtime},[runtime]);
  useEffect(()=>{
    state.current={id,text:enabled?entityText(server,'text'):'',saved:enabled?entityText(server,'text'):'',version:server?.version,active:Promise.resolve(),entityId:server?.id};
    setText(state.current.text);
  },[id,enabled]); // Load once on entering the conversation; polling must not replace typed text.
  useEffect(()=>{
    const local=state.current;
    if(server&&local.id===id&&(local.text===local.saved||local.text===entityText(server,'text'))){
      local.version=server.version;local.entityId=server.id;local.saved=entityText(server,'text');local.text=local.saved;setText(local.text);
    }
  },[server?.version,id]);
  const edit=useCallback((value:string)=>{state.current.text=value;setText(value)},[]);
  const save=useCallback(()=>{
    const local=state.current;
    if(!enabled||!services.current)return Promise.resolve();
    const work=local.active.catch(()=>{}).then(async()=>{
      if(local.text===local.saved)return;
      const value=local.text;setSaving(true);
      try{
        const service=services.current!;
        const result=await service.command('draft.save',{conversation_id:local.id,text:value,version:local.version??0});
        // The command returns the committed version so polling or another client
        // cannot cause this editor to adopt a version it has never displayed.
        local.entityId=result.id;local.version=(result as typeof result & {version:number}).version;local.saved=value;
      }finally{setSaving(false)}
    });
    local.active=work;return work;
  },[enabled]);
  useEffect(()=>{if(!enabled||text===state.current.saved)return;const timer=setTimeout(()=>void save().catch(()=>{}),600);return()=>clearTimeout(timer)},[text,enabled,save]);
  const reload=useCallback(async(value:string)=>{
    const local=state.current,service=services.current;
    if(service&&local.entityId){const latest=await service.request<Entity>('/objects/'+local.entityId);local.version=latest.version;local.saved=entityText(latest,'text');edit(local.saved);return;}
    edit(value);
  },[edit]);
  return {text,setText:edit,save,saving,reload};
}
