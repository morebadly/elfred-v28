import type { AgentConfig, AgentId, ProductState, Profile } from "./product-state";

export type SetupScreen = "account" | "verify" | "start" | "basics" | "focus" | "preferences" | "context" | "team" | "agent" | "rhythm" | "review";
export type SetupNavigation = { screen:SetupScreen; mode:"quick"|"full"; history:SetupScreen[]; returnTo:"review"|null; agentId:AgentId|null };
export type OnboardingDraft = { version:1; editing:boolean; navigation:SetupNavigation; profile:Profile; configs:Record<AgentId,AgentConfig>; frequency:30|80|150; notifications:boolean; quiet:boolean };

export function createSetupDraft(state:ProductState,editing=false):OnboardingDraft {
  return {version:1,editing,navigation:{screen:editing?"start":"account",mode:state.mode,history:[],returnTo:null,agentId:null},profile:{...state.profile,goals:[...state.profile.goals],help:[...state.profile.help],files:[...state.profile.files]},configs:Object.fromEntries(Object.entries(state.configs).map(([id,config])=>[id,{...config,topics:[...config.topics],details:{...config.details}}])) as Record<AgentId,AgentConfig>,frequency:state.frequency,notifications:state.notifications,quiet:state.quiet};
}

export function goTo(n:SetupNavigation,screen:SetupScreen):SetupNavigation {
  if(screen===n.screen)return n;
  return {...n,screen,history:[...n.history,n.screen]};
}

export function goBack(n:SetupNavigation):SetupNavigation {
  if(!n.history.length)return n;
  const screen=n.history[n.history.length-1];
  return {...n,screen,history:n.history.slice(0,-1),returnTo:screen==="review"?null:n.returnTo};
}

export function editFromReview(n:SetupNavigation,screen:SetupScreen):SetupNavigation {
  return {...goTo(n,screen),returnTo:"review"};
}

export function nextSetup(n:SetupNavigation):SetupNavigation {
  if(n.returnTo==="review"&&n.screen!=="agent")return {...n,screen:"review",returnTo:null,history:n.history.slice(0,-1)};
  const next:Partial<Record<SetupScreen,SetupScreen>>={basics:"focus",focus:n.mode==="full"?"preferences":"team",preferences:"context",context:"team",team:"rhythm",rhythm:"review"};
  return next[n.screen]?goTo(n,next[n.screen]!):n;
}

export function setupProgress(n:SetupNavigation) {
  const sequence:SetupScreen[]=n.mode==="full"?["basics","focus","preferences","context","team","rhythm","review"]:["basics","focus","team","rhythm","review"];
  const screen=n.screen==="agent"?"team":n.screen;
  const index=sequence.indexOf(screen);
  return {current:Math.max(0,index)+1,total:sequence.length,visible:index>=0};
}

export function validateSetup(screen:SetupScreen,profile:Profile):string {
  if(screen==="basics"&&!profile.name.trim())return "请填写一个称呼，或者选择稍后填写。";
  if(screen==="focus"&&!profile.project.trim()&&profile.goals.length===0)return "写下正在做的事，或选择一个当前目标。暂时不确定也可以跳过。";
  return "";
}

export function validateContact(channel:"phone"|"email",country:string,contact:string):boolean {
  const value=contact.trim();
  if(channel==="email")return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  return (country==="+86"?/^1\d{10}$/:/^\d{7,15}$/).test(value.replace(/[\s-]/g,""));
}
