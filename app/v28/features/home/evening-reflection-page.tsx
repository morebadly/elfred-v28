"use client";

import { useEffect, useReducer, useState } from "react";
import {dailyTasks} from '../../core/local-day.mjs';
import {ReflectionGenerator} from './reflection-generator';
import {EveningFollowup} from './evening-followup';
import {useRuntime,entityRef} from '../../core/runtime-context';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  CircleDashed,
  Clock3,
  FileSearch,
  GitBranch,
  Lightbulb,
  PencilLine,
  Route,
  ShieldCheck,
  X,
} from "lucide-react";
import { formatToday, IconButton } from "../../legacy/legacy-ui";
import type { V277State } from "../../../v27-7-state";
import {
  buildEveningReflectionModel,
  initialReflectionReview,
  updateReflectionReview,
  type ReflectionDecision,
} from "./evening-reflection-model";
import styles from "./evening-reflection.module.css";

const decisionCopy: Record<
  ReflectionDecision,
  { label: string; message: string }
> = {
  pending: {
    label: "待你确认",
    message: "当前只是 Person Agent 的候选反思，不会触发任何后续动作。",
  },
  confirmed: {
    label: "已确认反思",
    message: "你确认了这次理解；画像写入、上下文分配和明日任务仍需分别授权。",
  },
  corrected: {
    label: "已按你的修正记录",
    message: "修正版只保留在本次演示状态中，不会自动进入稳定画像。",
  },
  deferred: {
    label: "已搁置",
    message: "这次反思暂不采用，也不会据此改变后续支持。",
  },
  denied: {
    label: "已否认",
    message: "这次推断已被标记为不成立，不会沉淀或分发。",
  },
};

export function EveningReflectionPage({
  state,
  onBack,
  notify,
}: {
  state: V277State;
  onBack: () => void;
  notify: (text: string) => void;
}) {
  const runtime=useRuntime();
  const localDate=(date:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:String(runtime?.snapshot?.objects.settings[0].data.timezone||'Asia/Shanghai'),year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
  const today=localDate(new Date());
  const brief=runtime?.snapshot?.objects.brief.find(item=>item.data.kind==='evening'&&item.data.local_date===today);
  useEffect(()=>{if(runtime&&!brief)void runtime.command('brief.create',{kind:'evening'}).catch(()=>{});},[today]);
  const [review, dispatchReview] = useReducer(
    updateReflectionReview,
    initialReflectionReview,
  );
  const [editing, setEditing] = useState(false);
  const [correctionDraft, setCorrectionDraft] = useState("");
  const actualIds=dailyTasks(runtime?.snapshot?.objects.task||[],String(runtime?.snapshot?.objects.settings[0].data.timezone||'Asia/Shanghai'),today).filter(item=>!item.data.internal_search).map(item=>item.id);
  const reflection = buildEveningReflectionModel(runtime?{...state,tasks:state.tasks.filter(task=>actualIds.includes(task.id)).map(task=>({...task,source:'今日任务记录'}))}:state);
  if(runtime){reflection.explanation.alternative='也可能存在未记录的线下进展；仅凭任务状态不能推断长期偏好。';reflection.understanding.text='本次先核对任务的实际状态和验收标准，再决定是否调整下一步。';}
  const candidate=brief?.data.reflection as {explanation:string;alternative:string;understanding:string;continuation:string;routing:string;evidence_ids:string[];facts:{task_id:string;title:string;version:number}[]}|undefined;
  const candidateCurrent=candidate&&candidate.facts.every(f=>runtime?.snapshot?.objects.task.some(t=>t.id===f.task_id&&t.version===f.version));
  if(candidate&&candidateCurrent){reflection.explanation.primary=candidate.explanation;reflection.explanation.alternative=candidate.alternative;reflection.understanding.text=candidate.understanding;reflection.understanding.evidence=candidate.facts.filter(f=>candidate.evidence_ids.includes(f.task_id)).map(f=>f.title+' · v'+f.version).join('；');reflection.action.continuation=candidate.continuation;reflection.action.routing=candidate.routing;reflection.action.target='本次建议中明确的系统，仍需分别授权';}
  useEffect(()=>{const saved=brief?.data.review as {decision:ReflectionDecision;correction:string}|undefined;if(!saved){dispatchReview({type:'reset'});return;}if(saved.decision==='corrected')dispatchReview({type:'correct',correction:saved.correction});else if(saved.decision!=='pending')dispatchReview({type:'decide',decision:saved.decision});},[brief?.version]);
  const decisionState = decisionCopy[review.decision];
  const activeUnderstanding =
    review.decision === "corrected" && review.correction
      ? review.correction
      : reflection.understanding.text;
  const factGroups = [
    { label: "今日完成", tone: "positive", items: reflection.facts.completed },
    { label: "未完成", tone: "neutral", items: reflection.facts.unfinished },
    { label: "变化与阻塞", tone: "warning", items: reflection.facts.changesAndBlocks },
  ] as const;

  const chooseDecision = (next: Exclude<ReflectionDecision, "pending" | "corrected">) => {
    if(runtime&&brief){void runtime.command('brief.review',{...entityRef(brief),decision:next}).then(()=>{setEditing(false);dispatchReview({type:'decide',decision:next});notify('本次反思决定已保存')}).catch(()=>{});return;}
    setEditing(false);
    dispatchReview({ type: "decide", decision: next });
    notify(decisionCopy[next].label);
  };

  const saveCorrection = () => {
    if (!correctionDraft.trim()) {
      notify("请先写下需要修正的内容");
      return;
    }
    if(runtime&&brief){void runtime.command('brief.review',{...entityRef(brief),decision:'corrected',correction:correctionDraft}).then(()=>{dispatchReview({type:'correct',correction:correctionDraft});setEditing(false);notify('修正版已保存，可刷新核对')}).catch(()=>{});return;}
    dispatchReview({ type: "correct", correction: correctionDraft });
    setEditing(false);
    notify("已记录你的修正");
  };

  return (
    <main className={`v277-page v283-brief-page ${styles.page}`}>
      <header className="v283-brief-head">
        <IconButton label="返回" onClick={onBack}>
          <ArrowLeft size={22} />
        </IconButton>
        <span>
          <h1>今日回顾</h1>
          <small>{formatToday()}</small>
        </span>
        <span className={styles.personMark} aria-label="Person Agent 反思">
          <Lightbulb size={20} />
        </span>
      </header>

      <div className={`v283-brief-scroll ${styles.scroll}`}>
        <section className={`v283-brief-conclusion ${styles.hero}`}>
          <small>晚间 · Person Agent 反思</small>
          <h2>先核对今天，再决定要不要改变明天</h2>
          <p>我把今天的结果、偏差和一条新理解放在一起。它们现在都只是待确认建议。</p>
          <div className={styles.heroMeta}>
            <span className={styles.statusPill}>{decisionState.label}</span>
            <span>{runtime?'本人任务记录 · 反思不自动写入长期记忆':'演示数据 · 未写入长期记忆'}</span>
          </div>
        </section>

        {runtime&&brief&&<ReflectionGenerator brief={brief} taskIds={actualIds}/>}
        {candidate&&!candidateCurrent&&<p role="alert">反思依据已更新，当前显示任务事实，请重新生成并核对。</p>}
        <section className={styles.layerSection} aria-labelledby="reflection-facts">
          <header className={styles.layerHeader}>
            <span>01</span>
            <div>
              <h3 id="reflection-facts">事实层</h3>
              <p>今天可核对的结果、变化与阻塞</p>
            </div>
          </header>
          <div className={styles.factGrid}>
            {factGroups.map((group) => (
              <article className={styles.factCard} data-tone={group.tone} key={group.label}>
                <b>{group.label}</b>
                <ul>
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.layerSection} aria-labelledby="reflection-explanation">
          <header className={styles.layerHeader}>
            <span>02</span>
            <div>
              <h3 id="reflection-explanation">解释层</h3>
              <p>偏差原因与仍需保留的替代解释</p>
            </div>
          </header>
          <article className={styles.explanationCard}>
            <div>
              <GitBranch size={20} />
              <span>
                <small>当前解释</small>
                <b>{reflection.explanation.primary}</b>
              </span>
            </div>
            <div>
              <CircleDashed size={20} />
              <span>
                <small>替代解释</small>
                <b>{reflection.explanation.alternative}</b>
              </span>
            </div>
          </article>
        </section>

        <section className={styles.layerSection} aria-labelledby="reflection-understanding">
          <header className={styles.layerHeader}>
            <span>03</span>
            <div>
              <h3 id="reflection-understanding">理解层</h3>
              <p>Person Agent 形成的一条待确认新理解</p>
            </div>
          </header>
          <article className={styles.understandingCard}>
            <div className={styles.confidenceRow}>
              <span>{review.decision === "corrected" ? "你的修正版" : "候选理解"}</span>
              <b>{runtime?'待本人核对 · 不推断长期偏好':`置信度 ${reflection.understanding.confidence}% · 待确认`}</b>
            </div>
            <h4>{activeUnderstanding}</h4>
            {review.decision === "corrected" ? (
              <p className={styles.replacedUnderstanding}>
                原候选理解已被你的修正替代：{reflection.understanding.text}
              </p>
            ) : null}
            <div className={styles.evidence}>
              <FileSearch size={19} />
              <span>
                <b>依据</b>
                <small>{reflection.understanding.evidence}</small>
              </span>
            </div>
            <p>这不是稳定画像。一次当日偏差不足以证明长期偏好，需要你的确认和后续观察。</p>
          </article>
        </section>

        <section className={styles.layerSection} aria-labelledby="reflection-action">
          <header className={styles.layerHeader}>
            <span>04</span>
            <div>
              <h3 id="reflection-action">行动层</h3>
              <p>明日延续项与最小必要上下文建议</p>
            </div>
          </header>
          <div className={styles.actionList}>{runtime&&brief&&<EveningFollowup brief={brief}/>}
            <article>
              <Clock3 size={21} />
              <span>
                <small>明日延续项 · 待授权</small>
                <b>{reflection.action.continuation}</b>
              </span>
            </article>
            <article>
              <Route size={21} />
              <span>
                <small>最小上下文路由 · 待授权</small>
                <b>{reflection.action.routing}</b>
                <em>建议对象：{reflection.action.target} · 不广播给其他 Agent</em>
              </span>
            </article>
          </div>
        </section>

        <section className={styles.safetyCard} aria-label="确认边界">
          <ShieldCheck size={22} />
          <span>
            <b>确认只代表你认可这次反思</b>
            <small>稳定画像写入、向子 Agent 分配上下文、创建明日任务都需要各自单独授权。</small>
          </span>
        </section>

        <section className={styles.reviewSection} aria-live="polite">
          <div className={styles.reviewStatus} data-decision={review.decision}>
            <b>{decisionState.label}</b>
            <p>{runtime&&review.decision==='corrected'?'修正版已保存到本次反思记录，不自动写入稳定画像。':decisionState.message}</p>
            {review.decision === "corrected" && review.correction ? (
              <blockquote>当前生效的修正版：“{review.correction}”</blockquote>
            ) : null}
          </div>

          {editing ? (
            <div className={styles.correctionEditor}>
              <label htmlFor="reflection-correction">你希望 Person Agent 如何修正？</label>
              <textarea
                id="reflection-correction"
                autoFocus
                value={correctionDraft}
                onChange={(event) => setCorrectionDraft(event.target.value)}
                placeholder="例如：不是我更偏好快速验证，而是今天内测名单缺少筛选标准。"
              />
              <div>
                <button type="button" onClick={() => setEditing(false)}>取消</button>
                <button type="button" onClick={saveCorrection}>保存修正</button>
              </div>
            </div>
          ) : null}

          <div className={styles.decisionGrid} aria-label="处理 Person Agent 反思">
            <button type="button" onClick={() => chooseDecision("confirmed")}>
              <Check size={18} />
              确认
            </button>
            <button type="button" onClick={() => setEditing(true)}>
              <PencilLine size={18} />
              修正
            </button>
            <button type="button" onClick={() => chooseDecision("deferred")}>
              <Clock3 size={18} />
              搁置
            </button>
            <button type="button" onClick={() => chooseDecision("denied")}>
              <X size={18} />
              否认
            </button>
          </div>
          {review.decision !== "pending" ? (
            <button
              type="button"
              className={styles.resetButton}
              onClick={() => {
                dispatchReview({ type: "reset" });
                setEditing(false);
              }}
            >
              <CheckCircle2 size={16} />
              重新核对
            </button>
          ) : null}
        </section>
      </div>
    </main>
  );
}
