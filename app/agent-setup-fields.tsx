"use client";

import { useProduct, type AgentId, type AgentConfig } from "./product-state";

type Field = { key:string; label:string; hint?:string; placeholder?:string; choices?:string[]; defaultValue?:string };
export const agentSetupFields: Record<AgentId,Field[]> = {
  explore: [
    {key:"sources",label:"希望从哪里发现内容",choices:["公开网站与资讯","论文与研究","产品社区","我的收藏"],defaultValue:"公开网站与资讯"},
    {key:"exclude",label:"哪些内容不想看到",placeholder:"例如：重复资讯、营销软文，或暂时不关注的领域"},
  ],
  advisor: [
    {key:"criteria",label:"做决定时，最看重什么",choices:["长期价值","真实用户需求","效率与成本","风险可控"],defaultValue:"长期价值"},
    {key:"dissent",label:"允许它主动提出不同意见吗",choices:["可以，给出理由","先提问，再建议"],defaultValue:"可以，给出理由"},
  ],
  create: [
    {key:"references",label:"喜欢的作者或品牌",placeholder:"写下名字、风格关键词或参考链接"},
    {key:"work",label:"你希望保留的表达习惯",placeholder:"例如：先说结论、少用术语、用真实场景举例"},
  ],
  connect: [
    {key:"matching",label:"允许用于匹配的信息",choices:["身份与公开技能","加上当前目标","每次由我选择"],defaultValue:"每次由我选择"},
    {key:"outreach",label:"什么情况下可以对外沟通",choices:["只推荐，不联系","准备草稿，确认后再发"],defaultValue:"只推荐，不联系"},
  ],
  execute: [
    {key:"projects",label:"当前想推进的项目",placeholder:"项目名称，以及你希望完成的下一件事"},
    {key:"tools",label:"日常使用的工具",placeholder:"例如：飞书、Notion、日历、文档",hint:"这里只记录偏好，不连接或读取账号。"},
    {key:"permission",label:"自动执行的边界",choices:["只拆解与建议","可准备草稿，执行前确认"],defaultValue:"只拆解与建议"},
  ],
};

export function AgentSetupFields({id,config,onChange}:{id:AgentId;config?:AgentConfig;onChange?:(config:AgentConfig)=>void}) {
  const {state,setState}=useProduct();
  const current=config||state.configs[id];
  const details=current.details||{};
  const update=(key:string,value:string)=>{if(onChange){onChange({...current,mode:"custom",details:{...details,[key]:value}});return;}setState(s=>({...s,configs:{...s.configs,[id]:{...s.configs[id],mode:"custom",details:{...s.configs[id].details,[key]:value}}}}));};
  return <div className="v-specific-fields">{agentSetupFields[id].map(field=><div className="v-specific-field" key={field.key}>
    <label htmlFor={`${id}-${field.key}`}>{field.label}</label>
    {field.choices?<div className="v-chips" role="group" aria-label={field.label}>{field.choices.map(value=><button type="button" key={value} aria-pressed={(details[field.key]??field.defaultValue)===value} className={(details[field.key]??field.defaultValue)===value?"selected":""} onClick={()=>update(field.key,value)}>{value}</button>)}</div>:<textarea id={`${id}-${field.key}`} rows={2} maxLength={300} value={details[field.key]||""} onChange={e=>update(field.key,e.target.value)} placeholder={field.placeholder}/>}
    {field.hint&&<p className="v-note">{field.hint}</p>}
  </div>)}</div>;
}

export function RhythmBreakdown() {
  const {state}=useProduct();
  const counts=state.frequency===30?[12,5,4,5,4]:state.frequency===80?[34,12,9,13,12]:[65,22,16,25,22];
  return <div className="v-rhythm-breakdown"><p>小队的初始分工 · 每日内容配额示意</p><div className="v-rhythm-counts">{["探索","参谋","创作","连接","执行"].map((name,index)=><div key={name}><span>{name}</span><strong>{counts[index]}</strong></div>)}</div></div>;
}
