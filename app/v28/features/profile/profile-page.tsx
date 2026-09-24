"use client";

import {
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  Bookmark,
  ChevronRight,
  Heart,
  Layers3,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import type { V277State } from "../../../v27-7-state";
import type { Screen } from "../../core/screen";
import { ProfileShareSheet } from "../../legacy/legacy-ui";
import {useRuntime} from '../../core/runtime-context';
import {text} from '../live/types';

export function ProfilePage({
  state,
  setState,
  go,
  notify,
  initialShareOpen = false,
}: {
  state: V277State;
  setState: Dispatch<SetStateAction<V277State>>;
  go: (screen: Screen) => void;
  notify: (text: string) => void;
  initialShareOpen?: boolean;
}) {
  const runtime=useRuntime();
  const profile=runtime?.snapshot?.objects.profile[0];
  const [tab, setTab] = useState("动态");
  const [shareOpen, setShareOpen] = useState(initialShareOpen);
  return (
    <main className="v277-page v277-profile-page">
      <section
        className="v277-profile-hero"
        style={{ backgroundImage: "url('/profile-reference.png')" }}
        aria-label={`${state.profile.name||'我'} 的个人主页`}
      >
        {runtime&&<>
          {Boolean(profile?.data.cover)&&<div style={{position:'absolute',inset:0,backgroundImage:`url(${text(profile,'cover')})`,backgroundSize:'cover',backgroundPosition:'center'}}/>}
          <div style={{position:'absolute',left:0,right:0,top:214,bottom:0,padding:'14px 18px',background:'linear-gradient(110deg,#242a2c,#303334)',color:'white'}}>
            <div style={{display:'flex',gap:12,alignItems:'center'}}><span style={{width:78,height:78,borderRadius:'50%',border:'2px solid white',flexShrink:0,background:profile?.data.avatar?`center/cover url(${text(profile,'avatar')})`:'#596263',display:'grid',placeItems:'center',fontSize:28}}>{!profile?.data.avatar&&state.profile.name.slice(0,1)}</span><div><b style={{fontSize:22}}>{state.profile.name}</b><small style={{display:'block',opacity:.8}}>@{state.profile.username}</small><p style={{fontSize:12,margin:'8px 0',lineHeight:1.4}}>{state.profile.bio||'填写简介，让对方认识你。'}</p></div></div>
            <div style={{display:'flex',gap:24,marginTop:12,fontSize:12}}><span>{runtime.snapshot?.objects.friend.filter(item=>item.data.status==='accepted').length||0}<br/>好友</span><span>{runtime.snapshot?.objects.task.filter(item=>item.data.status==='completed').length||0}<br/>已验收</span><span>{state.profile.showLevel?'理解待验证':state.profile.tags.join(' · ')}</span><span style={{marginLeft:'auto',border:'1px solid white',borderRadius:20,padding:'5px 12px',height:30}}>编辑资料</span></div>
          </div>
        </>}
        <button
          type="button"
          className="share-hit"
          aria-label="分享个人主页"
          onClick={() => setShareOpen(true)}
        />
        <button
          type="button"
          className="settings-hit"
          aria-label="个人设置"
          onClick={() => go({ name: "settings" })}
        />
        <button
          type="button"
          className="edit-hit"
          aria-label="编辑资料"
          onClick={() => go({ name: "profile-edit" })}
        />
      </section>
      <section className="v277-profile-body">
        {runtime&&<button type="button" className="v277-secondary" onClick={()=>go({name:"onboarding-chat"})}>继续与 Elfred 的初始化对话</button>}
        <nav className="v277-profile-tabs">
          {["动态", "能力", "勋章"].map((name) => (
            <button
              type="button"
              key={name}
              className={tab === name ? "active" : ""}
              onClick={() => setTab(name)}
            >
              {name}
            </button>
          ))}
        </nav>
        {runtime&&tab==='动态'?<>{runtime.snapshot?.objects.feed.length?runtime.snapshot.objects.feed.map(item=><article key={item.id} className="v277-profile-post"><time><b>{new Date(item.created).getDate()}</b><span>{new Date(item.created).getMonth()+1}月</span></time><section><button onClick={()=>go({name:'task',id:text(item,'task_id')})}><p>{text(item,'title')}</p><small>{text(item,'summary')}</small></button></section></article>):<div className="v277-empty"><p>还没有已验收的成果动态。</p></div>}</>:tab === "动态" ? (
          <article className="v277-profile-post">
            <time>
              <b>08</b>
              <span>9月</span>
            </time>
            <section>
              <p>
                完成了一次产品方向复盘，把模糊的需求重新拆成了可验证的任务。
              </p>
              <i
                className="v277-profile-post-image"
                style={{ backgroundImage: "url('/profile-reference.png')" }}
              />
              <footer>
                <span>
                  <Heart size={20} />
                  12
                </span>
                <span>
                  <MessageCircle size={19} />4
                </span>
                <span>
                  <Bookmark size={19} />
                  收藏
                </span>
              </footer>
            </section>
          </article>
        ) : (
          <button
            type="button"
            className="v277-profile-tab-card"
            onClick={() =>
              tab === "能力"
                ? go({ name: "knowledge" })
                : go({ name: "utility", kind: "honors" })
            }
          >
            <span>
              {tab === "能力" ? <Layers3 size={24} /> : <Sparkles size={24} />}
            </span>
            <h2>{tab === "能力" ? "已沉淀的能力" : "成长勋章"}</h2>
            <p>
              {tab === "能力"
                ? "从真实任务与结果中持续沉淀，点击查看知识库。"
                : "记录每一次被验证的成长，点击查看荣誉。"}
            </p>
            <ChevronRight size={18} />
          </button>
        )}
      </section>
      {shareOpen && (
        <ProfileShareSheet
          state={state}
          setState={setState}
          onClose={() => setShareOpen(false)}
          notify={notify}
        />
      )}
    </main>
  );
}
