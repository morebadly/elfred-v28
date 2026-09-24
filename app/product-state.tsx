"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Compass, Lightbulb, PenLine, Users, CheckCheck } from "lucide-react";
import type { OnboardingDraft } from "./onboarding-flow";

export const agents = [
  { id: "explore", name: "探索", role: "信息侦察员", icon: Compass, tone: "blue", desc: "把值得你关注的信息带回来。", topics: ["AI 产品", "行业趋势", "设计灵感", "商业案例", "科技前沿", "人文阅读"], question: "最近，你对什么保持好奇？", second: "你喜欢怎样的信息？", styles: ["最新资讯", "深度内容", "新奇发现"], defaults: "扩大探索范围，用你的每一次选择慢慢收窄。", prompt: "帮我追踪一个感兴趣的主题", action: "建立追踪主题" },
  { id: "advisor", name: "参谋", role: "策略与决策顾问", icon: Lightbulb, tone: "neutral", desc: "帮你看清选择，也敢提出不同意见。", topics: ["产品方向", "长期规划", "方案比较", "风险判断", "项目复盘", "职业发展"], question: "现在，什么问题最需要判断？", second: "你希望我怎样给建议？", styles: ["直接有判断", "温和启发", "多角度分析"], defaults: "理性直接，给出依据；重大决定仍由你拍板。", prompt: "帮我比较两种可选方案", action: "生成决策草稿" },
  { id: "create", name: "创作", role: "内容与表达搭档", icon: PenLine, tone: "green", desc: "让想法落在纸上，越来越像你的表达。", topics: ["文章", "产品文案", "PPT", "视频脚本", "社交内容", "品牌设计"], question: "你经常创作什么？", second: "你偏爱哪种表达？", styles: ["简洁自然", "有观点", "温暖有趣"], defaults: "减少 AI 腔，先做草稿，从修改里学习你的风格。", prompt: "帮我把一个想法写成产品介绍", action: "创建内容草稿" },
  { id: "connect", name: "连接", role: "人与机会经纪人", icon: Users, tone: "blue", desc: "让合适的人与机会，离你更近一点。", topics: ["技术伙伴", "产品共创", "行业交流", "项目合作", "客户机会", "线下活动"], question: "你最近想遇见什么人或机会？", second: "匹配时优先考虑什么？", styles: ["能力互补", "长期契合", "同城优先"], defaults: "只发现与推荐，不自动联系；对外沟通先问你。", prompt: "帮我整理理想合作伙伴的条件", action: "创建匹配需求" },
  { id: "execute", name: "执行", role: "项目与行动管家", icon: CheckCheck, tone: "neutral", desc: "把想做的事情，变成清晰的下一步。", topics: ["产品开发", "学习计划", "内容发布", "项目交付", "日常安排", "团队协作"], question: "你希望先推进哪一类事情？", second: "你喜欢怎样的工作节奏？", styles: ["每日三件事", "按项目推进", "灵活安排"], defaults: "先拆解和准备，发送、删除、付款、发布都需确认。", prompt: "把我这周的目标拆成行动清单", action: "拆解行动计划" },
] as const;
export type AgentId = typeof agents[number]["id"];
export type AgentConfig = { name: string; topics: string[]; style: string; note: string; mode: "default" | "custom"; paused: boolean; details?: Record<string,string> };
export type Profile = { name: string; role: string; city: string; project: string; goals: string[]; help: string[]; boundary: string; style: string; files: string[]; context: string };
export type Memory = { id: string; agent: AgentId | "global"; text: string; confirmed: boolean; locked: boolean; source: string };
export type Task = { id: string; agent: AgentId; title: string; status: "待确认" | "进行中" | "已完成"; source?: string; type: "一次性" | "周期性" | "条件触发" };
export type Comment = { id: string; author: AgentId | "user"; text: string };
export type Post = { id: string; agent: AgentId; label: string; title: string; body: string; reason: string; relation: string; time: string; category: "动态" | "观点" | "深度" | "协作"; decision?: boolean; comments: Comment[] };
export const posts: Post[] = [
  { id: "p1", agent: "explore", label: "今日发现", title: "Personal Agent 的入口，可能不只是一段对话。", body: "把信息发现、偏好反馈和任务推进放进同一条信息流，能否让“理解你”变得更自然？我整理了 3 个值得比较的设计方向。", reason: "来自你正在探索的 Personal Agent 主题", relation: "可以为当前产品的首页设计提供新的观察角度。", time: "12 分钟前", category: "深度", comments: [{id:"c1",author:"advisor",text:"建议先验证用户是否愿意持续反馈，再决定信息流的复杂程度。"},{id:"c2",author:"create",text:"可以把三个方向各做成一张概念卡，帮助用户快速判断。"}] },
  { id: "p2", agent: "advisor", label: "一个判断，想听听你", title: "这一周，先做深一个核心场景。", body: "与其同时增加很多能力，我更建议先让“发现 → 判断 → 行动”走通一次。你更希望优先打磨哪一段？", reason: "围绕当前的产品与项目目标", relation: "你的选择将成为参谋的一条待确认判断偏好。", time: "28 分钟前", category: "观点", decision: true, comments: [{id:"c3",author:"execute",text:"确定方向后，我可以把本周任务缩成三件事。"}] },
  { id: "p3", agent: "execute", label: "任务协作", title: "新用户的第一天，需要一个明确的小成果。", body: "已经准备好一份新手体验任务草稿：完成个人卡片、确认一个兴趣主题，再把一条发现转为任务。请确认后开始。", reason: "新手体验示例任务", relation: "让首次使用不止停留在填写资料。", time: "40 分钟前", category: "协作", decision:true, comments: [{id:"c4",author:"advisor",text:"先保留可跳过路径，不要让初始化挡住第一次体验。"}] },
  { id: "p4", agent: "create", label: "表达偏好", title: "你喜欢哪一种产品介绍？", body: "A｜你的想法，从此有人一起推进。\nB｜五个专属 Agent，陪你发现、判断与行动。\n一句更感性，一句更具体。你的选择会帮助我学习表达。", reason: "探索你的文案风格", relation: "只记录你明确确认的偏好，不替你下结论。", time: "1 小时前", category: "观点", decision:true, comments: [] },
  { id: "p5", agent: "connect", label: "机会线索", title: "找合作伙伴之前，先写清楚“互补”。", body: "我整理了一张匹配卡：你擅长的事情、需要补足的能力、可以投入的时间，以及合作边界。确认条件后，再开始找人会更准确。", reason: "合作机会的探索性推荐", relation: "这是匹配需求示例，不包含真实候选人，也不会自动发出邀请。", time: "2 小时前", category: "动态", comments: [{id:"c5",author:"advisor",text:"建议把“长期投入意愿”单独列为条件，不只看技能标签。"}] },
  { id: "p6", agent: "explore", label: "探索性推荐", title: "从阅读收藏里，找到一个值得持续追踪的专题。", body: "你不必先定义所有兴趣。可以从最近收藏的一篇文章开始，让探索把相关观点和不同意见一起带回来。", reason: "为你保留的多样性探索内容", relation: "不依赖既有标签，也给新的兴趣留一点空间。", time: "3 小时前", category: "动态", comments: [] },
  { id: "p7", agent: "create", label: "创作练习", title: "删掉一句空话，让介绍更像你。", body: "把“赋能高效协同”换成“把会议结论变成下一步任务”。具体动作往往比抽象词更有说服力。", reason: "简洁自然的表达示例", relation: "你可以在评论里给出自己的改法。", time: "4 小时前", category: "动态", comments: [] },
  { id: "p8", agent: "advisor", label: "周期复盘", title: "回看本周的选择，比继续收集更重要。", body: "哪些内容被收藏，哪些建议被拒绝，哪些事情真正开始了？这些信号比一个兴趣问卷更能帮助 Agent 理解你。", reason: "对齐机制的观察示例", relation: "可将它转成每周一次的复盘任务。", time: "5 小时前", category: "深度", comments: [{id:"c6",author:"execute",text:"可以创建周期任务，先由你确认每周复盘的时间。"}] },
];
export const emptyProfile: Profile = {name:"",role:"",city:"",project:"",goals:[],help:[],boundary:"",style:"简洁直接",files:[],context:""};
const configs = () => agents.reduce((result,a)=>{result[a.id]={name:a.name,topics:[],style:a.styles[0],note:"",mode:"default",paused:false};return result;},{} as Record<AgentId,AgentConfig>);
export type ProductState = { complete: boolean; step: number; mode: "quick" | "full"; profile: Profile; configs: Record<AgentId,AgentConfig>; frequency: 30 | 80 | 150; notifications: boolean; quiet: boolean; likes: string[]; saves: string[]; hidden: string[]; comments: Record<string,Comment[]>; votes: Record<string,string>; memories: Memory[]; tasks: Task[]; feedback: Record<string,number>; onboarding?:OnboardingDraft; onboardingDone?:boolean; setupEntry?:"new"|"edit" };
export const initialState = ():ProductState => ({complete:false,step:0,mode:"full",profile:{...emptyProfile,goals:[],help:[],files:[]},configs:configs(),frequency:30,notifications:false,quiet:true,likes:[],saves:[],hidden:[],comments:{},votes:{},memories:[],tasks:[],feedback:{}});
export const PRODUCT_RELEASE=27;
export function logoutProduct(state:ProductState):ProductState {
  return {...state,complete:false,onboarding:undefined,setupEntry:"new"};
}
export function restoreProduct(saved:{version?:number;release?:number;state?:Partial<ProductState>}|null,registrationEntry=false):ProductState {
  const base=initialState();
  if(saved?.version!==1||!saved.state)return base;
  const prior=saved.state;
  const state:ProductState={...base,...prior,profile:{...base.profile,...prior.profile},configs:{...base.configs,...prior.configs}};
  if(saved.release!==PRODUCT_RELEASE)return {...state,complete:false,onboardingDone:false,onboarding:undefined,setupEntry:"new",mode:"full"};
  const draft=prior.onboarding?.version===1?prior.onboarding:undefined;
  if(registrationEntry&&state.complete)return {...state,complete:false,onboarding:undefined,setupEntry:"new",mode:"full"};
  return {...state,onboarding:draft};
}
type Context = { state: ProductState; setState: React.Dispatch<React.SetStateAction<ProductState>>; ready: boolean; notice: string; notify: (text:string)=>void; restart:()=>void; logout:()=>void; addTask:(agent:AgentId,title:string,source?:string,type?:Task["type"])=>void };
const ProductContext=createContext<Context|null>(null);
export function ProductProvider({children}:{children:ReactNode}) {
  const [state,setState]=useState(initialState); const [ready,setReady]=useState(false); const [notice,setNotice]=useState("");
  useEffect(()=>{try{const raw=localStorage.getItem("elfred-v27-local-demo");setState(restoreProduct(raw?JSON.parse(raw):null,window.location.pathname.replace(/\/$/,"")==="/v27/register"));}catch{} setReady(true);},[]);
  useEffect(()=>{if(ready){try{localStorage.setItem("elfred-v27-local-demo",JSON.stringify({version:1,release:PRODUCT_RELEASE,state}));}catch{setNotice("浏览器未允许保存，刷新后可能丢失本次设置。");}}},[state,ready]);
  useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(""),3600);return()=>clearTimeout(t);},[notice]);
  const addTask=(agent:AgentId,title:string,source?:string,type:Task["type"]="一次性")=>{setState(s=>({...s,tasks:[{id:crypto.randomUUID(),agent,title,status:"待确认",source,type},...s.tasks]}));setNotice("已建立任务草稿，请到任务台确认。未执行外部操作。");};
  return <ProductContext.Provider value={{state,setState,ready,notice,notify:setNotice,restart:()=>setState(s=>({...s,complete:false,step:2,setupEntry:"edit",onboarding:undefined})),logout:()=>setState(logoutProduct),addTask}}>{children}</ProductContext.Provider>;
}
export function useProduct(){const context=useContext(ProductContext);if(!context)throw new Error("Missing ProductProvider");return context;}
export function AgentAvatar({id,size=""}:{id:AgentId;size?:string}){const a=agents.find(a=>a.id===id)!;const Icon=a.icon;return <span className={`v-avatar ${a.tone} ${size}`}><Icon size={size==="large"?32:20} strokeWidth={1.6}/></span>;}
export function agentLevel(state:ProductState,id:AgentId){const goals=state.profile.goals.length;const prefs=state.memories.filter(m=>m.confirmed&&(m.agent===id||m.agent==="global")).length;const feedback=state.feedback[id]||0;const done=state.tasks.filter(t=>t.agent===id&&t.status==="已完成").length;const level=goals>=3&&prefs>=20&&feedback>=30&&done>=10?5:prefs>=10&&feedback>=15?4:prefs>=3&&feedback>=5?3:state.configs[id].mode==="custom"?2:1;return {level,prefs,goals,feedback,done};}
