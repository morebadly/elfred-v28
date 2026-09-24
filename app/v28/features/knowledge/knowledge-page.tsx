"use client";

import {useRuntime} from "../../core/runtime-context";
import {text,assetText,statuses} from "../live/types";
import { useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Compass,
  FileText,
  Layers3,
  Link2,
  MoreHorizontal,
  PenLine,
  Sparkles,
} from "lucide-react";
import type { V277State } from "../../../v27-7-state";
import type { Screen } from "../../core/screen";
import {
  AlignmentModal,
  CapabilityDetailSheet,
  LibraryHeader,
  v277Knowledge,
  type CapabilityCard,
} from "../../legacy/legacy-ui";

export function KnowledgePage({
  go,
}: {
  state: V277State;
  go: (screen: Screen) => void;
}) {
  const runtime=useRuntime();
  const [filter, setFilter] = useState("全部");
  const [insightIndex, setInsightIndex] = useState(0);
  const [alignmentOpen, setAlignmentOpen] = useState(false);
  const [selectedCapability, setSelectedCapability] =
    useState<CapabilityCard | null>(null);
  const insightSwipe = useRef({ y: 0, moved: false });
  const libraryScroll = useRef<HTMLDivElement>(null);
  const demoCards: CapabilityCard[] = [
    {
      item: v277Knowledge[0],
      type: "Skill",
      title: "机会检索",
      copy: "持续扫描与你相关的人和机会",
      score: 68,
      evidence: 2,
      icon: Compass,
    },
    {
      item: v277Knowledge[1],
      type: "Mini App",
      title: "内容提炼",
      copy: "把收藏内容整理为可复用观点",
      score: 74,
      evidence: 5,
      icon: FileText,
    },
    {
      item: v277Knowledge[2],
      type: "Agent",
      title: "主动连接",
      copy: "筛选候选人并解释匹配理由",
      score: 81,
      evidence: 8,
      icon: Link2,
    },
  ];
  const cards:CapabilityCard[]=runtime?[...(runtime.snapshot?.objects.knowledge||[]),...(runtime.snapshot?.objects.document||[]),...(runtime.snapshot?.objects.skill||[]),...(runtime.snapshot?.objects.resource||[])].filter(item=>item.data.status!=='archived').map(item=>({item:{id:item.id,title:text(item,'title'),purpose:assetText(item).slice(0,80),source:item.type,status:statuses[text(item,'status')]||text(item,'status'),example:assetText(item)},type:item.type==='skill'?'Skill':'资料',title:text(item,'title'),copy:assetText(item).slice(0,80),score:0,evidence:Array.isArray(item.data.source_refs)?item.data.source_refs.length:0,icon:FileText})):demoCards;
  const visibleCards =
    filter === "全部" ? cards : cards.filter((card) => card.type === filter);
  const finishInsightSwipe = (clientY: number) => {
    const distance = clientY - insightSwipe.current.y;
    insightSwipe.current.moved = Math.abs(distance) > 34;
    if (insightSwipe.current.moved) setInsightIndex(distance < 0 ? 1 : 0);
  };
  return (
    <main
      data-connected={runtime?"true":undefined}
      className="v277-page v277-library-page v277-knowledge-overview"
      onScroll={(event) => {
        if (!runtime&&event.currentTarget.scrollTop !== 0)
          event.currentTarget.scrollTop = 0;
      }}
      onWheel={(event) => {
        if(runtime)return;
        event.preventDefault();
        event.stopPropagation();
        if (Math.abs(event.deltaY) > 14)
          setInsightIndex(event.deltaY > 0 ? 1 : 0);
        requestAnimationFrame(() => {
          if (libraryScroll.current) libraryScroll.current.scrollTop = 0;
        });
      }}
    >
      <LibraryHeader
        active="knowledge"
        go={go}
        onContext={() => setAlignmentOpen(true)}
      />
      <div
        ref={libraryScroll}
        className="v277-library-scroll"
        onScroll={(event) => {
          if (!runtime&&event.currentTarget.scrollTop !== 0)
            event.currentTarget.scrollTop = 0;
        }}
      >
        <section className="v277-ability-head">
          <h2>
            <Layers3 size={19} />
            能力卡组
          </h2>
          <span>
            <button
              type="button"
              aria-label="创建工具"
              onClick={() => go({ name: "create-tool" })}
            >
              <PenLine size={18} />
            </button>
            <button
              type="button"
              aria-label="查看我的工具"
              onClick={() => go({ name: "my-tools" })}
            >
              <ChevronRight size={19} />
            </button>
          </span>
        </section>
        <div className="v277-ability-filters" aria-label="能力类型">
          {(runtime?["全部", "资料", "Skill", "Agent"]:["全部", "Skill", "Mini App", "Agent"]).map((name) => (
            <button
              type="button"
              key={name}
              className={filter === name ? "active" : ""}
              onClick={() => setFilter(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <section className="v277-ability-cards">
          {visibleCards.map(
            (
              { item, type, title, copy, score, evidence, icon: Icon },
              index,
            ) => (
              <button
                type="button"
                key={title}
                onClick={() =>
                  runtime?go({name:"knowledge-detail",id:item.id}):setSelectedCapability({
                    item,
                    type,
                    title,
                    copy,
                    score,
                    evidence,
                    icon: Icon,
                  })
                }
              >
                <span className={`v277-ability-level tone-${index}`}>
                  {runtime?item.status:"Lv.1 · 探索"}
                </span>
                <MoreHorizontal size={17} />
                <i className={`v277-ability-visual visual-${index}`}>
                  <Icon size={25} />
                </i>
                <small>{type.toUpperCase()}</small>
                <b>{title}</b>
                <p>{copy}</p>
                <footer>
                  <strong>
                    {runtime?"已保存":score}
                    <em>{runtime?"可追溯资料":"模型评分"}</em>
                  </strong>
                  <span>{evidence} 条来源</span>
                </footer>
              </button>
            ),
          )}
        </section>
        {runtime&&visibleCards.length===0&&<div className="v277-empty"><FileText size={24}/><b>这里还没有资料</b><p>点击上方创建按钮导入文档、保存笔记；验收任务后成果也会出现在这里。</p></div>}
        <section className="v277-progress-section">
          <div className="v277-section-title">
            <h2>
              <Sparkles size={19} />
              今天的新进展
            </h2>
            <button
              type="button"
              onClick={() => go({ name: "utility", kind: "ability" })}
            >
              查看全部
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="v277-progress-cards">{runtime?(runtime.snapshot?.objects.feed||[]).slice(0,2).map(item=><button key={item.id} onClick={()=>go({name:'task',id:text(item,'task_id')})}><span><CheckCircle2 size={19}/></span><b>{text(item,'title')}</b><small>本人验收的成果</small><strong>✓</strong></button>):<>
            <button
              type="button"
              onClick={() => go({ name: "knowledge-detail", id: "interview" })}
            >
              <span>
                <CheckCircle2 size={19} />
              </span>
              <b>用户访谈</b>
              <small>1 条 Outcome 已沉淀</small>
              <strong>+1</strong>
            </button>
            <button
              type="button"
              onClick={() => go({ name: "knowledge-detail", id: "decision" })}
            >
              <span>
                <FileText size={18} />
              </span>
              <b>产品审阅</b>
              <small>2 条上下文已更新</small>
              <strong>+2</strong>
            </button>
          </>} </div>
        </section>
        <section className="v277-cave-section">
          <div className="v277-section-title">
            <h2>
              <Compass size={19} />
              能力洞察
            </h2>
          </div>
          <div
            className="v278-insight-stack v279-insight-stack"
            data-index={insightIndex}
            aria-live="polite"
            onPointerDown={(event) => {
              insightSwipe.current = { y: event.clientY, moved: false };
            }}
            onPointerMove={(event) => {
              const distance = event.clientY - insightSwipe.current.y;
              if (Math.abs(distance) > 34) {
                insightSwipe.current.moved = true;
                setInsightIndex(distance < 0 ? 1 : 0);
              }
            }}
            onPointerUp={(event) => finishInsightSwipe(event.clientY)}
            onPointerCancel={() => {
              insightSwipe.current.moved = false;
            }}
          >
            <button
              type="button"
              className={`v279-insight-card radar ${insightIndex === 0 ? "is-front" : "is-back"}`}
              onClick={() => {
                if (insightSwipe.current.moved) {
                  insightSwipe.current.moved = false;
                  return;
                }
                go({ name: "utility", kind: "ability" });
              }}
            >
              <header>
                <h3>
                  <Compass size={17} />
                  能力雷达
                </h3>
                <span>
                  点击查看详情
                  <ChevronRight size={16} />
                </span>
              </header>
              {runtime?<div className="v277-radar-body"><div><b>{runtime.snapshot?.objects.task.filter(item=>item.data.status==='completed').length||0}</b><p>本人已验收结果</p><span>能力尚需跨任务验证</span><em>资料数量不等于能力评分</em></div></div>:<div className="v277-radar-body">
                <svg viewBox="0 0 180 144" aria-label="能力雷达图">
                  <g className="grid">
                    <polygon points="90,12 164,58 136,132 44,132 16,58" />
                    <polygon points="90,30 145,64 124,118 56,118 35,64" />
                    <polygon points="90,49 126,71 112,105 68,105 54,71" />
                    <line x1="90" y1="12" x2="90" y2="104" />
                    <line x1="164" y1="58" x2="90" y2="104" />
                    <line x1="136" y1="132" x2="90" y2="104" />
                    <line x1="44" y1="132" x2="90" y2="104" />
                    <line x1="16" y1="58" x2="90" y2="104" />
                  </g>
                  <polygon
                    className="value"
                    points="90,20 148,62 126,120 51,119 27,61"
                  />
                  <circle cx="90" cy="20" r="3" />
                  <circle cx="148" cy="62" r="3" />
                  <circle cx="126" cy="120" r="3" />
                  <circle cx="51" cy="119" r="3" />
                  <circle cx="27" cy="61" r="3" />
                  <text x="90" y="9">
                    策略 91
                  </text>
                  <text x="151" y="59">
                    洞察 88
                  </text>
                  <text x="127" y="139">
                    执行 76
                  </text>
                  <text x="18" y="139">
                    创作 84
                  </text>
                  <text x="0" y="58">
                    连接 87
                  </text>
                </svg>
                <div>
                  <b>
                    82<small>/100</small>
                  </b>
                  <p>综合能力</p>
                  <span>5 个 Outcome</span>
                  <em>3 次内部验证 · 可追溯</em>
                </div>
              </div>}
            </button>
            <button
              type="button"
              className={`v279-insight-card trend ${insightIndex === 1 ? "is-front" : "is-back"}`}
              onClick={() => {
                if (insightSwipe.current.moved) {
                  insightSwipe.current.moved = false;
                  return;
                }
                go({ name: "utility", kind: "ability" });
              }}
            >
              <header>
                <h3>
                  <Sparkles size={17} />
                  能力变化趋势
                </h3>
                <span>
                  点击查看详情
                  <ChevronRight size={16} />
                </span>
              </header>
              {runtime?<div className="v279-trend-body"><div><b>{runtime.snapshot?.objects.memory.filter(item=>item.data.status==='validated').length||0}</b><p>本人确认的理解</p><span>跨时间稳定性尚未验证</span><em>可在记忆库查看依据与修正</em></div></div>:<div className="v279-trend-body">
                <svg viewBox="0 0 180 144" aria-label="能力变化趋势图">
                  <line x1="12" y1="120" x2="170" y2="120" />
                  <line x1="12" y1="78" x2="170" y2="78" />
                  <line x1="12" y1="36" x2="170" y2="36" />
                  <path
                    className="area"
                    d="M12 112 C34 102 48 97 66 86 S101 79 120 63 S147 57 168 28 L168 120 L12 120Z"
                  />
                  <path
                    className="line"
                    d="M12 112 C34 102 48 97 66 86 S101 79 120 63 S147 57 168 28"
                  />
                  <circle cx="168" cy="28" r="4" />
                  <text x="12" y="139">
                    第 1 周
                  </text>
                  <text x="142" y="139">
                    第 6 周
                  </text>
                </svg>
                <div>
                  <b>
                    +12<small>/100</small>
                  </b>
                  <p>成长指数</p>
                  <span>6 周提升</span>
                  <em>连续 4 周保持增长</em>
                </div>
              </div>}
            </button>
            <nav className="v278-insight-dots" aria-label="切换能力洞察">
              {[0, 1].map((index) => (
                <button
                  type="button"
                  key={index}
                  aria-label={`第 ${index + 1} 张能力洞察`}
                  className={insightIndex === index ? "active" : ""}
                  onClick={() => setInsightIndex(index)}
                />
              ))}
            </nav>
          </div>
        </section>
      </div>
      {alignmentOpen && (
        <AlignmentModal go={go} onClose={() => setAlignmentOpen(false)} />
      )}
      {selectedCapability && (
        <CapabilityDetailSheet
          card={selectedCapability}
          go={go}
          onClose={() => setSelectedCapability(null)}
        />
      )}
    </main>
  );
}
