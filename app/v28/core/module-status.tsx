"use client";
import {type ReactNode} from 'react';
import {useRuntime} from './runtime-context';
export function ModuleStatus({types,children}:{types:string[];children:ReactNode}){
 const runtime=useRuntime(),errors=runtime?.snapshot?.module_errors;
 if(types.some(type=>errors?.[type]))return <section className="v277-edit-card" role="alert"><p>这部分内容暂时加载失败，其他内容仍可使用。</p><button onClick={()=>void runtime?.refresh().catch(()=>{})}>重新加载</button></section>;
 return children;
}
