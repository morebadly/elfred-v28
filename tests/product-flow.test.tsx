import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { agents, initialState, agentLevel, logoutProduct, ProductProvider, restoreProduct, PRODUCT_RELEASE } from "../app/product-state";
import { Onboarding } from "../app/onboarding";
import { AgentHome } from "../app/agent-home";
import { createSetupDraft,editFromReview,goBack,goTo,nextSetup,setupProgress,validateSetup,validateContact,type SetupNavigation } from "../app/onboarding-flow";

test("five distinct agents start with private, safe defaults",()=>{
  const state=initialState();
  assert.equal(new Set(agents.map(a=>a.id)).size,5);
  assert.equal(state.complete,false);
  assert.equal(state.frequency,30);
  assert.equal(state.notifications,false);
  assert.equal(state.tasks.length,0);
  agents.forEach(a=>assert.equal(agentLevel(state,a.id).level,1));
});

test("explicit initialization unlocks L2, not the L6 milestone",()=>{
  const state=initialState();
  state.configs.explore.mode="custom";
  assert.equal(agentLevel(state,"explore").level,2);
  state.profile.goals=["a","b","c"];
  state.feedback.explore=100;
  state.memories=Array.from({length:30},(_,i)=>({id:String(i),agent:"explore",text:"pref",confirmed:true,locked:false,source:"test"}));
  state.tasks=Array.from({length:20},(_,i)=>({id:String(i),agent:"explore",title:"task",status:"已完成",type:"一次性"}));
  assert.ok(agentLevel(state,"explore").level<6,"local demo feedback cannot certify real understanding");
});

test("registration renders both account and guest experience paths",()=>{
  const html=renderToStaticMarkup(<ProductProvider><Onboarding/></ProductProvider>);
  assert.match(html,/注册/);
  assert.match(html,/登录/);
  assert.match(html,/先体验，不登录/);
  assert.match(html,/不创建真实账号/);
  assert.match(html,/form="setup-form"/);
  assert.match(html,/创建你的 Elfred/);
  assert.match(html,/V27/);
});

test("home preserves reference hierarchy, five same-row agents, and meaningful feed cards",()=>{
  const html=renderToStaticMarkup(<ProductProvider><AgentHome onCommunity={()=>{}} onSchedule={()=>{}}/></ProductProvider>);
  for(const label of ["Skill 与 Mini App","找机会","社区","任务","搜索人、内容、机会","今日简报","5 个 Agent 正在持续理解你","查看今日重点","Agent 朋友圈","查看全部"])assert.ok(html.includes(label),label);
  assert.equal((html.match(/class="r-post-card"/g)||[]).length,3);
  assert.equal((html.match(/class="r-agent-row"/g)||[]).length,1);
  assert.equal((html.match(/aria-label="进入[^"]+Agent 独立主页"/g)||[]).length,5);
  assert.ok(html.indexOf("r-search")<html.indexOf("r-brief"));
  assert.ok(html.indexOf("r-brief")<html.indexOf("r-agent-row"));
  assert.ok(html.indexOf("r-agent-row")<html.indexOf("r-feed-section"));
  for(const removed of ["今天，一起向前","我的 Agent 小队","v-reminder-section","v-live-player"])assert.ok(!html.includes(removed));
});

test("quick and full onboarding have deterministic five/seven-step routes",()=>{
  for(const mode of ["quick","full"] as const){
    let nav:SetupNavigation={...createSetupDraft(initialState()).navigation,mode,screen:"basics"};
    const seen:string[]=[];
    for(let i=0;i<10&&nav.screen!=="review";i++){seen.push(nav.screen);nav=nextSetup(nav);}
    seen.push(nav.screen);
    assert.deepEqual(seen,mode==="quick"?["basics","focus","team","rhythm","review"]:["basics","focus","preferences","context","team","rhythm","review"]);
    assert.equal(setupProgress(nav).total,mode==="quick"?5:7);
    assert.equal(setupProgress(nav).current,seen.length);
  }
});

test("skip/back uses visited history, not an invented previous step",()=>{
  let nav=createSetupDraft(initialState()).navigation;
  nav=goTo(nav,"start");nav=goTo(nav,"team");
  assert.equal(goBack(nav).screen,"start");
  nav=nextSetup(nav);
  assert.equal(goBack(nav).screen,"team");
});

test("review edits return to review, including nested agent editing",()=>{
  let nav=goTo(createSetupDraft(initialState()).navigation,"review");
  nav=editFromReview(nav,"team");nav={...goTo(nav,"agent"),agentId:"explore"};
  nav=goBack(nav);
  assert.equal(nav.screen,"team");assert.equal(nav.returnTo,"review");
  nav=nextSetup(nav);
  assert.equal(nav.screen,"review");assert.equal(nav.returnTo,null);
  for(const target of ["basics","focus","preferences","context","rhythm"] as const){
    assert.equal(nextSetup(editFromReview(nav,target)).screen,"review");
    assert.equal(goBack(editFromReview(nav,target)).screen,"review");
  }
});

test("initialization drafts do not mutate confirmed information",()=>{
  const state=initialState();state.profile.name="Original";
  const draft=createSetupDraft(state,true);
  draft.profile.name="Draft";draft.profile.goals.push("New goal");
  draft.configs.explore.topics.push("New topic");draft.configs.explore.details={sources:"Different source"};
  assert.equal(state.profile.name,"Original");assert.deepEqual(state.profile.goals,[]);
  assert.deepEqual(state.configs.explore.topics,[]);assert.equal(state.configs.explore.details,undefined);
  assert.equal(draft.navigation.screen,"start");
  assert.ok(!("contact" in draft)&&!("code" in draft));
});

test("required input is conditional and optional pages remain skippable",()=>{
  const profile={...initialState().profile,goals:[]};
  assert.notEqual(validateSetup("basics",profile),"");assert.notEqual(validateSetup("focus",profile),"");
  profile.name=" A ";assert.equal(validateSetup("basics",profile),"");
  profile.project="A current project";assert.equal(validateSetup("focus",profile),"");
  for(const screen of ["preferences","context","team","rhythm"] as const)assert.equal(validateSetup(screen,profile),"");
});

test("contact validation rejects incomplete input before code screen",()=>{
  assert.equal(validateContact("phone","+86","138 0013 8000"),true);
  assert.equal(validateContact("phone","+86","123"),false);
  assert.equal(validateContact("phone","+86","23800138000"),false);
  assert.equal(validateContact("phone","+1","202-555-0123"),true);
  assert.equal(validateContact("email","+86","hello@example.com"),true);
  assert.equal(validateContact("email","+86","hello@"),false);
  assert.equal(validateContact("email","+86","hello world@example.com"),false);
});

test("V27 reopens registration for an old completed session without deleting data",()=>{
  const old=initialState();old.complete=true;old.onboardingDone=true;old.profile.name="Harisen";
  old.configs.explore.name="我的探索";old.likes=["p1"];
  const restored=restoreProduct({version:1,state:old});
  assert.equal(restored.complete,false);
  assert.equal(restored.onboardingDone,false);
  assert.equal(restored.mode,"full");
  assert.equal(restored.profile.name,"Harisen");
  assert.equal(restored.configs.explore.name,"我的探索");
  assert.deepEqual(restored.likes,["p1"]);
  assert.equal(createSetupDraft(restored).navigation.screen,"account");
});

test("V27 preserves completed sessions and opens a direct registration entry when requested",()=>{
  const state=initialState();state.complete=true;state.onboardingDone=true;
  const saved={version:1,release:PRODUCT_RELEASE,state};
  assert.equal(restoreProduct(saved).complete,true);
  const direct=restoreProduct(saved,true);
  assert.equal(direct.complete,false);
  assert.equal(direct.setupEntry,"new");
  assert.equal(createSetupDraft(direct).navigation.screen,"account");
  assert.equal(direct.mode,"full");
});

test("V27 resumes an unfinished onboarding draft",()=>{
  const state=initialState();
  state.onboarding=createSetupDraft(state);
  state.onboarding.navigation.screen="focus";
  state.onboarding.profile.name="Draft";
  const restored=restoreProduct({version:1,release:PRODUCT_RELEASE,state},true);
  assert.equal(restored.onboarding?.navigation.screen,"focus");
  assert.equal(restored.onboarding?.profile.name,"Draft");
  assert.equal(restored.complete,false);
});

test("sign out returns to login while preserving local account data",()=>{
  const state=initialState();state.complete=true;state.onboardingDone=true;state.profile.name="Harisen";state.likes=["p1"];
  const signedOut=logoutProduct(state);
  assert.equal(signedOut.complete,false);
  assert.equal(signedOut.onboardingDone,true);
  assert.equal(signedOut.onboarding,undefined);
  assert.equal(signedOut.setupEntry,"new");
  assert.equal(signedOut.profile.name,"Harisen");
  assert.deepEqual(signedOut.likes,["p1"]);
  assert.equal(createSetupDraft(signedOut).navigation.screen,"account");
});

test("profile keeps the original modules without extra registration cards",()=>{
  const source=readFileSync("app/page.tsx","utf8");
  assert.ok(!source.includes("ProfileEntry"));
  assert.ok(!source.includes("r-login-entry"));
  for(const value of ["profile-identity-hero","profile-level-card","profile-honor-section","identity-generate compact","profile-quick-grid"])assert.ok(source.includes(value));
  assert.ok(source.includes('href="/v27/register"'));
  assert.ok(source.includes("退出登录"));
  assert.ok(source.includes("onLogout={product.logout}"));
});

test("knowledge and memory keep the V27.5 library layout contract",()=>{
  const source=readFileSync("app/page.tsx","utf8");
  const styles=readFileSync("app/v27-refine.css","utf8");
  assert.ok(source.includes('LibraryHeader active="knowledge"'));
  assert.ok(source.includes('LibraryHeader active="memory"'));
  assert.ok(source.includes('className="deck-pagination"'));
  assert.ok(source.includes('className="insight-view-toggle"'));
  assert.ok(source.includes('className={overviewExpanded ? "" : "is-clamped"}'));
  assert.ok(source.includes("memory-detail-page"));
  for(const rule of ["grid-template-columns:180px 140px","width:32px","height:72px!important","padding:0 20px 116px!important"])assert.ok(styles.includes(rule),rule);
  assert.ok(styles.includes("width:calc((100% - 16px)/3)"));
  assert.ok(styles.includes("flex-basis:66px"));
});
