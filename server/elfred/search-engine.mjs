import {fail,now,hash} from './store.mjs';
import {string} from './policy.mjs';
import {resolveSearchContext} from './search-intent.mjs';
export const SEARCH_TYPES=['document','knowledge','task','message','post','release','memory','resource','conversation','skill','profile','friend','feed','inbox','project','assist'];
const retired=['rejected','superseded','expired','deleted','needs_review','withdrawn','archived'];
const synonyms=[['人数上限','名额','满员','人数限制'],['报名','提交申请','申请参加'],['截止','截至','最后期限'],['方案','设计','说明']];
export function parseIntent(query,input={}){
 const segmenter=new Intl.Segmenter('zh',{granularity:'word'});
 const stop=new Set(['找','找到','查','查找','搜索','检索','包含','包括','的','了','在','发','发的','我','帮我','请','要','有','这个','那个','不要','旧版','最新','上周','本周']);
 const terms=[...segmenter.segment(query.toLowerCase())].filter(s=>s.isWordLike&&!stop.has(s.segment)).map(s=>s.segment);
 const conditions=(input.conditions||[]);
 if(!Array.isArray(conditions)||conditions.length>12||conditions.some(c=>typeof c!=='string'||c.length>200))fail('INVALID_INPUT','最多 12 条条件，每条 200 字');
 const excluded=(input.exclude||[]);if(!Array.isArray(excluded)||excluded.some(v=>typeof v!=='string'||v.length>200))fail('INVALID_INPUT','排除词不正确');
 const uncertainty=[];
 if(/这个群|那个群/.test(query)&&!input.space)uncertainty.push('请选择具体群聊，不能猜测“这个群”');
 if(/上周/.test(query)&&/本周/.test(query))uncertainty.push('上周和本周条件冲突，请修改');
 else if(/上周|本周|昨天|今天|最近/.test(query)&&!input.after)uncertainty.push('请在搜索条件中确认开始和结束时间，避免将相对时间按错误时区解释');
 if(/[^\s，,。]{1,20}(?:发的|发送的|分享的)/.test(query)&&!input.author)uncertainty.push('请在搜索条件中选择发送者，避免同名或转发来源混淆');
 const requires=conditions.length?conditions:(/人数上限|满员|名额限制/.test(query)?['人数限制有明确证据']:['是否符合本次查询的完整含义']);
 return {original:query,terms:[...new Set(terms)],conditions:requires,exclude:excluded,latest:input.latest??/不要旧版|最新/.test(query),space:input.space||null,author:input.author||null,after:input.after||null,before:input.before||null,time_semantics:'消息按发送时间，其他对象按创建时间',uncertainties:uncertainty};
}
export function bodyFor(store,user,o){
 if(o.type==='profile'&&o.owner!==user)return [o.data.published?.name,o.data.published?.bio].filter(Boolean).join('\n');
 if(o.type==='friend'){const other=store.user(o.owner===user?o.data.recipient:o.owner);return [other?.name,other?.handle,o.data.intro].filter(Boolean).join('\n');}
 if(o.type==='conversation')return [o.data.title,...store.members(o.id).map(m=>m.name+' '+m.handle)].join('\n');
 return ['title','name','content','goal','text','summary','instructions','purpose','bio'].map(k=>o.data[k]).filter(v=>typeof v==='string').join('\n');
}
export function sourceIsCurrent(store,o){
 if(o.data.superseded_by||o.data.is_current===false)return false;
 if(o.type==='release'&&o.data.project_id){const project=store.get(o.data.project_id);if(project?.data.release_id)return project.data.release_id===o.id;}
 return true;
}
export function semanticSources(store,user,input,intent){
 const types=input.types||SEARCH_TYPES,usable=o=>!o.data.internal_search&&!o.data.search_query_id&&!retired.includes(o.data.status)&&!o.data.hidden&&(!o.data.expires_at||Date.parse(o.data.expires_at)>Date.now())&&!input.excluded_ids?.includes(o.id)&&(!intent.latest||sourceIsCurrent(store,o)),scoped=o=>(!intent.space||o.space===intent.space||o.id===intent.space)&&(!intent.author||o.owner===intent.author)&&(!intent.after||Date.parse(o.created)>=Date.parse(intent.after))&&(!intent.before||Date.parse(o.created)<Date.parse(intent.before));
 const sources=new Map(types.flatMap(t=>store.visible(user,t)).filter(o=>usable(o)&&scoped(o)).map(o=>[o.id,o]));
 // A dated message may point to an older file. Keep the origin constraint on the message.
 for(const o of [...sources.values()]){const d=o.data;for(const id of [d.artifact_id,d.task_id,d.object_id,...(d.attachments||[]).map(r=>r.id),...(d.source_refs||[]).map(r=>r.id)].filter(Boolean)){const target=store.get(id);if(target&&types.includes(target.type)&&store.canRead(user,target)&&usable(target)&&!sources.has(id))sources.set(id,{...target,search_origin_id:o.id});}}
 return [...sources.values()].sort((a,b)=>b.created.localeCompare(a.created)||a.id.localeCompare(b.id));
}
export function localSearch(store,user,input){
 const query=string(input.query,'搜索词',300),context=resolveSearchContext(store,user,query,input),intent=parseIntent(query,context.resolved),types=input.types||SEARCH_TYPES;
 intent.interpretation=context.notes;intent.uncertainties.push(...context.uncertainties);
 if(!Array.isArray(types)||types.some(t=>!SEARCH_TYPES.includes(t)))fail('INVALID_INPUT','搜索类型不支持');
 for(const date of [intent.after,intent.before])if(date&&!Number.isFinite(Date.parse(date)))fail('INVALID_INPUT','搜索时间不正确');
 if(intent.after&&intent.before&&Date.parse(intent.after)>=Date.parse(intent.before))intent.uncertainties.push('开始时间必须早于结束时间');
 const queryId=hash(JSON.stringify({user,intent,types:[...types].sort(),excluded_ids:[...(input.excluded_ids||[])].sort()})).slice(0,24);
 if(intent.uncertainties.length)return {status:'needs_clarification',query_id:queryId,intent,hits:[],engine:'local-hybrid-v2',semantic_status:'not_checked'};
 const usable=o=>!o.data.internal_search&&!o.data.search_query_id&&!retired.includes(o.data.status)&&!o.data.hidden&&(!o.data.expires_at||Date.parse(o.data.expires_at)>Date.now());
 const all=types.flatMap(t=>store.visible(user,t)).filter(o=>usable(o)&&!input.excluded_ids?.includes(o.id));
 const terms=intent.terms.length?intent.terms:[query.toLowerCase()];
 const expanded=[...new Set(terms.flatMap(t=>[t,...synonyms.filter(group=>group.some(v=>v.includes(t)||t.includes(v))).flat()]))];
 const scoped=o=>(!intent.space||o.space===intent.space||o.id===intent.space)&&(!intent.author||o.owner===intent.author)&&(!intent.after||Date.parse(o.created)>=Date.parse(intent.after))&&(!intent.before||Date.parse(o.created)<Date.parse(intent.before));
 const eligible=all.filter(scoped),matches=new Map();
 for(const o of eligible){const body=bodyFor(store,user,o),lower=body.toLowerCase();if(intent.exclude.some(t=>lower.includes(t.toLowerCase())))continue;const exact=terms.filter(t=>lower.includes(t)).length,related=expanded.filter(t=>lower.includes(t)).length;if(!exact&&!related)continue;matches.set(o.id,{object:o,body,score:exact*3+related+(terms.some(t=>String(o.data.title||'').toLowerCase().includes(t))?4:0),channels:[...(exact?['keyword']:[]),...(related>exact?['term_expansion']:[])]});}
 // Traverse only stored, readable relationships; message filters stay on the originating message.
 for(const m of [...matches.values()]){const d=m.object.data;const ids=[d.artifact_id,d.task_id,d.object_id,...(d.attachments||[]).map(r=>r.id),...(d.source_refs||[]).map(r=>r.id)].filter(Boolean);
  for(const ref of ids){const target=store.get(ref);if(!target||!types.includes(target.type)||!store.canRead(user,target)||!usable(target)||input.excluded_ids?.includes(target.id))continue;const body=bodyFor(store,user,target);if(intent.exclude.some(t=>body.toLowerCase().includes(t.toLowerCase())))continue;const existing=matches.get(ref);if(existing){existing.channels.push('relation');existing.origin_id=m.object.id;}else matches.set(ref,{object:target,body,score:m.score-0.5,channels:['relation'],origin_id:m.object.id});}
 }
 const hits=[...matches.values()].map(m=>{
  const o=m.object,lines=m.body.split('\n'),line=Math.max(0,lines.findIndex(l=>expanded.some(t=>l.toLowerCase().includes(t))));
  const checks=intent.conditions.map(condition=>{const quote=lines.find(l=>l.toLowerCase().includes(condition.toLowerCase()));return {condition,status:'unknown',evidence:quote||'',anchor:quote?'line:'+(lines.indexOf(quote)+1):null};});
  if(intent.latest)checks.push({condition:'最新有效版本',status:!sourceIsCurrent(store,o)?'unsatisfied':o.data.is_current===true?'satisfied':'unknown',evidence:o.data.revision?'修订 '+o.data.revision:'',anchor:null});
  return {id:o.id,version:o.version,type:o.type,title:o.type==='profile'&&o.owner!==user?o.data.published?.name||'公开资料':o.data.title||o.data.name||m.body.slice(0,60),excerpt:lines.slice(line,line+3).join('\n').slice(0,500),anchor:'line:'+(line+1),score:m.score,origin_id:m.origin_id||null,channels:[...new Set(m.channels)],condition_checks:checks,condition_status:checks.some(c=>c.status==='unsatisfied')?'unsatisfied':checks.some(c=>c.status==='unknown')?'unknown':'satisfied',semantic_status:'not_checked'};
 }).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).slice(0,50);
 return {status:'complete',query_id:queryId,checked_at:now(),engine:'local-hybrid-v2',judge:'rule-baseline',semantic_status:'not_checked',intent,hits,coverage:{types,channels:['keyword','term_expansion','relation'],missing:['模型语义核对','向量召回']}};
}
