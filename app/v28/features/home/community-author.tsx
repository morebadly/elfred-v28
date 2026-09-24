"use client";
import {useRuntime} from '../../core/runtime-context';
import {Action} from '../../core/runtime-panels';
import {type Entity,text} from '../live/types';
export function FollowAuthor({post}:{post:Entity}){
 const r=useRuntime()!,s=r.snapshot!;if(post.owner===s.user.id)return null;const active=s.objects.interaction.some(i=>i.data.kind==='follow_author'&&i.data.object_id===post.owner&&i.data.active);
 return <Action run={()=>r.command('post.follow_author',{id:post.id})}>{active?'取消关注作者':'关注作者'}</Action>;
}
export function RecruitmentSummary({post}:{post:Entity}){
 if(!post.data.project_id)return null;
 const slots=(post.data.slots||[]) as {id:string;title:string;capacity:number|null;filled:number;deadline?:string;status:string;terms_changed?:boolean}[];
 return <details><summary>{post.data.status==='recruiting'?'招募中':'已停止招募'} · {slots.length} 项开放任务</summary><p>验收：{text(post,'criteria')}</p>{slots.map(s=><p key={s.id}>{s.title} · {s.capacity===null?'不限人数':`${s.filled}/${s.capacity} 人`}{s.deadline?' · 截止 '+new Date(s.deadline).toLocaleDateString('zh-CN'):''} · {s.terms_changed?'约定更新中':s.status==='completed'?'已完成':s.status==='open'?'查看详情后申请':'已关闭'}</p>)}<p>打开共创帖核对任务标准与参与方式。</p></details>;
}
