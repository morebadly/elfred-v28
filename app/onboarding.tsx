"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronRight, FileText, Fingerprint, LockKeyhole, Mail, Plus, ShieldCheck, X } from "lucide-react";
import { AgentAvatar, agents, useProduct, type AgentConfig, type AgentId, type Memory, type Profile } from "./product-state";
import { AgentSetupFields, agentSetupFields } from "./agent-setup-fields";
import { createSetupDraft, editFromReview, goBack, goTo, nextSetup, setupProgress, validateSetup, validateContact, type OnboardingDraft, type SetupScreen } from "./onboarding-flow";

const goalOptions=["打磨产品","找到合作伙伴","学习新能力","建立个人品牌","推进项目","发现机会"];
const defaults=(id:AgentId):AgentConfig=>{const a=agents.find(a=>a.id===id)!;return {name:a.name,topics:[],style:a.styles[0],note:"",mode:"default",paused:false,details:{}};};

export function Onboarding(){
  const {state,setState}=useProduct();
  const draft=state.onboarding||createSetupDraft(state,state.setupEntry==="edit");
  const {navigation:nav,profile}=draft;
  const screen=nav.screen;
  const progress=setupProgress(nav);
  const [authIntent,setAuthIntent]=useState<"register"|"login">(()=>state.onboardingDone?"login":"register");
  const [channel,setChannel]=useState<"phone"|"email">("phone");
  const [country,setCountry]=useState("+86");
  const [contact,setContact]=useState("");
  const [agreed,setAgreed]=useState(false);
  const [challenge,setChallenge]=useState<{target:string;channel:"phone"|"email"}|null>(null);
  const [code,setCode]=useState("");
  const [countdown,setCountdown]=useState(0);
  const [error,setError]=useState("");
  const [policy,setPolicy]=useState(false);
  const [goal,setGoal]=useState("");
  const [agentForm,setAgentForm]=useState<AgentConfig|null>(null);
  const bodyRef=useRef<HTMLDivElement>(null);
  const policyRef=useRef<HTMLElement>(null);
  const updateDraft=(change:(d:OnboardingDraft)=>OnboardingDraft)=>setState(s=>({...s,onboarding:change(s.onboarding||createSetupDraft(s,s.setupEntry==="edit"))}));
  const updateProfile=(patch:Partial<Profile>)=>updateDraft(d=>({...d,profile:{...d.profile,...patch}}));
  const navigate=(target:SetupScreen)=>{setError("");updateDraft(d=>({...d,navigation:goTo(d.navigation,target)}));};
  const back=()=>{setError("");setAgentForm(null);updateDraft(d=>({...d,navigation:goBack(d.navigation)}));};
  const edit=(target:SetupScreen)=>updateDraft(d=>({...d,navigation:editFromReview(d.navigation,target)}));
  const advance=()=>{setError("");updateDraft(d=>({...d,navigation:nextSetup(d.navigation)}));};

  useEffect(()=>{setState(s=>s.onboarding?s:{...s,onboarding:createSetupDraft(s,s.setupEntry==="edit")});},[setState]);
  useEffect(()=>{bodyRef.current?.scrollTo({top:0,behavior:"instant"});setError("");},[screen,nav.agentId]);
  useEffect(()=>{if(screen==="verify"&&!challenge)updateDraft(d=>({...d,navigation:{...d.navigation,screen:"account",history:[]}}));},[screen,challenge]);
  useEffect(()=>{if(!countdown)return;const timer=setTimeout(()=>setCountdown(n=>n-1),1000);return()=>clearTimeout(timer);},[countdown]);
  useEffect(()=>{if(!policy)return;const before=document.activeElement as HTMLElement;policyRef.current?.querySelector<HTMLElement>("button")?.focus();const key=(e:KeyboardEvent)=>{if(e.key==="Escape")setPolicy(false);if(e.key==="Tab"){const buttons=policyRef.current?.querySelectorAll<HTMLButtonElement>("button");if(!buttons?.length)return;const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};document.addEventListener("keydown",key);return()=>{document.removeEventListener("keydown",key);before?.focus();};},[policy]);

  const toggleGoal=(value:string)=>{
    if(profile.goals.includes(value)){updateProfile({goals:profile.goals.filter(g=>g!==value)});setError("");return;}
    if(profile.goals.length===3){setError("最多保留 3 个当前目标，先取消一项再添加。");return;}
    updateProfile({goals:[...profile.goals,value]});setError("");
  };
  const addGoal=()=>{const value=goal.trim();if(!value)return;if(profile.goals.includes(value)){setGoal("");return;}if(profile.goals.length===3){setError("最多添加 3 个目标。");return;}toggleGoal(value);setGoal("");};
  const openAgent=(id:AgentId)=>{setAgentForm({...draft.configs[id],topics:[...draft.configs[id].topics],details:{...draft.configs[id].details}});updateDraft(d=>({...d,navigation:{...goTo(d.navigation,"agent"),agentId:id}}));};
  const agent=agents.find(a=>a.id===nav.agentId);
  const config=agent?(agentForm||draft.configs[agent.id]):null;

  const enterApp=()=>{if(window.location.pathname.replace(/\/$/,"")==="/v27/register")window.history.replaceState(null,"","/v27");};
  const finish=()=>{
    enterApp();
    const memories:Memory[]=[];
    const personal=[...[['称呼',profile.name],['身份',profile.role],['城市',profile.city],['正在做',profile.project],['沟通偏好',profile.style],['优先帮助',profile.help.join('、')],['边界',profile.boundary]],...profile.goals.map((g,i)=>[`目标 ${i+1}`,g])];
    personal.filter(([,value])=>value?.trim()).forEach(([label,value],i)=>memories.push({id:`init-global-${i}`,agent:"global",text:`${label}：${value}`,confirmed:true,locked:false,source:"个人初始化"}));
    agents.forEach(a=>{const c=draft.configs[a.id];if(c.mode!=="custom")return;const values=[...c.topics,c.style,c.note,...agentSetupFields[a.id].map(f=>{const value=c.details?.[f.key]??f.defaultValue;return value?`${f.label}：${value}`:"";})].filter(Boolean);values.forEach((text,i)=>memories.push({id:`init-${a.id}-${i}`,agent:a.id,text,confirmed:true,locked:false,source:"Agent 初始化"}));});
    setState(s=>{const retained=s.memories.filter(m=>m.locked||!(/^(init-|setup-|goal-|global-setup-)/.test(m.id)));return {...s,profile:{...draft.profile,name:draft.profile.name.trim()},configs:draft.configs,frequency:draft.frequency,notifications:draft.notifications,quiet:draft.quiet,mode:nav.mode,memories:[...retained,...memories.filter(m=>!retained.some(r=>r.id===m.id))],complete:true,onboardingDone:true,onboarding:undefined,setupEntry:undefined};});
  };
  const primary=()=>{
    setError("");
    if(screen==="account"){
      const value=contact.trim();const valid=validateContact(channel,country,contact);
      if(!valid){setError(channel==="email"?"请输入正确的邮箱地址。":"请输入有效的手机号码。");return;}
      if(!agreed){setError("请先阅读并同意用户协议与隐私说明。");return;}
      setChallenge({target:channel==="phone"?`${country} ${value}`:value,channel});setCode("");setCountdown(30);navigate("verify");return;
    }
    if(screen==="verify"){
      if(!challenge){navigate("account");return;}
      if(code!=="123456"){setError("验证码不正确。原型演示验证码为 123456。");return;}
      if(authIntent==="login"&&state.onboardingDone){enterApp();setState(s=>({...s,complete:true,onboarding:undefined,setupEntry:undefined}));return;}
      updateDraft(d=>({...d,navigation:{...d.navigation,screen:"start",history:[]}}));return;
    }
    if(screen==="start"){navigate("basics");return;}
    if(screen==="agent"&&agent&&config){if(!config.name.trim()){setError("请给 Agent 一个名字，或使用默认名称。");return;}updateDraft(d=>({...d,configs:{...d.configs,[agent.id]:{...config,name:config.name.trim(),mode:"custom"}},navigation:goBack(d.navigation)}));setAgentForm(null);return;}
    if(screen==="review"){finish();return;}
    const message=validateSetup(screen,profile);if(message){setError(message);return;}advance();
  };

  const headings:Record<SetupScreen,[string,string]>={
    account:authIntent==="register"?["创建你的 Elfred","注册后，依次填写个人信息、配置小队与使用偏好。"]:["欢迎回来","验证后继续此浏览器中的 Elfred 体验。"],
    verify:["输入验证码",challenge?`验证 ${challenge.target}`:"请先填写账号"],
    start:[draft.editing?"调整你的初始设置":"选择初始化方式","个人信息和 Agent 设定都可以稍后补充。"],
    basics:["先认识你","一个称呼就好，其他信息按需填写。"],
    focus:["现在，什么最重要？","写下正在做的事，或选 1—3 个近期目标。"],
    preferences:["按你的方式相处","明确期待与边界，减少不必要的打扰。"],
    context:["让已有资料帮忙","这是可选步骤，不导入也能开始。"],
    team:["认识你的 Agent 小队","默认配置已经就绪。只设置你想调整的搭档。"],
    agent:[agent?`设定${agent.name} Agent`:"Agent 设定","先确认重点方向，更多偏好可以以后补充。"],
    rhythm:["内容与提醒","内容量不等于通知量，随时可以调整。"],
    review:["最后，确认一下","这些设定由你决定，不会自动扩大操作权限。"],
  };
  const cta=screen==="account"?"获取验证码":screen==="verify"?(authIntent==="login"&&state.onboardingDone?"验证并登录":"验证并开始新手设置"):screen==="start"?(nav.mode==="quick"?"开始快速初始化":"开始完整初始化"):screen==="agent"?"保存并返回小队":screen==="review"?(draft.editing?"保存设置并返回主页":"确认，进入主页"):nav.returnTo?"保存并返回确认页":screen==="team"?"确认小队配置":screen==="rhythm"?"查看全部设定":"继续";
  const canSkip=["basics","focus","preferences","context"].includes(screen)&&!nav.returnTo;
  return <div className="v-onboarding n-onboarding">
    <header className="n-nav"><button type="button" className="v-icon" disabled={!nav.history.length} aria-label={screen==="agent"?"返回小队，不保存本次修改":"返回上一步"} onClick={back}><ArrowLeft size={20}/></button><strong>elfred<span>.</span></strong>{draft.editing?<button type="button" className="v-text" onClick={()=>setState(s=>({...s,complete:true,onboarding:undefined,setupEntry:undefined}))}>取消</button>:<small>V27 · 交互原型</small>}</header>
    {(screen==="account"||screen==="verify"||(screen==="start"&&challenge))&&<div className="n-account-steps" aria-label="注册流程"><span className={screen==="account"?"current":"done"}>01 账号</span><i/><span className={screen==="verify"?"current":screen==="start"?"done":""}>02 验证</span><i/><span className={screen==="start"?"current":""}>03 新手设置</span></div>}
    {progress.visible&&<div className="n-progress"><div><span>{screen==="team"||screen==="agent"?"小队设定":screen==="rhythm"?"使用偏好":screen==="review"?"确认信息":"个人信息"}</span><span>{progress.current} / {progress.total}</span></div><progress value={progress.current} max={progress.total}/></div>}
    <div className="n-body" ref={bodyRef}><form id="setup-form" onSubmit={e=>{e.preventDefault();primary();}}>
      <div className="n-heading">{screen==="account"&&<span className="n-brand-mark"><Fingerprint size={32} strokeWidth={1.35}/></span>}{screen==="agent"&&agent&&<AgentAvatar id={agent.id}/>}<h1>{headings[screen][0]}</h1><p>{headings[screen][1]}</p></div>
      {screen==="account"&&<><div className="n-auth-tabs" role="group" aria-label="登录或注册方式">{([['phone','手机号'],['email','邮箱']] as const).map(([key,label])=><button type="button" key={key} aria-pressed={channel===key} className={channel===key?"selected":""} onClick={()=>{setChannel(key);setContact("");setError("");}}>{label}</button>)}</div><div className="v-form-card n-account-card"><label htmlFor="contact">{channel==="phone"?"手机号码":"邮箱地址"}</label><div className="n-contact-input">{channel==="phone"&&<select aria-label="国家或地区区号" value={country} onChange={e=>setCountry(e.target.value)}>{["+86","+852","+65","+81","+1"].map(c=><option key={c}>{c}</option>)}</select>}<input id="contact" type={channel==="phone"?"tel":"email"} value={contact} onChange={e=>setContact(e.target.value)} placeholder={channel==="phone"?"请输入手机号码":"you@example.com"} autoComplete="off"/></div><p className="n-helper">{authIntent==="register"?"通过验证码进入新手设置，无需设置密码。":"仅恢复此浏览器的演示资料，不验证真实账号身份。"}</p><label className="n-agreement"><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/><span>我已阅读并同意 <button type="button" className="v-text" onClick={()=>setPolicy(true)}>用户协议与隐私说明</button></span></label></div><p className="n-demo-note"><LockKeyhole size={14}/>不创建真实账号，不发送短信或邮件。</p><div className="n-auth-alternative">{authIntent==="register"?"已有账号？":"第一次使用？"}<button type="button" onClick={()=>{setAuthIntent(authIntent==="register"?"login":"register");setError("");setAgreed(false);}}>{authIntent==="register"?"登录":"注册新账号"}</button></div></>}
      {screen==="verify"&&<div className="v-form-card"><span className="n-verify-mark"><Mail size={26}/></span><label htmlFor="verify-code">6 位验证码</label><input id="verify-code" className="n-code" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000"/><p className="n-helper">演示验证码：<button type="button" className="v-text" onClick={()=>setCode("123456")}>123456 · 填入</button></p><div className="n-inline-actions"><button type="button" className="v-text" onClick={back}>修改{challenge?.channel==="phone"?"手机号":"邮箱"}</button><button type="button" className="v-text" disabled={countdown>0} onClick={()=>{setCountdown(30);setCode("");}}>{countdown>0?`${countdown} 秒后可重新获取`:"重新获取"}</button></div><p className="n-helper">当前未发送真实验证码。登录仅使用此浏览器的演示资料。</p></div>}
      {screen==="start"&&<><div className="n-mode-options">{([{mode:"full",title:"完整初始化",time:"约 3—5 分钟",description:"个人信息、目标、相处偏好与参考资料。",detail:"再确认五个 Agent 和内容、提醒偏好。"},{mode:"quick",title:"快速开始",time:"约 1 分钟",description:"只填称呼、当前重点，再确认小队。",detail:"其余设置采用系统默认，之后可以补充。"}] as const).map(item=><button type="button" key={item.mode} className={nav.mode===item.mode?"selected":""} aria-pressed={nav.mode===item.mode} onClick={()=>updateDraft(d=>({...d,navigation:{...d.navigation,mode:item.mode}}))}><span className="n-radio">{nav.mode===item.mode&&<Check size={13}/>}</span><span><strong>{item.title}<small>{item.time}</small></strong><p>{item.description}</p><small>{item.detail}</small></span></button>)}</div><div className="n-quiet-note"><ShieldCheck size={18}/><p>个人信息只用于此浏览器的原型体验。完成前保存为草稿，不会覆盖你已确认的资料。</p></div></>}
      {screen==="basics"&&<div className="v-form-card"><label htmlFor="display-name">怎么称呼你 <small>本页唯一必填</small></label><input id="display-name" value={profile.name} maxLength={24} onChange={e=>updateProfile({name:e.target.value})} placeholder="你的昵称" autoComplete="nickname"/><label>当前身份 <small>可选</small></label><div className="v-chips">{["创业者","产品经理","设计师","开发者","创作者","学生","自由职业者"].map(role=><button type="button" key={role} className={profile.role===role?"selected":""} aria-pressed={profile.role===role} onClick={()=>updateProfile({role:profile.role===role?"":role})}>{role}</button>)}</div><input aria-label="自定义身份" value={profile.role} maxLength={40} onChange={e=>updateProfile({role:e.target.value})} placeholder="也可以写下自己的身份"/>{nav.mode==="full"&&<><label htmlFor="city">所在城市 <small>可选</small></label><input id="city" value={profile.city} maxLength={40} onChange={e=>updateProfile({city:e.target.value})} placeholder="例如：深圳"/></>}</div>}
      {screen==="focus"&&<div className="v-form-card"><label htmlFor="current-project">最近在做什么</label><textarea id="current-project" value={profile.project} maxLength={240} onChange={e=>updateProfile({project:e.target.value})} placeholder="例如：打磨一个产品，或准备一次职业转型" rows={3}/><div className="v-inline-label"><label>近期目标</label><small>{profile.goals.length} / 3</small></div><div className="n-goals">{goalOptions.map(g=><button type="button" key={g} className={profile.goals.includes(g)?"selected":""} aria-pressed={profile.goals.includes(g)} onClick={()=>toggleGoal(g)}>{g}{profile.goals.includes(g)?<Check size={16}/>:<Plus size={16}/>}</button>)}</div>{profile.goals.filter(g=>!goalOptions.includes(g)).map(g=><button type="button" key={g} className="v-custom-goal" onClick={()=>toggleGoal(g)}>{g}<X size={15}/></button>)}<div className="n-input-action"><input aria-label="添加自定义目标" value={goal} maxLength={100} onChange={e=>setGoal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addGoal();}}} placeholder="写一个自己的目标"/><button type="button" aria-label="添加目标" disabled={!goal.trim()} onClick={addGoal}><Plus size={18}/></button></div></div>}
      {screen==="preferences"&&<div className="v-form-card"><label>优先希望获得什么帮助</label><div className="v-chips">{["信息发现","分析判断","内容创作","连接机会","安排执行"].map(help=><button type="button" key={help} className={profile.help.includes(help)?"selected":""} onClick={()=>updateProfile({help:profile.help.includes(help)?profile.help.filter(h=>h!==help):[...profile.help,help]})}>{help}</button>)}</div><label>沟通方式</label><div className="v-chips">{["简洁直接","温和有耐心","先结论后理由"].map(style=><button type="button" key={style} className={profile.style===style?"selected":""} onClick={()=>updateProfile({style})}>{style}</button>)}</div><label htmlFor="boundary">不希望涉及的内容 <small>可选</small></label><textarea id="boundary" rows={3} value={profile.boundary} onChange={e=>updateProfile({boundary:e.target.value})} maxLength={240} placeholder="例如：不要推荐某类内容；不要替我做最终决定"/></div>}
      {screen==="context"&&<><div className="v-form-card"><label className="v-file-drop"><FileText size={24}/><strong>选择简历、介绍或历史作品</strong><span>仅记录文件名，不上传或读取文件内容</span><input type="file" multiple accept=".pdf,.doc,.docx,.md,.txt,.png,.jpg,.jpeg" onChange={e=>updateProfile({files:[...new Set([...profile.files,...Array.from(e.target.files||[]).map(f=>f.name)])].slice(0,10)})}/></label>{profile.files.map(file=><div className="v-file-row" key={file}><FileText size={16}/><span>{file}</span><button type="button" className="v-icon" aria-label={`移除 ${file}`} onClick={()=>updateProfile({files:profile.files.filter(f=>f!==file)})}><X size={15}/></button></div>)}<label htmlFor="personal-context">也可以粘贴一段自我介绍</label><textarea id="personal-context" rows={4} value={profile.context} maxLength={1500} onChange={e=>updateProfile({context:e.target.value})} placeholder="只保存在当前浏览器，不会上传。"/></div><div className="n-quiet-note"><LockKeyhole size={18}/><p>邮箱、日历、知识库等外部账号不在注册时强制授权；需要使用时再单独连接。原型尚未接入。</p></div></>}
      {screen==="team"&&<><div className="n-team-list">{agents.map(a=><button type="button" key={a.id} onClick={()=>openAgent(a.id)}><AgentAvatar id={a.id}/><span><strong>{draft.configs[a.id].name||a.name}<small>{a.role}</small></strong><small>{draft.configs[a.id].mode==="custom"?"已设定 · 点击修改":"系统默认 · 可直接开始"}</small></span><ChevronRight size={17}/></button>)}</div><div className="n-quiet-note"><ShieldCheck size={18}/><p>不需要逐个填完。未设置的 Agent 会进入探索期；L6 是持续理解后的里程碑，不是注册奖励。</p></div></>}
      {screen==="agent"&&agent&&config&&<div className="v-form-card"><label htmlFor="agent-name">名称</label><input id="agent-name" value={config.name} maxLength={12} onChange={e=>setAgentForm({...config,name:e.target.value})}/><label>{agent.id==="explore"?"优先关注的领域":"优先帮我处理"}</label><div className="v-chips">{agent.topics.map(topic=><button type="button" key={topic} className={config.topics.includes(topic)?"selected":""} onClick={()=>setAgentForm({...config,topics:config.topics.includes(topic)?config.topics.filter(t=>t!==topic):[...config.topics,topic]})}>{topic}</button>)}</div><label>{agent.second}</label><div className="v-chips">{agent.styles.map(style=><button type="button" key={style} className={config.style===style?"selected":""} onClick={()=>setAgentForm({...config,style})}>{style}</button>)}</div><details className="n-advanced"><summary>更多偏好与边界 <span>可选</span></summary><AgentSetupFields id={agent.id} config={config} onChange={setAgentForm}/><label htmlFor="agent-note">补充说明</label><textarea id="agent-note" rows={3} maxLength={240} value={config.note} onChange={e=>setAgentForm({...config,note:e.target.value})} placeholder="告诉它你在意的细节"/></details><p className="n-helper">{agent.defaults}</p></div>}
      {screen==="rhythm"&&<><div className="n-frequency-options">{([{value:30,label:"轻松看看",note:"低频 · 推荐",limit:3},{value:80,label:"保持在线",note:"中频 · 高频使用者",limit:6},{value:150,label:"深度雷达",note:"高频 · 密集信息需求",limit:10}] as const).map(item=><button type="button" key={item.value} className={draft.frequency===item.value?"selected":""} aria-pressed={draft.frequency===item.value} onClick={()=>updateDraft(d=>({...d,frequency:item.value}))}><span><strong>{item.label}</strong><small>{item.note}</small></span><b>{item.value}<small>条 / 日</small></b><span className="n-radio">{draft.frequency===item.value&&<Check size={13}/>}</span></button>)}</div><details className="n-advanced n-preferences-card"><summary>提醒偏好 <span>可选</span></summary><label className="v-switch-row"><span><strong>重要事项提醒</strong><small>最多 {draft.frequency===30?3:draft.frequency===80?6:10} 次 / 日，原型不发送通知</small></span><input type="checkbox" checked={draft.notifications} onChange={e=>updateDraft(d=>({...d,notifications:e.target.checked}))}/></label><label className="v-switch-row"><span><strong>夜间不打扰</strong><small>22:00—08:00</small></span><input type="checkbox" checked={draft.quiet} onChange={e=>updateDraft(d=>({...d,quiet:e.target.checked}))}/></label></details><div className="n-quiet-note"><ShieldCheck size={18}/><p>默认只建议、拆解与准备草稿。对外联系、发送、付款、删除及公开发布，始终先征求你的确认。</p></div></>}
      {screen==="review"&&<><section className="n-review-card"><div className="n-review-title"><h2>个人信息</h2><button type="button" className="v-text" onClick={()=>edit("basics")}>修改</button></div><strong className="n-review-name">{profile.name||"暂未填写称呼"}</strong><p>{[profile.role,profile.city].filter(Boolean).join(" · ")||"身份、城市待补充"}</p><button type="button" className="n-review-row" onClick={()=>edit("focus")}><span><small>当前重点</small><strong>{profile.goals.join("、")||profile.project||"暂未设定，后续慢慢了解"}</strong></span><ChevronRight size={16}/></button><button type="button" className="n-review-row" onClick={()=>edit("preferences")}><span><small>相处偏好</small><strong>{profile.style}{profile.boundary?" · 已设置内容边界":""}</strong></span><ChevronRight size={16}/></button><button type="button" className="n-review-row" onClick={()=>edit("context")}><span><small>参考资料</small><strong>{profile.files.length?`${profile.files.length} 个文件名`:"未导入"}{profile.context?" · 已填写介绍":""}</strong></span><ChevronRight size={16}/></button></section><section className="n-review-card"><div className="n-review-title"><h2>Agent 小队</h2><button type="button" className="v-text" onClick={()=>edit("team")}>修改</button></div><div className="n-review-agents">{agents.map(a=><div key={a.id}><AgentAvatar id={a.id}/><strong>{draft.configs[a.id].name||a.name}</strong><small>{draft.configs[a.id].mode==="custom"?"已设定":"系统默认"}</small></div>)}</div></section><section className="n-review-card"><div className="n-review-title"><h2>使用偏好</h2><button type="button" className="v-text" onClick={()=>edit("rhythm")}>修改</button></div><p>{draft.frequency} 条 / 日 · {draft.notifications?"重要事项提醒开启":"不主动通知"}</p><div className="n-boundary"><LockKeyhole size={16}/><span>只建议，关键操作先确认</span></div></section><p className="n-helper">确认后保存到此浏览器。可在「我的」中继续修改；这不是公开个人资料。</p></>}
    </form></div>
    <footer className="n-footer">{error&&<p className="v-error" role="alert">{error}</p>}<button type="submit" form="setup-form" className="v-primary">{cta}{screen==="review"?<Check size={17}/>:<ArrowRight size={17}/>}</button>
      {screen==="account"&&<button type="button" className="n-skip" onClick={()=>navigate("start")}>先体验，不登录</button>}
      {screen==="start"&&<button type="button" className="n-skip" onClick={()=>navigate("team")}>暂不填写个人信息</button>}
      {canSkip&&<button type="button" className="n-skip" onClick={advance}>{screen==="context"?"暂不导入，继续":"稍后填写这一页"}</button>}
      {screen==="agent"&&agent&&<button type="button" className="n-skip" onClick={()=>{updateDraft(d=>({...d,configs:{...d.configs,[agent.id]:defaults(agent.id)},navigation:goBack(d.navigation)}));setAgentForm(null);}}>使用系统默认并返回</button>}
    </footer>
    {policy&&<div className="v-modal" role="dialog" aria-modal="true" aria-label="用户协议与隐私说明"><section className="v-modal-card" ref={policyRef}><header><h2>用户协议与隐私说明</h2><button type="button" className="v-icon" aria-label="关闭说明" onClick={()=>setPolicy(false)}><X size={20}/></button></header><p>这是 Elfred 产品交互原型，不创建真实账号，不提供短信、邮箱验证或真实 Agent 服务。</p><p>联系方式与验证码仅保留在当前页面内存中；刷新即清除。个人信息草稿、设定和交互记录只保存在当前浏览器，不会上传或跨设备同步。</p><p>文件仅记录名称，不读取内容。不会连接外部账号、发送消息、付款或公开个人信息。这里是演示说明，不替代正式产品上线时的完整法律协议。</p><button type="button" className="v-primary" onClick={()=>{setAgreed(true);setPolicy(false);}}>已了解并同意</button></section></div>}
  </div>;
}
