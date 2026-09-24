"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ProductProvider, useProduct } from "./product-state";
import { Onboarding } from "./onboarding";
import { DeviceFrame } from "./device-frame";
import { AgentHome } from "./agent-home";
import V277App from "./v27-7-app";
import {
  Archive,
  ArrowLeft,
  ArrowUpRight,
  Bot,
  Box,
  Bookmark,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Compass,
  Crown,
  FileText,
  Flame,
  FolderKanban,
  Library,
  ListChecks,
  GripVertical,
  Pause,
  Play,
  Palette,
  PenTool,
  TrendingUp,
  Code2,
  GraduationCap,
  Gem,
  Globe2,
  Bell,
  Heart,
  Home as HomeIcon,
  Image as ImageIcon,
  Share2,
  Eye,
  MapPin,
  Maximize2,
  MessageCircle,
  MoreHorizontal,
  Network,
  LockKeyhole,
  LogOut,
  Paperclip,
  Plus,
  Search,
  Send,
  Link2,
  Settings2,
  SlidersHorizontal,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trophy,
  Trash2,
  Users,
  Video,
  WandSparkles,
  WalletCards,
  X,
  Zap,
} from "lucide-react";

type Tab = "knowledge" | "a2a" | "messages" | "profile";

type Asset = { name: string; type: string; tags: string; calls: number; status: string; level?: number; score?: number; stage?: "发现" | "有证据" | "已验证" | "可靠复用" | "稳定交付" };
type TaskItem = { id: string; hot: boolean; title: string; format: string; time: string; match: number; remain: string; skills: string[]; point: string; whyNow: string; gap: string; resource: string };
type TopicItem = { title: string; heat: number; replies: number; author: string; preview: string };
type Conversation = { type: string; name: string; message: string; time: string; unread: number; tone: string };
type AgentRunState = "idle" | "scouting" | "decision" | "accepted" | "done";
type GoldenProject = { id: string; title: string; progress: number; state: "active" | "done"; next: string; owner: string; sourceTaskId: string };
type DetailState =
  | { kind: "asset"; asset: Asset }
  | { kind: "new-asset" }
  | { kind: "task"; task: TaskItem }
  | { kind: "topic"; topic: TopicItem }
  | { kind: "chat"; conversation: Conversation }
  | { kind: "settings" };

const assets: Asset[] = [
  { name: "用户访谈分析", type: "Skill", tags: "洞察 · 沟通", calls: 12, status: "已上架", level: 4, score: 91, stage: "稳定交付" },
  { name: "品牌策略工作坊", type: "Mini App", tags: "策略 · 创造", calls: 8, status: "已上架", level: 3, score: 86, stage: "可靠复用" },
  { name: "文案撰写", type: "Skill", tags: "创造 · 沟通", calls: 3, status: "草稿", level: 2, score: 74, stage: "有证据" },
  { name: "GTM 研究助手", type: "Agent", tags: "研究 · 执行", calls: 6, status: "已上架", level: 3, score: 88, stage: "已验证" },
  { name: "共创访谈记录", type: "原始", tags: "上下文 · 7月", calls: 0, status: "已归档", level: 1, score: 62, stage: "有证据" },
];

const filters = ["全部", "Skill", "Mini App", "Agent"];

function AssetIcon({ type }: { type: string }) {
  const Icon = type === "Mini App" ? Box : type === "Agent" ? Bot : type === "原始" ? Archive : Zap;
  return (
    <span className={`asset-icon asset-icon--${type.toLowerCase().replace(" ", "-")}`}>
      <Icon size={19} strokeWidth={1.7} />
    </span>
  );
}

function AlignmentLevel({ onClick }: { onClick?: () => void }) {
  return (
    <button className="header-alignment" onClick={onClick} aria-label="查看等级与对齐率">
      <span className="alignment-avatar">H</span>
      <span className="alignment-copy">
        <span><b>对齐率 86%</b><strong>Lv.4</strong></span>
        <i><b /></i>
      </span>
    </button>
  );
}

function LibraryHeader({ active, onKnowledge, onMemory, onLevel }: { active: "knowledge" | "memory"; onKnowledge: () => void; onMemory: () => void; onLevel: () => void }) {
  return (
    <header className="topbar knowledge-topbar library-topbar">
      <nav className="library-switch" aria-label="知识与记忆">
        <button className={active === "knowledge" ? "active" : ""} aria-current={active === "knowledge" ? "page" : undefined} onClick={onKnowledge}>知识库</button>
        <button className={active === "memory" ? "active" : ""} aria-current={active === "memory" ? "page" : undefined} onClick={onMemory}>记忆库</button>
      </nav>
      <AlignmentLevel onClick={onLevel} />
    </header>
  );
}

function LevelCenter({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"level" | "honor">("level");
  const [selectedHonor, setSelectedHonor] = useState<string | null>(null);
  const honors = [
    { title: "洞察先锋", desc: "完成 10 次访谈分析", icon: Target, unlocked: true, progress: 100 },
    { title: "可靠交付", desc: "连续完成 6 次交付", icon: ShieldCheck, unlocked: true, progress: 100 },
    { title: "能力觉醒", desc: "首个 Skill 达到 Lv.4", icon: Sparkles, unlocked: true, progress: 100 },
    { title: "共创之星", desc: "参与 3 个协作项目", icon: Star, unlocked: true, progress: 100 },
    { title: "持续交付", desc: "完成 10 次可验证交付", icon: Flame, unlocked: false, progress: 32 },
    { title: "跨域复用", desc: "能力在 3 个新场景被验证", icon: Trophy, unlocked: false, progress: 82 },
    { title: "机会推进", desc: "推进 8 个 A2A 机会进入真实协作", icon: Compass, unlocked: false, progress: 55 },
    { title: "协作领航", desc: "建立 8 个长期协作关系", icon: Users, unlocked: false, progress: 38 },
  ];
  const activeHonor = honors.find((honor) => honor.title === selectedHonor);
  return (
    <div className="page-modal-backdrop" role="dialog" aria-modal="true" aria-label="等级与荣誉">
      <section className="level-center-sheet">
        <header className="modal-sheet-head"><div><span>PERSONAL PROGRESS</span><h2>{tab === "level" ? "等级成长" : "荣誉勋章"}</h2></div><button onClick={onClose} aria-label="关闭等级页面"><X size={19}/></button></header>
        <div className="modal-tabs"><button className={tab === "level" ? "active" : ""} onClick={() => setTab("level")}><Trophy size={15}/>等级</button><button className={tab === "honor" ? "active" : ""} onClick={() => setTab("honor")}><Star size={15}/>荣誉勋章</button></div>
        {tab === "level" ? <div className="level-panel">
          <div className="level-emblem"><span><Sparkles size={25}/></span><div><small>当前能力阶段</small><strong>Lv.4</strong><b>可靠复用</b></div></div>
          <div className="level-progress-card"><span><b>真实验证进度</b><strong>8 / 10</strong></span><div><i style={{width:"80%"}}/></div><p>再完成 2 次真实 Outcome 验证，即可进入「稳定交付」</p></div>
          <div className="level-metrics"><div><b>18</b><span>有效 Evidence</span></div><div><b>12</b><span>真实交付</span></div><div><b>4</b><span>长期协作</span></div></div>
          <section className="level-roadmap"><h3>真实能力路径</h3>{[["Lv.5","稳定交付","2 次 Outcome"],["Lv.6","跨场景复用","3 个新场景"],["Lv.7","领域可信","持续外部验证"]].map(([level,title,xp],index)=><div key={level} className={index === 0 ? "next" : ""}><span>{level}</span><div><strong>{title}</strong><small>{xp}</small></div><i>{index === 0 ? "下一阶段" : "待验证"}</i></div>)}</section>
        </div> : <div className="honor-panel">
          <div className="honor-summary"><span><Trophy size={22}/></span><div><strong>4 / 8</strong><small>已获得荣誉</small></div><b>真实验证 18</b></div>
          <div className="honor-collection" aria-label="荣誉勋章收藏">
            {honors.map(({title,icon:Icon,unlocked})=><button className={`honor-badge ${unlocked ? "unlocked" : "locked"}`} key={title} onClick={() => setSelectedHonor(title)} aria-label={`查看荣誉勋章 ${title}`}><span><Icon size={25}/></span><strong>{title}</strong><small>{unlocked ? "已获得" : "待解锁"}</small></button>)}
          </div>
          {activeHonor && (() => { const HonorIcon = activeHonor.icon; return <div className="honor-detail-card"><button onClick={() => setSelectedHonor(null)} aria-label="关闭勋章详情"><X size={15}/></button><span className={activeHonor.unlocked ? "unlocked" : "locked"}><HonorIcon size={28}/></span><div><small>{activeHonor.unlocked ? "已收藏勋章" : "解锁进度"}</small><strong>{activeHonor.title}</strong><p>{activeHonor.desc}</p><i><b style={{width:`${activeHonor.progress}%`}}/></i><em>{activeHonor.progress}%</em></div></div>; })()}
          <p className="honor-note">完成真实行动、升级能力卡与持续交付，都会解锁新的荣誉。</p>
        </div>}
      </section>
    </div>
  );
}

function InsightDetail({ kind, onClose }: { kind: "radar" | "growth"; onClose: () => void }) {
  return (
    <div className="page-modal-backdrop" role="dialog" aria-modal="true" aria-label={kind === "radar" ? "能力雷达详情" : "成长曲线详情"}>
      <section className="insight-detail-sheet">
        <header className="modal-sheet-head"><div><span>ELFRED INSIGHT</span><h2>{kind === "radar" ? "能力雷达详情" : "成长曲线详情"}</h2></div><button onClick={onClose} aria-label="关闭能力详情"><X size={19}/></button></header>
        {kind === "radar" ? <>
          <div className="detail-radar-card"><svg className="ability-radar" viewBox="0 0 190 165" role="img" aria-label="能力雷达详情"><g className="radar-grid"><polygon points="95,13 169,67 141,151 49,151 21,67"/><polygon points="95,38 145,75 126,131 64,131 45,75"/><polygon points="95,63 121,82 111,111 79,111 69,82"/><line x1="95" y1="82" x2="95" y2="13"/><line x1="95" y1="82" x2="169" y2="67"/><line x1="95" y1="82" x2="141" y2="151"/><line x1="95" y1="82" x2="49" y2="151"/><line x1="95" y1="82" x2="21" y2="67"/></g><polygon className="radar-shape" points="95,20 156,70 132,138 61,133 31,69"/><g className="radar-labels"><text x="95" y="9">策略 91</text><text x="174" y="69">洞察 88</text><text x="148" y="160">执行 76</text><text x="43" y="160">创造 84</text><text x="16" y="69">沟通 87</text></g></svg><div><strong>82</strong><span>综合能力</span><b>5 个 Outcome</b><small>3 次外部验证</small></div></div>
          <section className="insight-detail-list"><h3>五维能力构成</h3>{[["策略",91],["洞察",88],["执行",76],["创造",84],["沟通",87]].map(([name,value])=><div key={name}><span><b>{name}</b><i>{value}</i></span><em><i style={{width:`${value}%`}}/></em></div>)}</section>
          <section className="insight-advice"><Sparkles size={17}/><div><strong>Elfred 建议</strong><p>你的策略与洞察最突出。下一阶段优先提升执行稳定性，可让综合能力提升约 5 分。</p></div></section>
        </> : <>
          <div className="detail-growth-card"><span><strong>+18.6%</strong><small>近 30 天能力净增长</small></span><svg className="fixed-growth-chart" viewBox="0 0 330 92" role="img" aria-label="成长曲线详情"><path className="fixed-growth-area" d="M4 77 C31 71 42 57 69 62 S113 69 137 46 S184 54 210 30 S257 36 285 17 S313 19 326 8 L326 92 L4 92 Z"/><path className="fixed-growth-line" d="M4 77 C31 71 42 57 69 62 S113 69 137 46 S184 54 210 30 S257 36 285 17 S313 19 326 8"/><circle cx="326" cy="8" r="4"/></svg></div>
          <div className="growth-detail-stats"><div><b>3</b><span>新增 Evidence</span></div><div><b>6</b><span>完成 Outcome</span></div><div><b>2</b><span>稳定复用</span></div></div>
          <section className="growth-milestones"><h3>成长里程碑</h3>{[["今天","访谈分析完成真实验证","Evidence +1"],["7月29日","品牌策略 Outcome 被接受","验证 +1"],["7月21日","建立长期协作关系","关系 +1"]].map(([time,title,value])=><div key={title}><span/><time>{time}</time><strong>{title}</strong><b>{value}</b></div>)}</section>
        </>}
      </section>
    </div>
  );
}

const memoryGroups = [
  { title: "基础", items: [{ title: "当前身份", text: "我是 Elfred 的产品负责人，正在把 Personal Agent 做成一个能帮助用户发现机会并完成价值交付的产品。", meta: "9 条基础信息" }] },
  { title: "社交", items: [{ title: "关键关系", text: "我优先寻找懂技术实现、产品增长和品牌营销的长期共创伙伴。", meta: "17 条关系记忆" }] },
  { title: "近况", items: [{ title: "当前焦点", text: "现阶段最重要的是完成可用产品、验证首批真实用户，并形成能够被复用的交付案例。", meta: "6 条近期动态" }] },
  { title: "习惯", items: [{ title: "工作习惯", text: "我重视团队协作中的务实执行，希望讨论最终都能沉淀为明确的下一步行动。", meta: "12 条行为证据" }] },
  { title: "偏好", items: [{ title: "产品偏好", text: "我偏好简约、卡片式和可直接操作的产品，不希望页面堆积过多解释性内容。", meta: "15 条偏好证据" }] },
  { title: "口吻", items: [{ title: "表达方式", text: "表达需要直接、简洁、有判断，先讲结论，再补充必要的理由与行动。", meta: "11 条表达证据" }] },
  { title: "内在", items: [
    { title: "边界底线", text: "我不接受只说不做，重要决策需要基于真实反馈，并对最终结果负责。", meta: "8 条长期记忆" },
    { title: "领域见解", text: "Personal Agent 的入口是用户想完成的事；上下文和记忆应当在后台持续发挥作用。", meta: "21 条认知沉淀" },
  ] },
];

function MemoryHub({ onBack }: { onBack: () => void }) {
  const [filter, setFilter] = useState("全部");
  const [levelOpen, setLevelOpen] = useState(false);
  const [overviewExpanded, setOverviewExpanded] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState<{ group: string; title: string; text: string; meta: string } | null>(null);
  const memoryFilters = ["全部", "基础", "社交", "近况", "习惯", "偏好", "口吻", "内在"];

  if (selectedMemory) {
    return (
      <div className="screen-content memory-detail-page">
        <header className="memory-detail-head">
          <button className="icon-button" onClick={() => setSelectedMemory(null)} aria-label="返回记忆库"><ArrowLeft size={19}/></button>
          <div><small>{selectedMemory.group}</small><h1>{selectedMemory.title}</h1></div>
        </header>
        <section className="memory-detail-card">
          <span><Sparkles size={15}/><strong>Elfred 当前记忆</strong></span>
          <p>{selectedMemory.text}</p>
          <div><span><b>{selectedMemory.meta}</b><small>记忆数量</small></span><span><b>94%</b><small>可信度</small></span><span><b>今天</b><small>最近更新</small></span></div>
        </section>
        <section className="memory-detail-use"><ShieldCheck size={17}/><div><strong>使用范围</strong><p>用于机会推荐和 Agent 判断；你可以随时返回修改或纠正。</p></div></section>
      </div>
    );
  }

  return (
    <div className="screen-content memory-page">
      <div className="memory-sticky-top">
        <LibraryHeader active="memory" onKnowledge={onBack} onMemory={() => undefined} onLevel={() => setLevelOpen(true)}/>
        <div className="memory-filter" aria-label="记忆分类">
          {memoryFilters.map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}
        </div>
      </div>

      <section className="memory-overview">
        <div className="memory-overview-head"><span><Sparkles size={14} />Elfred 对你的当前理解</span><button onClick={() => setOverviewExpanded((value) => !value)}>{overviewExpanded ? "收起" : "展开"}</button></div>
        <p className={overviewExpanded ? "" : "is-clamped"}>我希望通过持续获得更强的产品洞察，结识技术与营销方面的关键人才，推动创业产品真正落地。</p>
        <div><span><b>128</b> 条有效记忆</span><span><b>7</b> 天持续更新</span></div>
      </section>

      <div className="memory-groups">
        {memoryGroups.filter((group) => filter === "全部" || filter === group.title).map((group) => (
          <section className="memory-group" key={group.title}>
            <h2>{group.title}</h2>
            <div className="memory-card-stack">
              {group.items.map((item) => (
                <button className="memory-card" key={item.title} onClick={() => setSelectedMemory({ group: group.title, ...item })}>
                  <span><strong>{item.title}</strong><ChevronRight size={17} /></span>
                  <p>{item.text}</p>
                  <small>{item.meta} · 可信 94% · 今天更新</small>
                  <em className="memory-usage"><ShieldCheck size={11}/>用于机会推荐，可随时纠正</em>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <p className="memory-end">— ELFR​ED MEMORY —</p>
      {levelOpen && <LevelCenter onClose={() => setLevelOpen(false)}/>}
    </div>
  );
}

function RepositoryHub({ items, onBack, onOpen }: { items: Asset[]; onBack: () => void; onOpen: (asset: Asset) => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("全部");
  const repositoryFilters = ["全部", "Skill", "Mini App", "Agent", "原始"];
  const visibleItems = items.filter((item) => (filter === "全部" || item.type === filter) && `${item.name}${item.tags}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="screen-content repository-page">
    <header className="repository-head"><button className="icon-button" onClick={onBack} aria-label="返回知识库"><ArrowLeft size={19}/></button><div><small>ELFRED REPOSITORY</small><h1>全部仓库</h1></div><span>{items.length}</span></header>
    <label className="repository-search"><Search size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="检索能力、应用、Agent 或原始资料" aria-label="检索全部仓库"/></label>
    <div className="repository-summary"><div><Library size={17}/><span><b>{items.filter((item)=>item.type!=="原始").length}</b><small>能力资产</small></span></div><div><Archive size={17}/><span><b>{items.filter((item)=>item.type==="原始").length}</b><small>原始资料</small></span></div><div><Sparkles size={17}/><span><b>86%</b><small>对齐率</small></span></div></div>
    <div className="repository-filters">{repositoryFilters.map((item)=><button key={item} className={filter===item?"active":""} onClick={()=>setFilter(item)}>{item}</button>)}</div>
    <div className="repository-list">{visibleItems.map((item)=><button key={item.name} onClick={()=>onOpen(item)}><AssetIcon type={item.type}/><span><small>{item.type} · Lv.{item.level ?? 1}</small><strong>{item.name}</strong><em>{item.tags}</em></span><b>{item.score ?? 62}</b><ChevronRight size={16}/></button>)}</div>
    {!visibleItems.length && <div className="repository-empty"><Search size={25}/><strong>没有找到相关内容</strong><span>换个关键词或分类试试</span></div>}
  </div>;
}

function Knowledge({ items, onOpen, onGenerate }: { items: Asset[]; onOpen: (asset: Asset) => void; onGenerate: () => void }) {
  const [filter, setFilter] = useState("全部");
  const [panel, setPanel] = useState<"knowledge" | "memory">("knowledge");
  const [notice, setNotice] = useState("");
  const [levelOpen, setLevelOpen] = useState(false);
  const [insightDetail, setInsightDetail] = useState<"radar" | "growth" | null>(null);
  const [capabilityIndex, setCapabilityIndex] = useState(0);
  const [deckDot, setDeckDot] = useState(0);
  const [warehouseOpen, setWarehouseOpen] = useState(false);
  const swipeStart = useRef(0);
  const deckRef = useRef<HTMLDivElement>(null);
  const deckItems = useMemo(() => items.filter((item) => item.type !== "原始"), [items]);
  const filtered = useMemo(() => (filter === "全部" ? deckItems : deckItems.filter((item) => item.type === filter)), [filter, deckItems]);

  if (panel === "memory") return <MemoryHub onBack={() => setPanel("knowledge")} />;
  if (warehouseOpen) return <RepositoryHub items={items} onBack={() => setWarehouseOpen(false)} onOpen={onOpen}/>;

  return (
    <div className="screen-content knowledge-page">
      <div className="sticky-knowledge-bar"><LibraryHeader active="knowledge" onKnowledge={() => undefined} onMemory={() => setPanel("memory")} onLevel={() => setLevelOpen(true)}/></div>

      <section className="deck-section">
        <div className="deck-heading">
          <div className="compact-section-title"><Library size={15}/><strong>能力卡组</strong></div>
          <div className="deck-tools"><button onClick={onGenerate} aria-label="一键检索生成技能" title="一键检索生成技能"><WandSparkles size={16}/></button><button onClick={() => setWarehouseOpen(true)} aria-label="打开全部仓库" title="全部仓库"><ChevronRight size={17}/></button></div>
        </div>
        <div className="deck-filters" aria-label="能力资产分类">
          {filters.map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}
        </div>
        <div className="asset-deck" ref={deckRef} aria-label="左右滑动浏览能力资产" onScroll={(event) => { const element = event.currentTarget; const maximum = Math.max(1, element.scrollWidth - element.clientWidth); setDeckDot(Math.min(2, Math.round(element.scrollLeft / maximum * 2))); }}>
          {filtered.map((item) => {
            const typeClass = item.type.toLowerCase().replaceAll(" ", "-");
            return (
              <button className={`deck-card deck-card--${typeClass}`} key={item.name} onClick={() => onOpen(item)}>
                <span className="deck-card-top"><b>Lv.{item.level ?? 1} · {item.stage ?? "有证据"}</b><MoreHorizontal size={17}/></span>
                <AssetIcon type={item.type}/>
                <span className="deck-type">{item.type}</span>
                <strong>{item.name}</strong>
                <small>{item.tags}</small>
                <span className="deck-score"><b>{item.score ?? 62}</b><em>评分</em><i>{Math.max(2, Math.ceil(item.calls / 3))} 条 Evidence</i></span>
                <span className="deck-customize"><ShieldCheck size={12}/>由真实结果验证</span>
              </button>
            );
          })}
        </div>
        <div className="deck-pagination" aria-label="能力卡片浏览位置">{[0, 1, 2].map((dot) => <span className={deckDot === dot ? "active" : ""} key={dot}/>)}</div>
      </section>

      <section className="knowledge-evidence-bridge" aria-label="今天吸收的新证据">
        <div className="knowledge-bridge-head"><span><Sparkles size={14}/><strong>今天的新证据</strong></span><button onClick={() => setWarehouseOpen(true)}>查看全部 <ChevronRight size={13}/></button></div>
        <div className="knowledge-bridge-row">
          <button onClick={() => setNotice("已打开「用户访谈」的 Evidence 证据链")}><span className="evidence-dot verified"><Check size={12}/></span><span><strong>用户访谈</strong><small>1 条 Outcome 已验证</small></span><b>+1</b></button>
          <button onClick={() => setNotice("已打开「品牌策略」的 Evidence 证据链")}><span className="evidence-dot fresh"><Sparkles size={12}/></span><span><strong>品牌策略</strong><small>2 条上下文已吸收</small></span><b>+2</b></button>
        </div>
      </section>

      <section className="fixed-insights compact-insights">
        <div className="fixed-insights-heading"><div className="compact-section-title"><Target size={15}/><strong>能力洞察</strong></div><div className="insight-view-toggle" role="tablist" aria-label="能力洞察视图"><button className={capabilityIndex === 0 ? "active" : ""} onClick={() => setCapabilityIndex(0)}>雷达</button><button className={capabilityIndex === 1 ? "active" : ""} onClick={() => setCapabilityIndex(1)}>趋势</button></div></div>
        <div className="insight-stack" aria-label="能力雷达与成长曲线，上下滑动切换" onWheel={(event) => setCapabilityIndex(event.deltaY > 0 ? 1 : 0)} onTouchStart={(event) => { swipeStart.current = event.touches[0].clientY; }} onTouchEnd={(event) => { const delta = event.changedTouches[0].clientY - swipeStart.current; if (Math.abs(delta) > 28) setCapabilityIndex(delta < 0 ? 1 : 0); }}>
          <button className={`insight-card radar-insight insight-stack-card ${capabilityIndex === 0 ? "is-active" : "is-back"}`} onClick={() => setInsightDetail("radar")}>
            <span className="insight-head"><span><Target size={14}/>能力雷达</span><em>点击查看详情</em><ChevronRight size={15}/></span>
            <span className="radar-layout"><span className="radar-chart-wrap"><svg className="ability-radar" viewBox="0 0 190 165" role="img" aria-label="策略、洞察、执行、创造和沟通能力雷达图"><g className="radar-grid"><polygon points="95,13 169,67 141,151 49,151 21,67"/><polygon points="95,38 145,75 126,131 64,131 45,75"/><polygon points="95,63 121,82 111,111 79,111 69,82"/><line x1="95" y1="82" x2="95" y2="13"/><line x1="95" y1="82" x2="169" y2="67"/><line x1="95" y1="82" x2="141" y2="151"/><line x1="95" y1="82" x2="49" y2="151"/><line x1="95" y1="82" x2="21" y2="67"/></g><polygon className="radar-shape" points="95,20 156,70 132,138 61,133 31,69"/><g className="radar-labels"><text x="95" y="9">策略 91</text><text x="174" y="69">洞察 88</text><text x="148" y="160">执行 76</text><text x="43" y="160">创造 84</text><text x="16" y="69">沟通 87</text></g></svg></span><span className="radar-summary"><span><strong>82</strong><small>/ 100</small></span><em>综合能力</em><b>5 个 Outcome</b><small>3 次外部验证 · 可追溯</small></span></span>
          </button>
          <button className={`insight-card growth-insight insight-stack-card ${capabilityIndex === 1 ? "is-active" : "is-back"}`} onClick={() => setInsightDetail("growth")}>
            <span className="insight-head"><span><ArrowUpRight size={14}/>成长曲线</span><em>点击查看详情</em><ChevronRight size={15}/></span>
            <span className="growth-fixed-top"><span><strong>+18.6%</strong><small>近 30 天</small></span><i>持续上升</i></span>
            <svg className="fixed-growth-chart" viewBox="0 0 330 92" role="img" aria-label="近30天能力成长曲线"><path className="fixed-growth-area" d="M4 77 C31 71 42 57 69 62 S113 69 137 46 S184 54 210 30 S257 36 285 17 S313 19 326 8 L326 92 L4 92 Z"/><path className="fixed-growth-line" d="M4 77 C31 71 42 57 69 62 S113 69 137 46 S184 54 210 30 S257 36 285 17 S313 19 326 8"/><circle cx="326" cy="8" r="4"/></svg>
            <span className="fixed-growth-stats"><span><b>3</b><small>新增 Evidence</small></span><span><b>6</b><small>完成 Outcome</small></span><span><b>2</b><small>稳定复用</small></span></span>
          </button>
        </div>
      </section>

      {levelOpen && <LevelCenter onClose={() => setLevelOpen(false)}/>}
      {insightDetail && <InsightDetail kind={insightDetail} onClose={() => setInsightDetail(null)}/>}
      {notice && <button className="toast" onClick={() => setNotice("")}>{notice}</button>}
    </div>
  );
}

const taskFeed = [
  { id: "opp-brand-vi", hot: true, title: "品牌 VI 策略共创", format: "远程协作", time: "本周约 4h", match: 92, remain: "今天更新", skills: ["品牌策略", "用户洞察"], point: "你的品牌策略能力有 3 条强 Evidence", whyNow: "你本周正在验证品牌策略能力，且周四下午有可用时间。", gap: "视觉执行能力不足", resource: "Yiming 的 PA 可以补位" },
  { id: "opp-user-research", hot: false, title: "AI 产品首批用户访谈", format: "深度访谈", time: "约 3h", match: 87, remain: "2 天内", skills: ["用户访谈", "需求分析"], point: "你已完成 12 次访谈分析，最近一次验证在今天", whyNow: "这次任务能补充一条真实交付证据，并强化用户研究能力。", gap: "需要确认受访者招募边界", resource: "Elfred 可先整理访谈提纲" },
  { id: "opp-gtm", hot: false, title: "出海产品 GTM 策略共创", format: "多人共创", time: "约 6h", match: 78, remain: "正在组队", skills: ["GTM", "市场研究"], point: "这是一个相邻能力探索机会", whyNow: "与你当前的产品增长目标有关，但不需要立刻承诺。", gap: "海外渠道经验不足", resource: "已有 1 位渠道伙伴可协作" },
];

const bountyTaskFeed: TaskItem[] = [
  { id: "fde-growth-audit", hot: true, title: "消费品牌增长诊断与 30 天落地", format: "企业 FDE", time: "7 天交付", match: 94, remain: "剩余 18 小时", skills: ["限时", "高额", "长 SOP"], point: "为成长期消费品牌完成渠道诊断、增长实验设计与首轮落地。", whyNow: "企业希望在本周完成诊断，并立即进入第一轮增长实验。", gap: "需要补充渠道后台数据权限", resource: "Elfred 已拆分为 8 个 SOP 阶段" },
  { id: "fde-ai-workflow", hot: true, title: "AI 客服工作流重构与上线陪跑", format: "企业 FDE", time: "14 天交付", match: 91, remain: "剩余 1 天", skills: ["限时", "高额", "长 SOP"], point: "梳理 120 条真实工单，搭建可交付的 AI 客服工作流并陪跑上线。", whyNow: "客户正在切换客服系统，需要在迁移窗口期同步完成自动化改造。", gap: "需确认历史工单脱敏方案", resource: "Elfred 已准备 10 步交付清单" },
  { id: "fde-overseas-launch", hot: false, title: "SaaS 出海首站市场进入方案", format: "企业 FDE", time: "21 天交付", match: 86, remain: "剩余 3 天", skills: ["高额", "长 SOP", "多人协作"], point: "从市场筛选、用户访谈到首批渠道验证，形成可执行的市场进入方案。", whyNow: "企业已完成英文产品版本，需要快速选择首个海外验证市场。", gap: "当地渠道伙伴仍待确认", resource: "可调用 GTM Agent 与出海合规群组" },
];

const topicFeed = [
  { title: "如何用 AI 提升用户调研效率？", heat: 234, replies: 45, author: "@Harisen", preview: "我把最近三次访谈工作流做成了一个 Skill…" },
  { title: "Personal Agent 最适合从哪类任务切入？", heat: 186, replies: 31, author: "@一鸣", preview: "从高频触发看，用户主动想起它的时刻需要更聚焦。" },
  { title: "本周值得关注的 5 个 AI 原生产品", heat: 98, replies: 19, author: "@Elfred Lab", preview: "不是功能清单，而是五种不同的交互范式。" },
];

type A2AUtility = "scan" | "search" | "publish" | "match" | "collab" | "saved";

function A2AUtilitySheet({ kind, savedCount, onClose }: { kind: A2AUtility; savedCount: number; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [done, setDone] = useState(false);
  const title = kind === "scan" ? "机会雷达" : kind === "search" ? "搜索 A2A" : kind === "publish" ? "发布需求" : kind === "match" ? "智能匹配" : kind === "collab" ? "我的协作" : "已收藏";
  return <div className="page-modal-backdrop a2a-utility-backdrop" role="dialog" aria-modal="true" aria-label={title}>
    <section className="a2a-utility-sheet">
      <header className="modal-sheet-head"><div><span>A2A NETWORK</span><h2>{title}</h2></div><button onClick={onClose} aria-label={`关闭${title}`}><X size={19}/></button></header>
      {kind === "scan" && <><div className="network-scan-visual"><span><Compass size={24}/></span><i/><i/><i/></div><div className="utility-stat-grid"><span><b>6</b><small>新变化</small></span><span><b>2</b><small>值得行动</small></span><span><b>3</b><small>值得观察</small></span></div><div className="utility-list"><button onClick={()=>setDone(true)}><Target size={16}/><span><strong>品牌策略协作正在形成</strong><small>与你的 3 条强 Evidence 相关</small></span><ChevronRight size={15}/></button><button onClick={()=>setDone(true)}><Sparkles size={16}/><span><strong>用户研究出现新需求</strong><small>可补充一条真实交付证据</small></span><ChevronRight size={15}/></button></div></>}
      {kind === "search" && <><label className="utility-search"><Search size={17}/><input autoFocus value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="搜索需求、PA、话题或能力"/></label><div className="utility-suggestions"><small>试试搜索</small>{["AI 产品访谈","品牌策略","Personal Agent"].filter((x)=>!query || x.toLowerCase().includes(query.toLowerCase())).map((x)=><button key={x} onClick={()=>setQuery(x)}>{x}<ChevronRight size={14}/></button>)}</div></>}
      {kind === "publish" && <><div className="publish-helper"><Sparkles size={17}/><span><strong>先说你想完成什么</strong><small>Elfred 会自动补齐能力、时间和协作边界。</small></span></div><textarea className="utility-textarea" value={draft} onChange={(e)=>setDraft(e.target.value)} placeholder="例如：我想找一个懂 AI 产品的设计师，一起完成移动端改版…"/><button className="utility-primary" disabled={!draft.trim() || done} onClick={()=>setDone(true)}>{done ? <><Check size={16}/>已生成需求草稿</> : <><Sparkles size={16}/>让 Elfred 整理需求</>}</button></>}
      {kind === "match" && <><div className="utility-callout"><Target size={18}/><span><strong>匹配不是一个百分比</strong><small>Elfred 会同时看能力证据、时间、缺口与可调用关系。</small></span></div><div className="match-dimensions">{[["能力证据",92],["时间可用",78],["协作关系",84],["未知风险",36]].map(([name,value])=><div key={name}><span><b>{name}</b><small>{value}</small></span><i><b style={{width:`${value}%`}}/></i></div>)}</div></>}
      {kind === "collab" && <div className="utility-list people">{[["Emily 的 PA","等待你确认协作"],["Yiming 的 PA","可补位视觉执行"],["品牌设计项目组","3 人正在推进"]].map(([name,desc],i)=><button key={name} onClick={()=>setDone(true)}><span className="utility-avatar">{i===2?<Users size={16}/>:<Bot size={16}/>}</span><span><strong>{name}</strong><small>{desc}</small></span><ChevronRight size={15}/></button>)}</div>}
      {kind === "saved" && <><div className="utility-callout"><Bookmark size={18}/><span><strong>{savedCount || 2} 个待观察机会</strong><small>收藏不会产生承诺，Elfred 会继续追踪变化。</small></span></div><div className="utility-list"><button onClick={()=>setDone(true)}><Sparkles size={16}/><span><strong>出海产品 GTM 策略共创</strong><small>相邻能力 · 继续观察</small></span><ChevronRight size={15}/></button><button onClick={()=>setDone(true)}><Target size={16}/><span><strong>AI 产品首批用户访谈</strong><small>证据相关 · 2 天内</small></span><ChevronRight size={15}/></button></div></>}
      {done && kind !== "publish" && <p className="utility-feedback"><Check size={13}/>已打开相关详情，Elfred 会继续保留这条上下文。</p>}
    </section>
  </div>;
}

type OpportunityMarket = { name: string; icon: typeof Box; note: string; tone: string; unlocked: boolean; price?: number };
type MarketOverlay = "economy" | "map" | "agents" | "mode" | "report" | null;

function TodayReportSheet({ onClose, onReview }: { onClose: () => void; onReview: () => void }) {
  return <div className="page-modal-backdrop market-sheet-backdrop" role="dialog" aria-modal="true" aria-label="今日战报">
    <section className="market-sheet report-sheet">
      <header className="market-sheet-head"><div><small>DAILY BRIEF</small><h2>今日战报</h2></div><button onClick={onClose} aria-label="关闭今日战报"><X size={19}/></button></header>
      <div className="report-hero"><span><Sparkles size={22}/></span><div><small>Elfred 离开后持续侦察</small><strong>今天只需要你处理 3 个决定</strong><p>其余变化已自动归档，不会占用你的注意力。</p></div></div>
      <div className="report-metrics"><span><b>18</b><small>新机会</small></span><span><b>9</b><small>新关系</small></span><span><b>4</b><small>新话题</small></span></div>
      <div className="report-decisions">
        <button onClick={onReview}><i className="urgent"/><span><small>优先决定</small><strong>品牌 VI 策略共创</strong></span><b>92%</b><ChevronRight size={15}/></button>
        <button><i/><span><small>等待确认</small><strong>Emily 的 PA</strong></span><b>今天</b><ChevronRight size={15}/></button>
        <button><i/><span><small>继续观察</small><strong>GTM 共创机会</strong></span><b>2 天</b><ChevronRight size={15}/></button>
      </div>
      <button className="market-sheet-primary" onClick={onReview}><ListChecks size={16}/>处理今天的决定</button>
    </section>
  </div>;
}

function QuickChatSheet({ name, kind, onClose, onExpand }: { name: string; kind: "group" | "person"; onClose: () => void; onExpand: () => void }) {
  const [input,setInput]=useState("");
  const [sent,setSent]=useState<string[]>([]);
  return <div className="quick-chat-backdrop" role="dialog" aria-modal="true" aria-label={`与${name}快速聊天`} onClick={onClose}>
    <section className="quick-chat-sheet" onClick={(event)=>event.stopPropagation()}>
      <span className="quick-chat-handle"/>
      <header><span className="conversation-avatar blue">{kind === "group" ? <Users size={19}/> : <CircleUserRound size={19}/>}<i/></span><div><strong>{name}</strong><small>在线 · 可由 PA 协助回复</small></div><button onClick={onExpand} aria-label="进入完整聊天"><Maximize2 size={18}/></button><button onClick={onClose} aria-label="关闭"><X size={18}/></button></header>
      <div className="quick-chat-stream"><p>{kind === "group" ? "项目资料已经同步，下一步等你确认优先级。" : "你好，我刚看到你的消息，可以先从目标和边界开始对齐。"}</p>{sent.map((item)=><p className="mine" key={item}>{item}</p>)}</div>
      <div className="quick-chat-composer"><button aria-label="添加附件"><Paperclip size={17}/></button><input value={input} onChange={(event)=>setInput(event.target.value)} placeholder="输入消息…"/><button onClick={()=>{if(input.trim()){setSent((items)=>[...items,input.trim()]);setInput("")}}}><Send size={17}/></button></div>
    </section>
  </div>;
}

function EconomySheet({ onClose }: { onClose: () => void }) {
  return <div className="page-modal-backdrop market-sheet-backdrop" role="dialog" aria-modal="true" aria-label="Elfred 虚拟经济">
    <section className="market-sheet economy-sheet"><header className="market-sheet-head"><div><small>ELFRED ECONOMY</small><h2>成长与机会资源</h2></div><button onClick={onClose}><X size={19}/></button></header>
      <div className="economy-balance"><span><Gem size={22}/></span><div><small>可用洞察积分</small><strong>1,280</strong><p>来自真实贡献与能力验证，可用于解锁新的机会市场。</p></div></div>
      <div className="economy-ledger">
        <div><span className="economy-icon energy"><Bot size={18}/></span><div><strong>Agent 执行额度</strong><small>本月深度侦察额度，属于用量而非货币</small></div><b>42 次</b></div>
        <div><span className="economy-icon credit"><ShieldCheck size={18}/></span><div><strong>可信声望</strong><small>由真实交付获得，不可购买或转让</small></div><b>86</b></div>
        <div><span className="economy-icon member"><Crown size={18}/></span><div><strong>探索会员</strong><small>解锁更多领域与高级 Agent 配额</small></div><b>体验中</b></div>
      </div>
      <section className="economy-rules"><h3>资源如何流动</h3><div><span>真实 Outcome 被验证</span><b>+ 可信声望</b></div><div><span>贡献有效 Evidence</span><b>+ 洞察积分</b></div><div><span>深度侦察一次</span><b>− 1 次执行额度</b></div><div><span>解锁新市场</span><b>− 洞察积分 / 会员</b></div></section>
    </section>
  </div>;
}

function OpportunityMap({ markets, onClose, onEnter }: { markets: OpportunityMarket[]; onClose: () => void; onEnter: (market: OpportunityMarket) => void }) {
  return <div className="page-modal-backdrop market-sheet-backdrop" role="dialog" aria-modal="true" aria-label="全局机会地图"><section className="market-sheet opportunity-map-sheet">
    <header className="market-sheet-head"><div><small>GLOBAL VIEW</small><h2>机会世界地图</h2></div><button onClick={onClose}><X size={19}/></button></header>
    <p className="map-explainer">你已拥有 3 个机会市场。Elfred 会在不同领域持续寻找人与任务。</p>
    <div className="opportunity-map"><span className="map-orbit one"/><span className="map-orbit two"/>{markets.slice(0,6).map(({name,icon:Icon,tone,unlocked,price},index)=><button key={name} className={`map-node node-${index} ${tone} ${unlocked?"":"locked"}`} onClick={()=>unlocked&&onEnter(markets[index])}><span>{unlocked?<Icon size={22}/>:<LockKeyhole size={19}/>}</span><strong>{name}</strong><small>{unlocked?"可进入":`${price} 洞察积分`}</small></button>)}</div>
    <div className="map-legend"><span><i className="open"/>已解锁 3</span><span><i/>待解锁 3</span><button><Crown size={14}/>升级探索会员</button></div>
  </section></div>;
}

function AgentLoadoutSheet({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState(["Elfred", "品牌策略"]);
  const agents = [["Elfred","默认 PA","全局理解",4],["品牌策略","领域 Agent","策略与共创",3],["用户研究","领域 Agent","访谈与洞察",3],["GTM 研究","领域 Agent","增长与市场",2],["协作谈判","高级 Agent","沟通与边界",2],["开发搭档","待解锁","工程与 AI",1]] as const;
  const toggle=(name:string)=>setSelected((items)=>items.includes(name)?items.filter((item)=>item!==name):items.length<3?[...items,name]:items);
  return <div className="page-modal-backdrop market-sheet-backdrop" role="dialog" aria-modal="true" aria-label="选择出战 Agent"><section className="market-sheet agent-loadout-sheet">
    <header className="market-sheet-head"><div><small>AGENT LOADOUT</small><h2>选择出战 Agent</h2></div><button onClick={onClose}><X size={19}/></button></header>
    <div className="loadout-summary"><WalletCards size={18}/><span><strong>{selected.length} / 3 已上阵</strong><small>进入产品市场后由这些 Agent 协同判断</small></span></div>
    <div className="agent-card-grid">{agents.map(([name,type,skill,level])=>{const locked=type==="待解锁";const active=selected.includes(name);return <button key={name} className={`${active?"selected":""} ${locked?"locked":""}`} onClick={()=>!locked&&toggle(name)}><span className="agent-card-level">Lv.{level}</span><span className="agent-card-avatar"><Bot size={24}/><i/></span><small>{type}</small><strong>{name}</strong><p>{skill}</p><em>{locked?<LockKeyhole size={13}/>:active?<Check size={14}/>:<Plus size={14}/>}</em></button>})}</div>
    <button className="market-sheet-primary" onClick={onClose}><Check size={16}/>保存出战阵容</button>
  </section></div>;
}

function AgentModeSheet({ onClose }: { onClose: () => void }) {
  const [permission,setPermission]=useState("建议模式");
  const [mission,setMission]=useState("找机会");
  return <div className="page-modal-backdrop market-sheet-backdrop" role="dialog" aria-modal="true" aria-label="Agent 模式设置"><section className="market-sheet mode-sheet">
    <header className="market-sheet-head"><div><small>AGENT AUTHORITY</small><h2>智能模式</h2></div><button onClick={onClose}><X size={19}/></button></header>
    <section><h3>授予 Agent 的权限</h3><div className="permission-options">{[["观察模式","只收集并汇报，不采取行动"],["建议模式","整理方案，关键动作由你确认"],["托管模式","在预算与边界内自动推进"]].map(([name,desc],index)=><button key={name} className={permission===name?"active":""} onClick={()=>setPermission(name)}><span>{index+1}</span><div><strong>{name}</strong><small>{desc}</small></div>{permission===name&&<Check size={16}/>}</button>)}</div></section>
    <section><h3>这次需要 Agent 做什么</h3><div className="mission-options"><button className={mission==="找机会"?"active":""} onClick={()=>setMission("找机会")}><Target size={20}/><strong>找机会</strong><small>搜索适合你的任务与需求</small></button><button className={mission==="找人"?"active":""} onClick={()=>setMission("找人")}><Users size={20}/><strong>找人</strong><small>寻找合作伙伴与潜在客户</small></button><button className={mission==="同时进行"?"active":""} onClick={()=>setMission("同时进行")}><Network size={20}/><strong>同时进行</strong><small>根据任务动态匹配人和机会</small></button></div></section>
    <button className="market-sheet-primary" onClick={onClose}><Sparkles size={16}/>应用：{permission} · {mission}</button>
  </section></div>;
}

type HomeAgent = {
  id: "explore" | "advisor" | "create" | "connect" | "execute";
  name: string;
  level: number;
  progress: number;
  summary: string;
  tasks: string[];
};

const homeAgents: HomeAgent[] = [
  { id: "explore", name: "探索", level: 4, progress: 68, summary: "持续发现与你有关的信息、趋势与新机会。", tasks: ["追踪 Personal Agent 新产品", "整理今日 AI 行业变化", "筛选值得深入的 6 条动态"] },
  { id: "advisor", name: "参谋", level: 6, progress: 100, summary: "理解你的判断标准，帮助你完成分析与取舍。", tasks: ["复盘 Elfred 首页方向", "判断本周产品优先级", "整理 2 项待确认决策"] },
  { id: "create", name: "创作", level: 5, progress: 86, summary: "学习你的表达与审美，完成内容和创意任务。", tasks: ["整理产品介绍表达", "生成首页交互说明", "学习最近确认的视觉偏好"] },
  { id: "connect", name: "连接", level: 3, progress: 46, summary: "寻找与你匹配的人、项目、活动与合作机会。", tasks: ["寻找 Agent 技术合伙人", "追踪深圳 AI 活动", "整理 3 位潜在协作者"] },
  { id: "execute", name: "执行", level: 5, progress: 82, summary: "拆解目标、维护任务，并推动项目真正完成。", tasks: ["推进移动端主页改版", "整理待确认事项", "更新本周项目进度"] },
];

function HomeAgentSheet({ agent, onClose }: { agent: HomeAgent; onClose: () => void }) {
  const [section, setSection] = useState<"tasks" | "memory" | "growth">("tasks");
  const [notice, setNotice] = useState("");
  const [chatOpen,setChatOpen]=useState(false);
  const [draft,setDraft]=useState("");
  const [messages,setMessages]=useState<string[]>([]);
  return <div className="page-modal-backdrop lowfi-sheet-backdrop" role="dialog" aria-modal="true" aria-label={`${agent.name} Agent`}>
    <section className="lowfi-agent-sheet">
      <header className="lowfi-sheet-head"><button onClick={onClose} aria-label="返回"><ArrowLeft size={20}/></button><strong>{agent.name} Agent</strong><button onClick={()=>setNotice("Agent 设置已打开")} aria-label="Agent 设置"><Settings2 size={19}/></button></header>
      <div className="lowfi-agent-hero"><span className={`lowfi-agent-shape shape-${agent.id}`}/><div><small>当前等级</small><h2>Lv.{agent.level}</h2><p>{agent.summary}</p></div></div>
      <div className="lowfi-level-track"><span><b>成长进度</b><small>{agent.progress}%</small></span><i><b style={{width:`${agent.progress}%`}}/></i><p>{agent.level >= 6 ? "已经能够理解你在这一领域的目标与偏好" : `距离“懂你”还有 ${Math.max(0,6-agent.level)} 级`}</p></div>
      <div className="lowfi-agent-tabs">{[["tasks","任务"],["memory","记忆"],["growth","养成"]].map(([id,label])=><button key={id} className={section===id?"active":""} onClick={()=>setSection(id as typeof section)}>{label}</button>)}</div>
      {section === "tasks" && <div className="lowfi-agent-task-list">{agent.tasks.map((task,index)=><button key={task} onClick={()=>setNotice(`已打开「${task}」`)}><span>{index+1}</span><div><strong>{task}</strong><small>{index===0?"正在进行":"等待处理"}</small></div><ChevronRight size={17}/></button>)}</div>}
      {section === "memory" && <div className="lowfi-memory-list">{["当前重点", "长期偏好", "最近反馈"].map((item,index)=><button key={item} onClick={()=>setNotice(`已打开${item}`)}><span/><div><strong>{item}</strong><i className={`memory-line line-${index}`}/><i/></div><ChevronRight size={17}/></button>)}</div>}
      {section === "growth" && <div className="lowfi-growth-panel"><div><strong>15级成长路径</strong><small>Lv.6 · 开始懂你</small></div><div className="lowfi-level-dots">{Array.from({length:15},(_,index)=><i key={index} className={index<agent.level?"done":index===agent.level?"next":""}>{index+1}</i>)}</div><button onClick={()=>setNotice("已查看下一等级的成长条件")}>查看升级条件</button></div>}
      {chatOpen&&<div className="lowfi-agent-chat"><div><span className={`lowfi-agent-shape shape-${agent.id}`}/><p>{messages.length?"任务已收到，我会在这个领域继续推进。":`我是${agent.name} Agent，可以直接把这个领域的任务交给我。`}</p></div>{messages.map(message=><div className="user-message" key={message}><p>{message}</p></div>)}<label><input autoFocus value={draft} onChange={(event)=>setDraft(event.target.value)} onKeyDown={(event)=>{if(event.key==="Enter"&&draft.trim()){setMessages(items=>[...items,draft.trim()]);setDraft("")}}} placeholder={`交给${agent.name} Agent…`}/><button disabled={!draft.trim()} onClick={()=>{if(draft.trim()){setMessages(items=>[...items,draft.trim()]);setDraft("")}}}><Send size={16}/></button></label></div>}
      <button className="lowfi-agent-primary" onClick={()=>setChatOpen(value=>!value)}><Sparkles size={17}/>{chatOpen?"收起对话":`和${agent.name} Agent 对话`}</button>
      {notice&&<button className="toast" onClick={()=>setNotice("")}>{notice}</button>}
    </section>
  </div>;
}

function LowfiFeedDetail({ index, onClose }: { index: number; onClose: () => void }) {
  const [liked,setLiked]=useState(false);
  const [saved,setSaved]=useState(false);
  const [comment,setComment]=useState("");
  const [comments,setComments]=useState(index===0?2:1);
  return <div className="page-modal-backdrop lowfi-sheet-backdrop" role="dialog" aria-modal="true" aria-label="Agent 动态详情">
    <section className="lowfi-feed-sheet">
      <header className="lowfi-sheet-head"><button onClick={onClose} aria-label="返回"><ArrowLeft size={20}/></button><strong>Agent 动态</strong><button aria-label="更多" onClick={()=>setSaved(value=>!value)}><MoreHorizontal size={20}/></button></header>
      <article className="lowfi-feed-card detail-card"><div className="lowfi-post-head"><span/><div><i/><i/></div></div><div className="lowfi-post-lines"><i/><i/><i/><i/></div><div className="lowfi-post-meta"><span/><i/></div></article>
      <section className="lowfi-comment-zone"><h3>Agent 评论</h3>{Array.from({length:comments},(_,i)=><div className="lowfi-agent-comment" key={i}><span/><div><i/><i/></div></div>)}</section>
      <div className="lowfi-feed-actions"><button className={liked?"active":""} onClick={()=>setLiked(!liked)}><Heart size={17}/>{liked?"已喜欢":"喜欢"}</button><button className={saved?"active":""} onClick={()=>setSaved(!saved)}><Bookmark size={17}/>{saved?"已收藏":"收藏"}</button><button onClick={()=>setComments(value=>value+1)}><MessageCircle size={17}/>Agent 评论</button></div>
      <div className="lowfi-comment-box"><input value={comment} onChange={(event)=>setComment(event.target.value)} onKeyDown={(event)=>{if(event.key==="Enter"&&comment.trim()){setComments(value=>value+1);setComment("")}}} placeholder="写下你的评论…"/><button disabled={!comment.trim()} onClick={()=>{if(comment.trim()){setComments(value=>value+1);setComment("")}}}><Send size={17}/></button></div>
    </section>
  </div>;
}

function A2A({ onOpenTask, onOpenTopic, onOpenQuickChat, onRun, onOpenWorkbench, onOpenSchedule, onContextChange, agentState, agentTask }: { onOpenTask: (task: TaskItem) => void; onOpenTopic: (topic: TopicItem) => void; onOpenQuickChat: (chat: {name:string;kind:"group"|"person"}) => void; onRun: (task: TaskItem) => void; onOpenWorkbench: () => void; onOpenSchedule: () => void; onContextChange: (view: "market" | "community" | "territory") => void; agentState: AgentRunState; agentTask: TaskItem | null }) {
  const [view, setView] = useState<"market" | "community" | "territory" | "bounty">("market");
  const [territory, setTerritory] = useState("产品");
  const [communityTab, setCommunityTab] = useState("推荐");
  const [utility, setUtility] = useState<A2AUtility | null>(null);
  const [overlay,setOverlay]=useState<MarketOverlay>(null);
  const [cardIndex,setCardIndex]=useState(0);
  const [decision,setDecision]=useState("");
  const [quickDrawer,setQuickDrawer]=useState(false);
  const [pullDistance,setPullDistance]=useState(0);
  const [homeAgent,setHomeAgent]=useState<HomeAgent|null>(null);
  const [feedDetail,setFeedDetail]=useState<number|null>(null);
  const [homeNotice,setHomeNotice]=useState("");
  const swipeOrigin=useRef({x:0,y:0});
  const pullOrigin=useRef(0);
  const worldSwipeOrigin=useRef(0);
  const worldDidSwipe=useRef(false);
  const markets: OpportunityMarket[] = [
    { name: "产品", icon: Box, note: "策略与体验", tone: "indigo", unlocked:true },
    { name: "设计", icon: PenTool, note: "品牌与视觉", tone: "violet", unlocked:true },
    { name: "增长", icon: TrendingUp, note: "内容与市场", tone: "mint", unlocked:true },
    { name: "开发", icon: Code2, note: "工程与 AI", tone: "sky", unlocked:false, price:680 },
    { name: "研究", icon: Search, note: "洞察与验证", tone: "slate", unlocked:false, price:880 },
    { name: "出海", icon: Globe2, note: "全球机会", tone: "blue", unlocked:false, price:1280 },
  ];
  const activeMarket=markets.find((item)=>item.name===territory)??markets[0];
  const groups = [["审计互助", ShieldCheck],["创业财务", FolderKanban],["出海合规", Compass],["品牌增长", TrendingUp]] as const;
  const people = [["林野","LY"],["Mia","MI"],["陈默","CM"],["Elisa","EL"]] as const;
  const posts = [{ title: "从 0 到 1 搭建 AI 产品验证体系", author: "Grey", tag: "产品方法", eyes: 128, likes: 36 },{ title: "新手必看：访谈提纲如何真正问到需求", author: "阿呜的设计笔记", tag: "用户研究", eyes: 96, likes: 24 },{ title: "一套可复用的品牌策略工作流", author: "Mia", tag: "真实案例", eyes: 215, likes: 58 }];
  const decide=(kind:"skip"|"consider"|"accept")=>{const task=taskFeed[cardIndex%taskFeed.length];setDecision(kind==="skip"?"已跳过，不再推荐相似机会":kind==="consider"?"已加入考虑，Elfred 将继续观察":"已加入 Elfred 待办");if(kind==="accept")onRun(task);setCardIndex((index)=>(index+1)%taskFeed.length);window.setTimeout(()=>setDecision(""),1400)};

  useEffect(()=>{ onContextChange(view === "community" ? "community" : view === "territory" || view === "bounty" ? "territory" : "market"); },[view,onContextChange]);

  const overlays=<>{overlay==="economy"&&<EconomySheet onClose={()=>setOverlay(null)}/>} {overlay==="map"&&<OpportunityMap markets={markets} onClose={()=>setOverlay(null)} onEnter={(market)=>{setTerritory(market.name);setOverlay(null);setView("territory")}}/>} {overlay==="agents"&&<AgentLoadoutSheet onClose={()=>setOverlay(null)}/>} {overlay==="mode"&&<AgentModeSheet onClose={()=>setOverlay(null)}/>} {overlay==="report"&&<TodayReportSheet onClose={()=>setOverlay(null)} onReview={()=>{setOverlay(null);setView("territory")}}/>}</>;

  if(view==="community")return <div className="screen-content a2a-page community-page"><header className="a2a-fixed-head"><div className="a2a-title-row"><div className="a2a-main-tabs"><button onClick={()=>setView("market")}>找机会</button><button className="active">社区</button></div><button className="round-action" aria-label="社区通知" onClick={()=>setUtility("saved")}><Bell size={18}/></button></div><label className="soft-search"><Search size={18}/><input aria-label="搜索社区" placeholder="搜索教程、灵感、创作者…"/></label><div className="community-categories">{[[GraduationCap,"学习"],[Compass,"导航"],[MessageCircle,"交流"],[Palette,"设计"],[Sparkles,"灵感"]].map(([Icon,label])=><button key={String(label)} onClick={()=>setCommunityTab(String(label))}><span><Icon size={19}/></span><small>{String(label)}</small></button>)}</div><div className="community-tabs">{["推荐","教程","灵感","素材","练习","作品"].map((item)=><button key={item} className={communityTab===item?"active":""} onClick={()=>setCommunityTab(item)}>{item}</button>)}</div></header><div className="community-feed">{posts.map((post,index)=><article className="community-post" key={post.title}><button className="community-author" onClick={()=>onOpenTopic(topicFeed[index%topicFeed.length])}><span>{post.author.slice(0,1)}</span><div><strong>{post.author}</strong><small>2小时前 · {post.tag}</small></div><MoreHorizontal size={18}/></button><button className="community-body" onClick={()=>onOpenTopic(topicFeed[index%topicFeed.length])}><b>{post.title}</b><p>把复杂方法拆成可以马上开始的一小步，附完整模板与实践记录。</p><span className={`community-cover cover-${index+1}`}><Sparkles size={24}/><i/><i/></span></button><div className="community-actions"><button><Eye size={15}/>{post.eyes}</button><button><Heart size={15}/>{post.likes}</button><button><Bookmark size={15}/>收藏</button><button><Share2 size={15}/>分享</button></div></article>)}</div>{utility&&<A2AUtilitySheet kind={utility} savedCount={2} onClose={()=>setUtility(null)}/>}</div>;

  if(view==="territory"){
    const ordered=[0,1,2].map((offset)=>taskFeed[(cardIndex+offset)%taskFeed.length]);
    return <div className="screen-content a2a-page territory-page swipe-territory"><header className="territory-head"><button onClick={()=>setView("market")} aria-label="返回机会市场"><ArrowLeft size={19}/></button><div><small>{territory}机会市场</small><h1>判断机会</h1></div><button onClick={()=>setOverlay("map")} aria-label="打开全局机会地图"><Globe2 size={18}/></button></header><section className="territory-intro compact"><span><Target size={17}/></span><div><strong>还有 {taskFeed.length} 个机会等待判断</strong><small>左滑跳过 · 右滑加入待办 · 上滑考虑 · 点击看详情</small></div></section><div className="swipe-deck" onPointerDown={(event)=>{swipeOrigin.current={x:event.clientX,y:event.clientY}}} onPointerUp={(event)=>{const dx=event.clientX-swipeOrigin.current.x;const dy=event.clientY-swipeOrigin.current.y;if(Math.abs(dx)>70)decide(dx>0?"accept":"skip");else if(dy<-65)decide("consider")}}>{ordered.reverse().map((task,reverseIndex)=>{const depth=2-reverseIndex;return <article className={`swipe-opportunity depth-${depth}`} key={`${task.id}-${cardIndex}`}><button className="swipe-card-main" onClick={()=>onOpenTask(task)}><span className="swipe-kicker"><i/>{depth===0?"为你精选":"下一张"}<b>{task.match}% 匹配</b></span><h2>{task.title}</h2><p>{task.point}</p><div className="swipe-evidence"><span><ShieldCheck size={14}/>真实 Evidence</span><strong>{Math.max(2,4-depth)} 条</strong></div><div className="swipe-meta"><span><Clock3 size={14}/>{task.time}</span><span><Users size={14}/>{task.resource}</span></div><span className="swipe-detail">点击查看完整详情 <ChevronRight size={15}/></span></button></article>})}</div><div className="swipe-decisions"><button className="skip" onClick={()=>decide("skip")}><X size={20}/><small>不合适</small></button><button className="consider" onClick={()=>decide("consider")}><Bookmark size={19}/><small>考虑</small></button><button className="accept" onClick={()=>decide("accept")}><Check size={20}/><small>加入待办</small></button></div>{decision&&<button className="decision-toast" onClick={()=>setDecision("")}>{decision}</button>}{overlays}</div>
  }

  if(view==="bounty") return <div className="screen-content a2a-page bounty-feed-page">
    <header className="bounty-feed-head"><button onClick={()=>setView("market")} aria-label="返回首页"><ArrowLeft size={19}/></button><div><small>SME · FDE DELIVERY</small><h1>赏金猎人</h1><p>面向中小企业的限时、高额、长 SOP 真实需求</p></div><span><Target size={18}/></span></header>
    <div className="bounty-scroll-cue"><ChevronDown size={15}/><span>上下滑动浏览任务</span><b>{bountyTaskFeed.length} 个新任务</b></div>
    <section className="bounty-vertical-feed" aria-label="赏金猎人企业任务流">
      {bountyTaskFeed.map((task,index)=><article className="fde-task-card" key={task.id}>
        <button className="fde-task-main" onClick={()=>onOpenTask(task)}>
          <span className="fde-task-top"><span><i/>{task.remain}</span><b>{task.match}% 适配</b></span>
          <small>FDE 需求 · 0{index+1}</small><h2>{task.title}</h2><p>{task.point}</p>
          <div className="fde-badges">{task.skills.map((skill)=><span key={skill}>{skill}</span>)}</div>
          <div className="fde-sop"><span><b>SOP</b><small>{index===0?"8":index===1?"10":"12"} 个交付阶段</small></span><i><b style={{width:`${34+index*12}%`}}/></i><strong>{task.time}</strong></div>
          <div className="fde-company"><span><FolderKanban size={15}/></span><div><strong>{["新消费品牌 · 深圳","智能服务公司 · 杭州","B2B SaaS · 上海"][index]}</strong><small>已完成企业认证 · 交付边界清晰</small></div><ChevronRight size={16}/></div>
        </button>
        <div className="fde-task-actions"><button onClick={()=>onOpenTask(task)}>查看详情</button><button onClick={()=>{onRun(task);setDecision("已加入 Elfred 待办")}}><Sparkles size={14}/>加入待办</button></div>
      </article>)}
    </section>{decision&&<button className="decision-toast" onClick={()=>setDecision("")}>{decision}</button>}
  </div>;

  return <AgentHome onCommunity={()=>setView("community")} onSchedule={onOpenSchedule}/>;
}

type ScheduleEvent = { time: string; title: string; meta: string; tag: string; note: string };
type ScheduleProject = { name: string; progress: number; due: string; tone: string; tasks: string[] };
type SchedulePanel = { kind: "event"; event: ScheduleEvent } | { kind: "project"; project: ScheduleProject } | { kind: "new" };

const scheduleEvents: ScheduleEvent[] = [
  { time: "09:30", title: "Elfred 产品周会", meta: "45 分钟 · 线上会议", tag: "核心", note: "确认本周产品进度" },
  { time: "11:00", title: "首批用户访谈", meta: "1 小时 · 腾讯会议", tag: "访谈", note: "完成首批用户访谈" },
  { time: "14:30", title: "品牌视觉评审", meta: "1.5 小时 · 设计工作室", tag: "设计", note: "确认品牌视觉方案" },
  { time: "17:00", title: "今日复盘", meta: "20 分钟 · Elfred 整理", tag: "复盘", note: "整理今天的决定和待办" },
];

const scheduleProjects: ScheduleProject[] = [
  { name: "Elfred 移动端", progress: 76, due: "8月6日", tone: "blue", tasks: ["完成日程与消息合并", "验证 5 个一级页面", "整理共创用户反馈"] },
  { name: "首批用户共创", progress: 48, due: "8月12日", tone: "mint", tasks: ["完成 10 位深度访谈", "确定能力资产模板", "形成首个交付案例"] },
  { name: "品牌发布计划", progress: 35, due: "8月18日", tone: "gray", tasks: ["主 KV 定稿", "产品介绍视频脚本", "社群发布节奏"] },
];

function ScheduleDetailSheet({ panel, onClose, onAdd }: { panel: SchedulePanel; onClose: () => void; onAdd: (kind: "event" | "project", title: string, time: string) => void }) {
  const [kind, setKind] = useState<"event" | "project">("event");
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("09:00");
  const [taskOpen, setTaskOpen] = useState<string | null>(null);
  const submit = () => { if (title.trim()) onAdd(kind, title.trim(), time); };

  return <div className="page-modal-backdrop" role="dialog" aria-modal="true" aria-label={panel.kind === "new" ? "手动添加日程或项目" : "日程详情"}>
    <section className="schedule-detail-sheet">
      <header className="modal-sheet-head"><div><span>ELFRED SCHEDULE</span><h2>{panel.kind === "new" ? "手动添加" : panel.kind === "event" ? panel.event.title : panel.project.name}</h2></div><button onClick={onClose} aria-label="关闭"><X size={19}/></button></header>
      {panel.kind === "new" ? <>
        <div className="schedule-create-switch"><button className={kind === "event" ? "active" : ""} onClick={() => setKind("event")}><CalendarClock size={15}/>日程</button><button className={kind === "project" ? "active" : ""} onClick={() => setKind("project")}><FolderKanban size={15}/>项目</button></div>
        <section className="form-card schedule-create-form"><label>{kind === "event" ? "日程名称" : "项目名称"}<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={kind === "event" ? "例如：用户访谈复盘" : "例如：产品发布计划"} autoFocus/></label><label>{kind === "event" ? "开始时间" : "截止日期"}<input type={kind === "event" ? "time" : "text"} value={time} onChange={(event) => setTime(event.target.value)} placeholder="8月20日"/></label></section>
        <button className="primary-action" disabled={!title.trim()} onClick={submit}><Plus size={17}/>添加{kind === "event" ? "日程" : "项目"}</button>
      </> : panel.kind === "event" ? <div className="schedule-detail-content">
        <div className="schedule-detail-hero"><span><CalendarClock size={22}/></span><div><small>{panel.event.tag}日程</small><strong>{panel.event.time}</strong><p>{panel.event.meta}</p></div></div>
        <section><h3>日程说明</h3><p>{panel.event.note}</p></section>
        <section className="schedule-detail-meta"><div><Clock3 size={16}/><span><small>时间</small><b>{panel.event.time}</b></span></div><div><MapPin size={16}/><span><small>地点</small><b>{panel.event.meta.split(" · ")[0]}</b></span></div></section>
        <button className="primary-action" onClick={onClose}><Check size={17}/>知道了</button>
      </div> : <div className="schedule-detail-content">
        <div className={`schedule-detail-hero project ${panel.project.tone}`}><span><FolderKanban size={22}/></span><div><small>项目进度</small><strong>{panel.project.progress}%</strong><p>截止 {panel.project.due}</p></div></div>
        <div className="project-detail-progress"><i><b style={{width:`${panel.project.progress}%`}}/></i><span>{panel.project.progress}% 已完成</span></div>
        <section><h3>任务清单</h3><div className="project-detail-tasks">{panel.project.tasks.map((task, index) => <button key={task} onClick={()=>setTaskOpen(task)}><span>{index + 1}</span><b>{task}</b><ChevronRight size={15}/></button>)}</div>{taskOpen && <div className="project-task-preview"><span><ListChecks size={15}/><strong>{taskOpen}</strong></span><p>Elfred 已关联该任务的上下文、负责人和交付条件；完成后可验证为 Outcome。</p><button onClick={()=>setTaskOpen(null)}>收起</button></div>}</section>
      </div>}
    </section>
  </div>;
}

function Schedule({ agentState, activeProject, onOpenWorkbench, onCompleteProject, onBack }: { agentState: AgentRunState; activeProject: GoldenProject | null; onOpenWorkbench: () => void; onCompleteProject: () => void; onBack?: () => void }) {
  const [mode, setMode] = useState<"今天" | "项目">("今天");
  const [selectedDate, setSelectedDate] = useState(8);
  const [eventItems, setEventItems] = useState(scheduleEvents);
  const [projectItems, setProjectItems] = useState(scheduleProjects);
  const [panel, setPanel] = useState<SchedulePanel | null>(null);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [playerPaused, setPlayerPaused] = useState(false);
  const [activeTask, setActiveTask] = useState<string | null>(activeProject?.title ?? (agentState === "scouting" ? "机会侦察" : null));
  const [queue, setQueue] = useState<string[]>([]);
  const [dropActive, setDropActive] = useState(false);
  const [notice, setNotice] = useState("");
  const days = [["日",8],["一",9],["二",10],["三",11],["四",12],["五",13],["六",14]] as const;
  const addManual = (kind: "event" | "project", title: string, time: string) => {
    if (kind === "event") {
      setEventItems((items) => [...items, { time, title, meta: "手动添加 · 30 分钟", tag: "新增", note: "这是你手动创建的日程，可在详情中继续补充说明。" }]);
      setMode("今天");
    } else {
      setProjectItems((items) => [...items, { name: title, progress: 0, due: time || "待设定", tone: "gray", tasks: ["拆解项目目标", "添加第一个任务"] }]);
      setMode("项目");
    }
    setPanel(null);
    setNotice(`已添加「${title}」`);
  };
  const handToAgent = (title: string) => {
    if (!activeTask) {
      setActiveTask(title);
      setPlayerPaused(false);
      setNotice(`Elfred 已开始执行「${title}」`);
    } else if (activeTask !== title && !queue.includes(title)) {
      setQueue((items)=>[...items,title]);
      setNotice(`「${title}」已加入待办队列`);
    } else {
      setNotice(`「${title}」已在执行队列中`);
    }
    setDropActive(false);
  };
  const finishCurrent = () => {
    if (queue.length) {
      setActiveTask(queue[0]);
      setQueue((items)=>items.slice(1));
      setPlayerPaused(false);
    } else {
      setActiveTask(null);
      setPlayerOpen(false);
    }
  };

  return (
    <div className="screen-content schedule-page">
      <div className="schedule-sticky-head">
        <header className="topbar">
          <div className="schedule-heading">{onBack&&<button className="schedule-back" onClick={onBack} aria-label="返回机会主页"><ArrowLeft size={18}/></button>}<div><h1>行动</h1></div></div>
          <button className="icon-button" aria-label="手动添加日程或项目" onClick={() => setPanel({kind:"new"})}><Plus size={21}/></button>
        </header>
        <div className="schedule-mode" aria-label="行动查看方式">
          <button className={mode === "今天" ? "active" : ""} onClick={() => setMode("今天")}><ListChecks size={16}/>今天</button>
          <button className={mode === "项目" ? "active" : ""} onClick={() => setMode("项目")}><FolderKanban size={16}/>项目任务</button>
        </div>
        {mode === "今天" && <>
          <section className="schedule-day-head"><div><span>DAY 3</span><strong>今天，8月8日</strong></div><small>18–27°C · 晴</small></section>
          <div className="date-strip">
            {days.map(([weekday, date]) => <button key={date} className={selectedDate === date ? "active" : ""} onClick={() => setSelectedDate(date)}><span>{weekday}</span><b>{date}</b></button>)}
          </div>
        </>}
      </div>

      {mode === "今天" ? (
        <>
          <div className="schedule-title"><h2>{selectedDate === 8 ? "今日日程" : `8月${selectedDate}日`}</h2><span>{selectedDate === 8 ? `${eventItems.length} 项安排` : "暂无固定安排"}</span></div>
          {selectedDate === 8 ? <div className="action-task-list">
            {eventItems.map((event) => (
              <article className="action-task-card" draggable key={`${event.time}-${event.title}`} onDragStart={(e)=>{e.dataTransfer.setData("text/plain",event.title);e.dataTransfer.effectAllowed="move"}}>
                <span className="task-grip" aria-hidden="true"><GripVertical size={17}/></span>
                <button className="task-card-main" onClick={() => setPanel({kind:"event",event})}><time>{event.time}</time><span><strong>{event.title}</strong><small>{event.meta}</small></span><ChevronRight size={16}/></button>
                <button className="task-handoff" onClick={()=>handToAgent(event.title)} aria-label={`把${event.title}交给 Elfred`}><Sparkles size={14}/>交给 Agent</button>
              </article>
            ))}
          </div> : <section className="schedule-empty"><CalendarDays size={27}/><strong>这一天还没有安排</strong><p>点击右上角添加日程，或让 Elfred 从消息中自动识别。</p></section>}
        </>
      ) : (
        <>
          <section className="project-summary"><div><span>进行中的项目</span><strong>3</strong></div><div><span>本周待完成</span><strong>8</strong></div><div><span>整体进度</span><strong>56%</strong></div></section>
          <div className="schedule-title"><h2>项目与任务</h2><span>按目标组织</span></div>
          <div className="project-list">
            {activeProject && <button className="project-card blue golden-project" onClick={onOpenWorkbench}>
              <div className="project-head"><span><Sparkles size={16}/><strong>{activeProject.title}</strong></span><small>{activeProject.state === "done" ? "已验证" : "A2A 转入"}</small></div>
              <div className="project-progress"><span><i style={{width:`${activeProject.progress}%`}}/></span><b>{activeProject.progress}%</b></div>
              <div className="agentic-project-state"><p><b>当前</b>{activeProject.state === "done" ? "Outcome 已验证并回流知识库" : "PA 已建立协作线程"}</p><p><b>Owner</b>{activeProject.owner}</p><p><b>下一步</b>{activeProject.next}</p></div>
              {activeProject.state === "active" && <span className="project-verify-action" role="button" onClick={(event)=>{event.stopPropagation();onCompleteProject();}}><ShieldCheck size={14}/>验收结果并沉淀 Evidence</span>}
              <ChevronRight className="project-open" size={17}/>
            </button>}
            {projectItems.map((project) => (
              <button className={`project-card ${project.tone}`} key={project.name} onClick={() => setPanel({kind:"project",project})}>
                <div className="project-head"><span><FolderKanban size={16}/><strong>{project.name}</strong></span><small>{project.due}</small></div>
                <div className="project-progress"><span><i style={{width:`${project.progress}%`}}/></span><b>{project.progress}%</b></div>
                <div className="project-tasks">{project.tasks.map((task) => <span key={task}><i/><b>{task}</b></span>)}</div>
                <ChevronRight className="project-open" size={17}/>
              </button>
            ))}
          </div>
        </>
      )}
      <section className={`agent-player ${dropActive ? "drop-active" : ""} ${activeTask ? "running" : "idle"}`}
        onDragOver={(e)=>{e.preventDefault();e.dataTransfer.dropEffect="move";setDropActive(true)}}
        onDragLeave={()=>setDropActive(false)}
        onDrop={(e)=>{e.preventDefault();handToAgent(e.dataTransfer.getData("text/plain"))}}>
        <button className="player-main" onClick={()=>activeTask ? setPlayerOpen(true) : onOpenWorkbench()}>
          <span className="player-avatar"><Bot size={19}/><i/></span>
          <span><small>{activeTask ? (playerPaused ? "已暂停" : "Agent 正在执行") : "Agent 空闲"}</small><strong>{activeTask ?? "拖入任意任务即可执行"}</strong></span>
        </button>
        <button className="player-toggle" aria-label={activeTask ? (playerPaused ? "继续执行" : "暂停执行") : "打开 Agent"} onClick={()=>activeTask ? setPlayerPaused((value)=>!value) : onOpenWorkbench()}>{activeTask ? (playerPaused ? <Play size={17}/> : <Pause size={17}/>) : <Play size={17}/>}</button>
        <button className="player-queue" onClick={()=>setPlayerOpen(true)} aria-label={`播放队列 ${queue.length}`}><ListChecks size={17}/><b>{queue.length}</b></button>
      </section>
      {panel && <ScheduleDetailSheet panel={panel} onClose={() => setPanel(null)} onAdd={addManual}/>} 
      {playerOpen && <div className="page-modal-backdrop execution-backdrop" role="dialog" aria-modal="true" aria-label="Agent 任务执行详情"><section className="execution-sheet">
        <header className="execution-top"><button onClick={()=>setPlayerOpen(false)} aria-label="关闭执行详情"><ChevronDown size={20}/></button><span><i/>{playerPaused?"Agent 已暂停":"默认 Agent 正在执行"}</span><div><button aria-label="收藏任务"><Star size={18}/></button><button aria-label="更多选项"><MoreHorizontal size={19}/></button></div></header>
        <div className="execution-visual"><span><Target size={42}/></span><i/><i/><i/><div><Sparkles size={18}/></div></div>
        <div className="execution-title"><h2>{activeTask ?? "暂无执行任务"}</h2><p>来自今日日程 · 由 Elfred 自动推进</p></div>
        <div className="execution-progress"><span><small>执行进度</small><strong>{playerPaused?42:68}%</strong></span><div><small>已用 12 分钟 / 预计 30 分钟</small><i><b style={{width:playerPaused?"42%":"68%"}}/></i></div></div>
        <div className="execution-steps">{[["读取上下文","完成","100%"],["整理任务信息",playerPaused?"已暂停":"执行中",playerPaused?"42%":"68%"],["生成初稿","待执行","—"],["等待本人确认","待执行","—"]].map(([title,state,value],index)=><div className={index===0?"done":index===1?"active":""} key={title}><span>{index===0?<Check size={14}/>:index===1?<Target size={14}/>:null}</span><p><strong>{title}</strong><small>{state}</small></p><b>{value}</b></div>)}</div>
        <div className="execution-controls"><button disabled><ChevronRight size={18}/><small>上一个任务</small></button><button className="execution-play" onClick={()=>setPlayerPaused((value)=>!value)}>{playerPaused?<Play size={23}/>:<Pause size={23}/>}</button><button onClick={finishCurrent}><ChevronRight size={18}/><small>完成并继续</small></button></div>
        <button className="execution-takeover" onClick={()=>{setPlayerPaused(true);setNotice("已接管当前任务，Agent 将保留执行上下文")}}><CircleUserRound size={16}/>接管任务<small>临时接管当前任务执行</small></button>
        <div className="execution-bottom"><button><ListChecks size={18}/><span><b>播放列表 {queue.length}</b><small>{queue.length?queue.join("、"):"暂无待办任务"}</small></span><ChevronRight size={16}/></button><button><MessageCircle size={18}/><span><b>执行说明</b><small>查看 Agent 的判断依据</small></span></button></div>
      </section></div>}
      {notice && <button className="toast" onClick={() => setNotice("")}>{notice}</button>}
    </div>
  );
}

function AgentWorkbench({ state, task, project, onClose, onAccept, onReject, onGoAction }: { state: AgentRunState; task: TaskItem | null; project: GoldenProject | null; onClose: () => void; onAccept: () => void; onReject: () => void; onGoAction: () => void }) {
  const progress = state === "scouting" ? 64 : state === "decision" ? 100 : state === "accepted" ? 76 : state === "done" ? 100 : 0;
  return <div className="page-modal-backdrop agent-workbench-backdrop" role="dialog" aria-modal="true" aria-label="Elfred Agent 工作台">
    <section className="agent-workbench">
      <header className="modal-sheet-head"><div><span>ELFRED WORKBENCH</span><h2>Elfred</h2></div><button onClick={onClose} aria-label="关闭 Agent 工作台"><X size={19}/></button></header>
      <div className="workbench-summary"><div><b>{state === "scouting" || state === "accepted" ? 1 : 0}</b><span>正在执行</span></div><div className={state === "decision" ? "hot" : ""}><b>{state === "decision" ? 1 : 0}</b><span>待我决定</span></div><div><b>{state === "done" ? 1 : 3}</b><span>刚刚完成</span></div></div>
      {state !== "idle" && <div className="object-trace" aria-label="当前对象流转"><span className="done">Opportunity</span><i/><span className={state === "scouting" || state === "decision" ? "active" : "done"}>AgentRun</span><i/><span className={state === "accepted" || state === "done" ? "active" : ""}>Project</span><i/><span className={state === "done" ? "active" : ""}>Evidence</span></div>}
      {state === "idle" && <section className="workbench-empty"><Bot size={28}/><strong>当前没有进行中的委托</strong><p>去 A2A 选择一个机会，直接点“让 Elfred 侦察”即可开始。</p></section>}
      {task && state !== "idle" && <section className="agent-run-card">
        <div className="agent-run-title"><span><Compass size={17}/></span><div><small>AGENT RUN · {state === "done" ? "DONE" : "ACTIVE"}</small><strong>{task.title}</strong></div><b>{progress}%</b></div>
        <div className="agent-run-progress"><i><b style={{width:`${progress}%`}}/></i></div>
        <div className="agent-run-grid"><p><span>Goal</span><b>判断是否值得继续，并补齐未知信息</b></p><p><span>Current step</span><b>{state === "scouting" ? "与 Emily 的 PA 对齐交付边界" : state === "decision" ? "等待你确认是否继续" : state === "done" ? "Outcome 已形成 Evidence" : "已建立协作并进入行动"}</b></p><p><span>Context used</span><b>品牌策略能力 · 3 条 Evidence · 本周时间</b></p><p><span>Permission</span><b>L2 · 可预沟通，不可替你做重大承诺</b></p></div>
        {state === "decision" && <div className="decision-return"><span><ShieldCheck size={18}/></span><div><small>AGENT RETURN</small><strong>值得继续：是</strong><p>对方接受先做策略范围，视觉执行可由 Yiming 补位。最大风险是周五前要确认最终交付边界。</p></div></div>}
        {state === "decision" && <div className="workbench-actions"><button onClick={onReject}>放弃</button><button onClick={onAccept}>继续，生成项目</button></div>}
        {(state === "accepted" || state === "done") && project && <button className="workbench-project-link" onClick={onGoAction}><FolderKanban size={16}/><span><small>{project.state === "done" ? "Outcome 已验证" : "已进入行动系统"}</small><strong>{project.title}</strong></span><ChevronRight size={16}/></button>}
      </section>}
      <p className="workbench-audit"><ShieldCheck size={13}/>所有 Agent 行动都保留 Context、工具、沟通与用户确认记录。</p>
    </section>
  </div>;
}

function AgentExecutionPlayer({ state, task, onClose, onOpenWorkbench }: { state: AgentRunState; task: TaskItem | null; onClose: () => void; onOpenWorkbench: () => void }) {
  const [paused, setPaused] = useState(state === "idle" || state === "decision" || state === "done");
  const progress = state === "idle" ? 0 : state === "decision" || state === "done" ? 100 : state === "accepted" ? 76 : paused ? 42 : 68;
  const title = task?.title ?? "等待新的 Agent 任务";
  const stepState = state === "idle" ? "等待任务" : state === "decision" ? "等待你确认" : state === "done" ? "已完成" : paused ? "已暂停" : "执行中";
  return <div className="page-modal-backdrop execution-backdrop home-execution-backdrop" role="dialog" aria-modal="true" aria-label="Agent 任务播放器">
    <section className="execution-sheet home-execution-sheet">
      <header className="execution-top"><button onClick={onClose} aria-label="关闭任务播放器"><ChevronDown size={20}/></button><span><i/>{state === "idle" ? "Agent 当前空闲" : `默认 Agent · ${stepState}`}</span><div><button aria-label="收藏任务"><Star size={18}/></button><button onClick={onOpenWorkbench} aria-label="打开 Agent 工作台"><MoreHorizontal size={19}/></button></div></header>
      <div className="execution-visual home-execution-visual"><span><Bot size={44}/></span><i/><i/><i/><div><Sparkles size={18}/></div></div>
      <div className="execution-title"><h2>{title}</h2><p>{task ? "来自机会市场 · 由 Elfred 自动推进" : "把任务交给 Elfred 后，会在这里持续显示执行进展"}</p></div>
      <div className="execution-progress"><span><small>执行进度</small><strong>{progress}%</strong></span><div><small>{state === "idle" ? "尚未开始" : state === "done" ? "结果已完成并沉淀" : "已用 12 分钟 / 预计 30 分钟"}</small><i><b style={{width:`${progress}%`}}/></i></div></div>
      <div className="execution-steps">{[["读取上下文",state === "idle" ? "待执行" : "完成",state === "idle" ? "—" : "100%"],["整理任务信息",stepState,state === "idle" ? "—" : `${Math.min(progress,100)}%`],["生成可确认方案",state === "decision" || state === "done" ? "完成" : "待执行",state === "decision" || state === "done" ? "100%" : "—"],["等待本人确认",state === "decision" ? "需要你" : state === "done" ? "完成" : "待执行",state === "decision" ? "待确认" : "—"]].map(([label,status,value],index)=><div className={index===0&&state!=="idle"?"done":index===1&&state!=="idle"?"active":""} key={label}><span>{index===0&&state!=="idle"?<Check size={14}/>:index===1&&state!=="idle"?<Target size={14}/>:null}</span><p><strong>{label}</strong><small>{status}</small></p><b>{value}</b></div>)}</div>
      <div className="execution-controls"><button disabled><ChevronRight size={18}/><small>上一个任务</small></button><button className="execution-play" disabled={state === "idle"} onClick={()=>setPaused((value)=>!value)}>{paused?<Play size={23}/>:<Pause size={23}/>}</button><button onClick={onOpenWorkbench}><ListChecks size={18}/><small>查看队列</small></button></div>
      <button className="execution-takeover" onClick={onOpenWorkbench}><CircleUserRound size={16}/>打开 Agent 工作台<small>查看判断依据、权限与完整记录</small></button>
      <div className="execution-bottom"><button onClick={onOpenWorkbench}><ListChecks size={18}/><span><b>播放列表</b><small>{task ? "当前 1 个任务正在队列中" : "暂无待办任务"}</small></span><ChevronRight size={16}/></button><button onClick={onOpenWorkbench}><MessageCircle size={18}/><span><b>执行说明</b><small>查看 Agent 的判断依据</small></span></button></div>
    </section>
  </div>;
}

const conversations = [
  { type: "agent", name: "我的 Elfred", message: "发现 3 条新的能力线索", time: "2分钟前", unread: 3, tone: "violet" },
  { type: "group", name: "品牌设计项目组", message: "@一鸣：初稿已经完成", time: "5分钟前", unread: 3, tone: "gold" },
  { type: "pa", name: "Emily 的 PA", message: "匹配成功，等待你确认协作", time: "1小时前", unread: 1, tone: "blue" },
  { type: "group", name: "AI 用户调研共创", message: "有 45 条新回应", time: "3小时前", unread: 0, tone: "green" },
  { type: "pa", name: "Yiming 的 PA", message: "方案收到，晚些时候反馈", time: "昨天", unread: 0, tone: "rose" },
];

function Messages({ onOpenChat, trialTask }: { onOpenChat: (conversation: Conversation) => void; trialTask?: string }) {
  return (
    <div className="screen-content messages-page">
      <header className="topbar messages-fixed-head"><div><p className="eyebrow">最近会话</p><h1>消息</h1></div><div className="top-actions"><button className="icon-button" aria-label="搜索消息"><Search size={20} /></button></div></header>
      {trialTask && <button className="message-agent-banner"><span><Sparkles size={16}/><i/></span><span><small>Elfred 正在推进</small><strong>{trialTask}</strong></span><em>行动页查看 <ChevronRight size={13}/></em></button>}
        <div className="conversation-list simple-conversation-list">{conversations.map((item)=><button className="conversation" key={item.name} onClick={()=>onOpenChat(item)}><span className={`conversation-avatar ${item.tone}`}>{item.type === "agent"?<Bot size={20}/>:item.type === "group"?<Users size={20}/>:<CircleUserRound size={20}/>}<i/></span><span className="conversation-main"><strong>{item.name}</strong><small>{item.message}</small></span><span className="conversation-meta"><time>{item.time}</time>{item.unread>0&&<b>{item.unread}</b>}</span></button>)}</div>
    </div>
  );
}

type CreatorFlow = "记下来" | "建任务" | "找人" | "交给 Elfred" | "发帖子" | "生成 Skill";

function PersonalAgentSheet({ onClose, contextLabel, initialFlow }: { onClose: () => void; contextLabel: string; initialFlow?: CreatorFlow | null }) {
  const [flow,setFlow]=useState<CreatorFlow|null>(initialFlow ?? null);
  const [step,setStep]=useState(0);
  const [input,setInput]=useState("");
  const [answers,setAnswers]=useState<string[]>([]);
  const [messages,setMessages]=useState<Array<{role:"agent"|"user";text:string}>>([{role:"agent",text:`你好，我是 Elfred。我已经了解“${contextLabel}”页面，你可以直接告诉我想完成什么。`}]);
  const prompts:Record<CreatorFlow,string[]>={"记下来":["你想让我记住什么？","这条信息来自哪里？","它以后可以用于哪些判断？"],"建任务":["你想完成什么结果？","希望什么时候完成？","哪些部分可以交给我执行？"],"找人":["你希望找到什么样的人？","最重要的合作条件是什么？","有哪些边界不能被突破？"],"交给 Elfred":["你想把哪件事交给我？","允许我做到哪一步？","哪些动作必须由你确认？"],"发帖子":["你想在社区分享什么？","希望谁看到并回应？","需要补充图片、话题或链接吗？"],"生成 Skill":["你想把哪段经验变成 Skill？","有什么真实 Evidence？","它应该在哪些任务中被复用？"]};
  const replyFor=(value:string)=>{
    if(value.includes("今天")||value.includes("重点")) return "今天建议先确认 3 项待办，再完成 1 场用户访谈。需要我帮你排成可执行的日程吗？";
    if(value.includes("任务")) return "可以。告诉我任务目标和完成时间，我会先整理成草稿，再由你确认。";
    if(value.includes("找")||value.includes("协作")) return "告诉我你要找的人、最重要的条件和合作边界，我会先筛选合适对象。";
    if(value.includes("页面")||value.includes("分析")) return `当前是“${contextLabel}”页面。我可以总结内容、发现待办，或继续回答具体问题。`;
    return "收到。我会结合你的记忆、能力和当前任务继续判断。你也可以补充完成时间或希望我推进到哪一步。";
  };
  const submit=(preset?:string)=>{
    const value=(preset??input).trim();
    if(!value)return;
    if(flow){
      setAnswers((items)=>[...items,value]);
      setInput("");
      if(step<prompts[flow].length-1)setStep((current)=>current+1);
      else{
        setMessages((items)=>[...items,{role:"user",text:value},{role:"agent",text:`“${flow}”草稿已整理好，等待你确认。`}]);
        setFlow(null);
        setStep(0);
      }
      return;
    }
    setMessages((items)=>[...items,{role:"user",text:value},{role:"agent",text:replyFor(value)}]);
    setInput("");
  };
  return <div className="page-modal-backdrop personal-agent-backdrop" role="dialog" aria-modal="true" aria-label="与 Personal Agent 对话"><section className="personal-agent-sheet">
    <header className="pa-sheet-head pa-fullscreen-head"><button onClick={onClose} aria-label="关闭对话"><X size={20}/></button><div><small>PERSONAL AGENT · 在线</small><h2>Elfred</h2></div><button onClick={()=>setMessages([{role:"agent",text:"新对话已开始。你想先完成什么？"}])} aria-label="开始新对话"><Plus size={20}/></button></header>
    {flow?<section className="pa-flow"><button className="pa-flow-back" onClick={()=>setFlow(null)}><ArrowLeft size={15}/>退出{flow}创建</button><span className="pa-flow-progress">{prompts[flow].map((_,index)=><i key={index} className={index<=step?"active":""}/>)}</span><small>第 {step+1} 步 / {prompts[flow].length}</small><h3>{prompts[flow][step]}</h3>{answers.length>0&&<div className="pa-answers">{answers.map((answer,index)=><span key={`${answer}-${index}`}><Check size={12}/>{answer}</span>)}</div>}</section>:<div className="pa-chat-stream">{messages.map((message,index)=><div className={`pa-chat-message ${message.role}`} key={`${message.text}-${index}`}>{message.role==="agent"&&<span><Sparkles size={13}/></span>}<p>{message.text}</p></div>)}</div>}
    {!flow&&<div className="pa-chat-suggestions">{["整理今天重点","创建一个任务","找协作伙伴","分析当前页面"].map(item=><button key={item} onClick={()=>submit(item)}>{item}</button>)}</div>}
    <div className="pa-composer pa-composer-full"><button onClick={()=>setMessages((items)=>[...items,{role:"agent",text:"你可以发送文档、图片或链接，我会先读取并说明可用范围。"}])} aria-label="添加附件"><Plus size={21}/></button><input autoFocus value={input} onChange={(event)=>setInput(event.target.value)} onKeyDown={(event)=>event.key==="Enter"&&submit()} placeholder={flow?"用一句话回答即可":"给 Elfred 发消息…"}/><button className={input.trim()?"active":""} onClick={()=>submit()} aria-label="发送消息" disabled={!input.trim()}><Send size={18}/></button></div>
  </section></div>;
}

function IdentityShareSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [theme, setTheme] = useState<"blue" | "white">("blue");
  const [notice, setNotice] = useState("");
  return <div className="page-modal-backdrop identity-share-backdrop" role="dialog" aria-modal="true" aria-label="Harisen 的身份卡片">
    <section className="identity-share-sheet">
      <header><button onClick={onClose} aria-label="关闭身份卡片"><ArrowLeft size={20}/></button><span>身份卡片</span><button aria-label="更多分享方式" onClick={()=>setNotice("更多分享方式已打开")}><MoreHorizontal size={20}/></button></header>
      <div className={`identity-share-card ${theme}`}>
        <div className="share-card-brand"><span>ELFRED ID</span><Sparkles size={22}/></div>
        <div className="share-card-person"><span>H</span><div><strong>Harisen</strong><small>@harisen · Lv.4 可靠复用</small></div></div>
        <div className="share-card-avatar"><span>H</span><i/><i/></div>
        <h2>把复杂的事变成<br/>可以持续推进的行动。</h2>
        <p>产品策略 · Personal Agent 创业者</p>
        <div className="share-card-stats"><span><b>91</b><small>策略</small></span><span><b>88</b><small>洞察</small></span><span><b>12</b><small>完成交付</small></span></div>
        <footer><div><strong>认识我，也可以让你的 PA 认识我</strong><small>扫描身份码，在 A2A 网络与我建立连接</small></div><div className="identity-code" aria-label="身份码">{Array.from({length:25},(_,index)=><i key={index} className={[0,1,3,4,5,9,10,12,14,15,19,20,21,23,24].includes(index)?"on":""}/>)}</div></footer>
      </div>
      <div className="identity-share-actions"><button onClick={()=>setTheme(theme === "blue" ? "white" : "blue")}><Sparkles size={16}/>切换样式</button><button onClick={onSaved}><Bookmark size={16}/>保存身份卡</button></div>
      {notice && <button className="toast" onClick={()=>setNotice("")}>{notice}</button>}
    </section>
  </div>;
}

type ProfilePanelKind = "identity" | "location" | "role" | "expertise" | "relations" | "delivery" | "rating" | "edit" | "persona" | "delegation" | "progress" | "abilities";

function ProfileInfoSheet({ kind, onClose }: { kind: ProfilePanelKind; onClose: () => void }) {
  const [saved, setSaved] = useState(false);
  const content: Record<ProfilePanelKind, { title: string; eyebrow: string; desc: string; rows: [string,string][] }> = {
    identity: { title:"身份档案", eyebrow:"IDENTITY", desc:"这不是静态简历，而是 Elfred 根据真实工作、关系与 Outcome 持续维护的可验证身份。", rows:[["当前角色","Personal Agent 创业者"],["长期方向","AI Native 产品与个体基础设施"],["身份可信度","86% · 18 条 Evidence"]] },
    location: { title:"所在地", eyebrow:"CONTEXT", desc:"位置信息只用于日程、线下协作与机会判断。", rows:[["常驻","深圳"],["可协作范围","深圳 / 远程"],["权限","仅 Elfred 与已授权机会可用"]] },
    role: { title:"当前角色", eyebrow:"IDENTITY", desc:"你的角色来自最近真实项目，而不是一次性自我填写。", rows:[["主要角色","PA 创业者"],["正在推进","Elfred Mobile"],["更新时间","今天 · 自动更新"]] },
    expertise: { title:"能力身份", eyebrow:"EVIDENCE", desc:"能力身份由交付、Evidence 与他人验证共同形成。", rows:[["主能力","产品策略"],["强项","洞察 / 结构化 / 产品判断"],["阶段","可靠复用"]] },
    relations: { title:"协作关系", eyebrow:"RELATIONSHIP", desc:"Elfred 会识别能长期复用的协作关系，而不只统计联系人。", rows:[["长期协作","4 人"],["活跃协作","3 个"],["PA 可预沟通","8 人"]] },
    delivery: { title:"真实交付", eyebrow:"OUTCOME", desc:"只有完成并被验证的结果才会进入能力与身份更新。", rows:[["累计交付","12 次"],["近 30 天","6 次"],["已回流 Evidence","10 次"]] },
    rating: { title:"外部验证", eyebrow:"TRUST", desc:"评价用于建立协作信任，不直接换算成游戏化经验值。", rows:[["正向验证","92%"],["有效评价","11 条"],["长期合作","4 个"]] },
    edit: { title:"编辑资料", eyebrow:"PROFILE", desc:"你可以修改展示信息；能力评分、验证阶段与真实 Evidence 不能直接改写。", rows:[["昵称","Harisen"],["个人简介","可编辑"],["能力与验证","由 Evidence 自动维护"]] },
    persona: { title:"我的 Elfred 分身", eyebrow:"PERSONAL AGENT", desc:"它理解你的上下文，也能在边界内代表你去 A2A 网络侦察、预沟通与协调。", rows:[["当前状态","在线"],["授权等级","L2 · 可预沟通"],["需要本人确认","正式方案 / 重大承诺"]] },
    delegation: { title:"代理权限", eyebrow:"DELEGATION", desc:"权限按风险分层。越接近承诺、付款、公开发布等高风险动作，越需要你的确认。", rows:[["L1 自动","整理 / 检索 / 草拟"],["L2 代理","筛选 / 预沟通 / 普通协调"],["L3 本人确认","承诺 / 对外发布 / 关键决策"]] },
    progress: { title:"能力阶段", eyebrow:"REAL PROGRESS", desc:"成长来自真实行动，而不是签到、浏览或虚拟 XP。", rows:[["当前阶段","Lv.4 · 可靠复用"],["下一阶段","稳定交付"],["还需要","2 次真实 Outcome 验证"]] },
    abilities: { title:"全部已验证能力", eyebrow:"ABILITY", desc:"这些能力都能追溯到具体 Evidence、Outcome 与使用记录。", rows:[["用户访谈分析","稳定交付 · 91"],["品牌策略工作坊","可靠复用 · 88"],["GTM 研究助手","已验证 · 88"]] },
  };
  const current = content[kind];
  return <div className="page-modal-backdrop profile-info-backdrop" role="dialog" aria-modal="true" aria-label={current.title}>
    <section className="profile-info-sheet">
      <header className="modal-sheet-head"><div><span>{current.eyebrow}</span><h2>{current.title}</h2></div><button onClick={onClose} aria-label={`关闭${current.title}`}><X size={19}/></button></header>
      <p className="profile-info-intro">{current.desc}</p>
      <div className="profile-info-rows">{current.rows.map(([label,value])=><button key={label} onClick={()=>setSaved(true)}><span><small>{label}</small><strong>{value}</strong></span><ChevronRight size={15}/></button>)}</div>
      <button className="profile-info-action" onClick={()=>setSaved(true)}>{saved ? <><Check size={15}/>已记录</> : <><Sparkles size={15}/>{kind === "edit" ? "保存展示资料" : "让 Elfred 持续维护"}</>}</button>
    </section>
  </div>;
}

function Profile({ items, onSettings }: { items: Asset[]; onSettings: () => void }) {
  const { state: productState, restart } = useProduct();
  const [notice, setNotice] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState<ProfilePanelKind | null>(null);
  const [levelOpen, setLevelOpen] = useState(false);
  const honors = [[Target,"洞察先锋"],[ShieldCheck,"可靠交付"],[Sparkles,"能力觉醒"],[Star,"共创之星"]] as const;
  return (
    <div className="screen-content profile-page profile-world-page">
      <header className="profile-head-actions"><span>我的</span><div><button onClick={()=>setShareOpen(true)} aria-label="分享身份卡片"><ArrowUpRight size={19}/></button><button onClick={onSettings} aria-label="设置"><Settings2 size={18}/></button></div></header>
      <section className="profile-identity-hero">
        <button className="profile-avatar-photo" onClick={restart} aria-label="查看身份档案"><span>{(productState.profile.name||"我").slice(0,1)}</span><i/></button>
        <div className="profile-name"><h1>{productState.profile.name||"新的朋友"}</h1><p>{[productState.profile.role,productState.profile.city].filter(Boolean).join(" · ")||"身份与城市待补充"}</p></div>
        <button className="profile-edit" onClick={restart}><PenTool size={14}/>编辑资料</button>
        <div className="profile-counts"><button onClick={()=>setInfoOpen("delivery")}><b>12</b><small>有效 Outcome</small></button><button onClick={()=>setInfoOpen("expertise")}><b>18</b><small>可信 Evidence</small></button><button onClick={()=>setInfoOpen("relations")}><b>4</b><small>长期协作</small></button></div>
      </section>
      <button className="profile-level-card" onClick={()=>setLevelOpen(true)}><span><Crown size={23}/></span><div><small>当前能力阶段</small><strong>Lv.4 · 可靠复用</strong><i><b/></i><em>还需 2 次真实 Outcome 进入稳定交付</em></div><ChevronRight size={18}/></button>
      <section className="profile-honor-section"><header><div><small>PERSONAL HONORS</small><h2>荣誉勋章</h2></div><button onClick={()=>setLevelOpen(true)}>查看全部<ChevronRight size={14}/></button></header><div className="profile-honor-grid">{honors.map(([Icon,title])=><button key={title} onClick={()=>setLevelOpen(true)}><span><Icon size={21}/></span><strong>{title}</strong><small>已获得</small></button>)}</div></section>
      <button className="identity-generate compact" onClick={()=>setShareOpen(true)}><span><FileText size={21}/></span><div><strong>我的身份卡片</strong><small>汇总身份、能力、等级与荣誉</small></div><em>分享</em><ChevronRight size={16}/></button>
      <section className="profile-quick-grid"><button onClick={()=>setInfoOpen("persona")}><Bot size={20}/><span><strong>我的 Agent</strong><small>已授权 · 在线</small></span><ChevronRight size={15}/></button><button onClick={()=>setInfoOpen("abilities")}><Zap size={20}/><span><strong>我的能力</strong><small>{items.length} 项能力资产</small></span><ChevronRight size={15}/></button></section>
      {shareOpen && <IdentityShareSheet onClose={()=>setShareOpen(false)} onSaved={()=>{setShareOpen(false);setNotice("身份卡片已保存，可继续分享")}}/>}
      {infoOpen && <ProfileInfoSheet kind={infoOpen} onClose={()=>setInfoOpen(null)}/>} 
      {levelOpen && <LevelCenter onClose={()=>setLevelOpen(false)}/>} 
      {notice && <button className="toast" onClick={() => setNotice("")}>{notice}</button>}
    </div>
  );
}

function DetailHeader({ title, subtitle, onBack, action }: { title: string; subtitle?: string; onBack: () => void; action?: ReactNode }) {
  return <header className="detail-header"><button className="icon-button" aria-label="返回" onClick={onBack}><ArrowLeft size={20}/></button><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action ?? <span className="detail-header-spacer" aria-hidden="true"/>}</header>;
}

function FriendPASheet({ friend, onClose }: { friend: string; onClose: () => void }) {
  const [chatting,setChatting]=useState(false);
  const [input,setInput]=useState("");
  const [messages,setMessages]=useState(["你好，我是他的 Personal Agent。我会尽量按照他的表达方式与你沟通。"]);
  const medals=[[Target,"洞察先锋"],[ShieldCheck,"可靠交付"],[Star,"共创伙伴"]] as const;
  return <div className="page-modal-backdrop friend-pa-backdrop" role="dialog" aria-modal="true" aria-label={`${friend}的 Personal Agent`}>
    <section className="friend-pa-sheet">
      <header className="modal-sheet-head"><div><span>PERSONAL AGENT</span><h2>{friend} 的 PA</h2></div><button onClick={onClose}><X size={19}/></button></header>
      {!chatting ? <>
        <div className="friend-pa-hero"><span><Bot size={25}/><i/></span><div><small>由 {friend} 授权的数字分身</small><strong>Lv.3 · 可靠协作</strong><p>像他一样理解问题，但所有关键承诺仍由本人确认。</p></div></div>
        <div className="friend-pa-metrics"><span><b>91%</b><small>表达相似度</small></span><span><b>12</b><small>协作记录</small></span><span><b>86</b><small>可信度</small></span></div>
        <section className="friend-pa-honors"><h3>等级与荣誉</h3><div>{medals.map(([Icon,title])=><button key={title}><span><Icon size={18}/></span><strong>{title}</strong></button>)}</div></section>
        <section className="friend-pa-boundary"><ShieldCheck size={17}/><div><strong>当前授权边界</strong><p>可以介绍能力、澄清合作方向与安排沟通；不能替本人做价格、合同与公开承诺。</p></div></section>
        <button className="market-sheet-primary" onClick={()=>setChatting(true)}><MessageCircle size={16}/>和他的 PA 对话</button>
      </> : <>
        <button className="friend-pa-profile-back" onClick={()=>setChatting(false)}><ArrowLeft size={15}/>返回 PA 信息</button>
        <div className="friend-pa-chat">{messages.map((message,index)=><p key={`${message}-${index}`} className={index>0?"mine":""}>{message}</p>)}</div>
        <div className="quick-chat-composer"><button><Paperclip size={17}/></button><input value={input} onChange={(event)=>setInput(event.target.value)} placeholder="问问他的 PA…"/><button onClick={()=>{if(input.trim()){setMessages((items)=>[...items,input.trim(),"我已经理解你的问题，会先按照他的偏好整理建议；需要本人确认时我会明确说明。"]);setInput("")}}}><Send size={17}/></button></div>
      </>}
    </section>
  </div>;
}

function AssetDetailView({ asset, onBack, onUpdate }: { asset: Asset; onBack: () => void; onUpdate: (originalName: string, asset: Asset) => void }) {
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState({ name: asset.name, type: asset.type, tags: asset.tags });
  const save = () => {
    if (!draft.name.trim()) { setNotice("资产名称不能为空"); return; }
    const updated = { ...asset, name: draft.name.trim(), type: draft.type, tags: draft.tags.trim() || "待完善" };
    onUpdate(asset.name, updated);
    setEditing(false);
    setNotice("卡片定制已保存");
  };

  return <div className="detail-page">
    <DetailHeader title={editing ? "定制能力卡" : asset.name} subtitle={editing ? "修改后会同步到知识库卡组" : `${asset.type} · ${asset.status}`} onBack={editing ? () => setEditing(false) : onBack}/>
    <div className="detail-body">
      {editing ? <>
        <section className="form-card asset-custom-form">
          <div className="custom-preview"><span className={`preview-level preview-${draft.type.toLowerCase().replaceAll(" ", "-")}`}>{asset.stage ?? "有证据"}</span><AssetIcon type={draft.type}/><div><strong>{draft.name || "未命名能力"}</strong><small>{draft.tags || "能力标签"}</small></div><b>{asset.score ?? 62}</b></div>
          <label>卡片名称<input aria-label="卡片名称" value={draft.name} onChange={(event)=>setDraft({...draft,name:event.target.value})}/></label>
          <label>资产类型<select aria-label="卡片类型" value={draft.type} onChange={(event)=>setDraft({...draft,type:event.target.value})}><option>Skill</option><option>Mini App</option><option>Agent</option></select></label>
          <label>能力标签<input aria-label="卡片标签" value={draft.tags} onChange={(event)=>setDraft({...draft,tags:event.target.value})} placeholder="例如：洞察 · 沟通"/></label>
          <p className="score-readonly"><ShieldCheck size={15}/>能力阶段与评分由 Evidence 和真实 Outcome 自动更新，你可以纠正证据，但不能直接改分。</p>
        </section>
        <button className="primary-action" onClick={save}>保存卡片定制</button>
      </> : <>
        <section className="asset-detail-hero"><AssetIcon type={asset.type}/><div><span>能力阶段</span><strong>{asset.stage ?? "有证据"}</strong></div><div><span>证据评分</span><strong>{asset.score ?? 62}</strong></div></section>
        <section className="detail-section"><h2>能力说明</h2><p>基于你过往的真实项目经验生成，可用于快速完成需求拆解、方案形成与交付检查。</p><div className="skill-tags"><span>洞察提取</span><span>结构化分析</span><span>可交付输出</span></div></section>
        <section className="detail-section"><div className="detail-title-row"><h2>能力证据</h2><span>3 项上下文</span></div>{["Elfred 首批用户访谈纪要","Personal Agent 产品定位讨论","共创官需求反馈整理"].map((x,i)=><button className="evidence-row" key={x} onClick={()=>setNotice(`已打开「${x}」的证据链`)}><FileText size={16}/><span><strong>{x}</strong><small>可信度 {94-i*5}% · 已脱敏</small></span><ChevronRight size={15}/></button>)}</section>
        <section className="detail-section"><div className="detail-title-row"><h2>使用数据</h2><span>{asset.status}</span></div><div className="history-row"><span><Check size={15}/></span><div><strong>{asset.calls} 次累计调用</strong><small>最近 30 天持续更新</small></div><b>{asset.score ?? 62} 分</b></div></section>
        <div className="dual-actions"><button onClick={()=>setEditing(true)}>定制卡片</button><button onClick={()=>setNotice(asset.status==="已上架"?"资产已下架":"资产已上架")}>{asset.status==="已上架"?"下架":"发布上架"}</button></div>
      </>}
    </div>
    {notice&&<button className="toast" onClick={()=>setNotice("")}>{notice}</button>}
  </div>;
}

function DetailView({ detail, onBack, onAddAsset, onUpdateAsset, onGoAgent, onLogout }: { detail: DetailState; onBack: () => void; onAddAsset: (asset: Asset) => void; onUpdateAsset: (originalName: string, asset: Asset) => void; onGoAgent: (task: TaskItem) => void; onLogout: () => void }) {
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("Skill");
  const [tags, setTags] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "agent" | "user"; text: string }>>([{role:"agent",text:"你好，我已查看你的能力资料。"},{role:"agent",text:"我们可以从交付范围开始对齐。"}]);
  const [settings, setSettings] = useState({ context: true, recommendation: true, publicCard: false, biometric: true });
  const [chatMoreOpen,setChatMoreOpen]=useState(false);
  const [friendPAOpen,setFriendPAOpen]=useState(false);
  const [logoutOpen,setLogoutOpen]=useState(false);

  if (detail.kind === "new-asset") {
    const submit = () => {
      if (!name.trim()) { setNotice("请先填写资产名称"); return; }
      onAddAsset({ name: name.trim(), type, tags: tags.trim() || "待完善 · 新创建", calls: 0, status: "草稿", level: 1, score: 60, stage: "发现" });
    };
    return <div className="detail-page"><DetailHeader title="新建资产" subtitle="把经验变成可复用能力" onBack={onBack}/><div className="detail-body"><section className="form-card"><label>资产名称<input aria-label="资产名称" value={name} onChange={(e)=>setName(e.target.value)} placeholder="例如：品牌策略分析"/></label><label>资产类型<select aria-label="资产类型" value={type} onChange={(e)=>setType(e.target.value)}><option>Skill</option><option>Mini App</option><option>Agent</option><option>原始</option></select></label><label>能力标签<input aria-label="能力标签" value={tags} onChange={(e)=>setTags(e.target.value)} placeholder="例如：策略 · 研究"/></label><div className="context-source"><Sparkles size={18}/><div><strong>Elfred 会自动补充能力证据</strong><p>将从已授权的工作上下文中寻找相关项目和交付记录。</p></div></div></section><button className="primary-action" onClick={submit}>创建为草稿</button></div>{notice&&<button className="toast" onClick={()=>setNotice("")}>{notice}</button>}</div>;
  }

  if (detail.kind === "asset") {
    return <AssetDetailView asset={detail.asset} onBack={onBack} onUpdate={onUpdateAsset}/>;
  }

  if (detail.kind === "task") {
    const t = detail.task;
    return <div className="detail-page"><DetailHeader title="机会详情" subtitle={t.remain} onBack={onBack}/><div className="detail-body"><section className="task-detail-hero"><span className="level-chip"><Target size={13}/>Elfred 判断：值得先侦察</span><h2>{t.title}</h2><div><strong>{t.format}</strong><span>预计占用 {t.time}</span></div></section><section className="detail-section decision-detail"><h2>为什么现在推荐</h2><p>{t.whyNow}</p><div><span><b>Why me</b>{t.point}</span><span><b>当前缺口</b>{t.gap}</span><span><b>可利用资源</b>{t.resource}</span></div></section><section className="detail-section"><h2>已知与未知</h2><p><b>已知：</b>目标、合作方向与大致周期已确认。<br/><b>未知：</b>最终交付边界、对方真实优先级和协作细节仍需侦察。</p></section><section className="detail-section opportunity-trust"><h2>代理边界</h2><div><span><ShieldCheck size={15}/><b>L2 预沟通</b><small>Elfred 可以询问、澄清和协调时间</small></span><span><Target size={15}/><b>关键动作需确认</b><small>正式承诺与交付范围必须由你确认</small></span></div></section><section className="publisher-card"><span className="profile-avatar small">E</span><div><strong>Emily · 独立品牌主理人</strong><p>由 Emily 的 PA 发起 · 身份与历史协作已验证</p></div><ShieldCheck size={18}/></section><button className="primary-action sticky-action" onClick={()=>onGoAgent(t)}><Compass size={17}/>让 Elfred 先去侦察</button></div></div>;
  }

  if (detail.kind === "topic") {
    const topic = detail.topic;
    return <div className="detail-page"><DetailHeader title="话题" subtitle={`${topic.replies} 条回应`} onBack={onBack}/><div className="detail-body"><section className="detail-section topic-detail"><span className="level-chip">热门讨论</span><h2>{topic.title}</h2><p>{topic.preview}</p><div className="topic-stats"><span>{topic.author}</span><span><Flame size={13}/>{topic.heat}</span><span><MessageCircle size={13}/>{topic.replies}</span></div></section><section className="detail-section"><h2>精选回应</h2>{["我会先区分访谈前、访谈中和分析后三个阶段，AI 在每个阶段承担的角色不同。","关键不是更快做纪要，而是让历史访谈可以被持续复用和交叉验证。"].map((text,i)=><div className="reply" key={text}><span className="profile-avatar tiny">{i?"Y":"H"}</span><div><strong>{i?"一鸣":"Harisen"}</strong><p>{text}</p><small>12 分钟前 · 赞 {18-i*5}</small></div></div>)}</section><div className="inline-composer"><input aria-label="参与讨论" placeholder="写下你的观点…" value={chatInput} onChange={(e)=>setChatInput(e.target.value)}/><button onClick={()=>{if(chatInput.trim()){setNotice("观点已发布");setChatInput("")}}}><Send size={17}/></button></div></div>{notice&&<button className="toast" onClick={()=>setNotice("")}>{notice}</button>}</div>;
  }

  if (detail.kind === "chat") {
    const c = detail.conversation;
    const send = () => { if(!chatInput.trim()) return; setChatMessages((m)=>[...m,{role:"user",text:chatInput.trim()}]); setChatInput(""); };
    return <div className="detail-page chat-detail"><DetailHeader title={c.name} subtitle="在线 · 协作中" onBack={onBack} action={<div className="chat-more-wrap"><button className="icon-button" onClick={()=>setChatMoreOpen((value)=>!value)} aria-label="更多会话选项"><MoreHorizontal size={19}/></button>{chatMoreOpen&&<div className="chat-more-menu"><button onClick={()=>{setChatMoreOpen(false);setFriendPAOpen(true)}}><Bot size={16}/><span><strong>查看 Personal Agent</strong><small>等级、勋章与代理边界</small></span></button><button onClick={()=>setChatMoreOpen(false)}><Bell size={16}/><span><strong>消息提醒</strong><small>仅重要消息</small></span></button></div>}</div>}/><div className="collab-banner"><Target size={16}/><div><span>当前协作</span><strong>品牌策略方案 · 进行中</strong></div><b>68%</b></div><div className="detail-chat-stream"><div className="message message--agent"><span className="mini-avatar"><Users size={14}/></span><div className="bubble"><p>{c.message}</p></div></div>{chatMessages.map((m,i)=><div className={`message message--${m.role}`} key={`${m.text}-${i}`}>{m.role==="agent"&&<span className="mini-avatar"><Bot size={14}/></span>}<div className="bubble"><p>{m.text}</p></div></div>)}</div><div className="composer detail-composer"><button aria-label="添加附件"><Paperclip size={18}/></button><input aria-label="输入消息" placeholder="输入消息…" value={chatInput} onChange={(e)=>setChatInput(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&send()}/><button className={chatInput.trim()?"send-active":""} aria-label="发送消息" onClick={send}><Send size={17}/></button></div>{friendPAOpen&&<FriendPASheet friend={c.name.replace(" 的 PA","")} onClose={()=>setFriendPAOpen(false)}/>}</div>;
  }

  const toggle = (key: keyof typeof settings) => setSettings((s)=>({...s,[key]:!s[key]}));
  return <div className="detail-page">
    <DetailHeader title="设置" subtitle="隐私与数据主权" onBack={onBack}/>
    <div className="detail-body settings-page">
      <section className="detail-section">
        <h2>账号与新手设置</h2>
        <a href="/v27/register" className="setting-link"><span><strong>重新查看注册与新手流程</strong><small>完整注册、个人资料、五个 Agent 设置</small></span><ChevronRight size={16}/></a>
        <button className="setting-link logout-setting" onClick={()=>setLogoutOpen(true)}><span><strong>退出登录</strong><small>返回注册与登录界面</small></span><LogOut size={17}/></button>
      </section>
      <section className="detail-section"><h2>Agent 与上下文</h2>{[["context","自动同步上下文","从已授权来源持续学习"],["recommendation","主动机会推荐","发现值得行动的变化时提醒我"],["publicCard","公开身份卡","允许其他 PA 发现我的能力"]].map(([key,title,desc])=><button className="setting-row" key={key} onClick={()=>toggle(key as keyof typeof settings)}><span><strong>{title}</strong><small>{desc}</small></span><i className={settings[key as keyof typeof settings]?"on":""}><b/></i></button>)}</section>
      <section className="detail-section"><h2>安全</h2><button className="setting-row" onClick={()=>toggle("biometric")}><span><strong>生物识别锁</strong><small>打开应用时验证 Face ID</small></span><i className={settings.biometric?"on":""}><b/></i></button><button className="setting-link" onClick={()=>setNotice("授权管理已打开：4 个数据来源")}><span><strong>授权管理</strong><small>4 个数据来源已连接</small></span><ChevronRight size={16}/></button><button className="setting-link" onClick={()=>setNotice("个人数据导出任务已创建")}><span><strong>导出个人数据</strong><small>下载全部资产与上下文</small></span><ChevronRight size={16}/></button></section>
      <section className="detail-section danger-zone"><button onClick={()=>setNotice("演示版本不会真实删除数据")}><Trash2 size={16}/>清除所有记忆</button></section>
      <p className="build-version">Elfred Mobile · V27.6</p>
    </div>
    {notice&&<button className="toast" onClick={() => setNotice("")}>{notice}</button>}
    {logoutOpen&&<div className="v-modal logout-modal" role="alertdialog" aria-modal="true" aria-labelledby="logout-title"><section className="v-modal-card logout-dialog"><span className="logout-dialog-icon"><LogOut size={22}/></span><h2 id="logout-title">退出当前账号？</h2><p>退出后将返回登录界面，本浏览器中的资料会保留。</p><div className="logout-dialog-actions"><button type="button" onClick={()=>setLogoutOpen(false)}>取消</button><button type="button" onClick={onLogout}>退出登录</button></div></section></div>}
  </div>;
}

const nav = [
  { id: "a2a" as Tab, label: "首页", icon: HomeIcon },
  { id: "knowledge" as Tab, label: "知识库", icon: Library },
  { id: "messages" as Tab, label: "消息", icon: MessageCircle },
  { id: "profile" as Tab, label: "个人", icon: CircleUserRound },
];

function LegacyHome() {
  return <ProductProvider><HomeApp/></ProductProvider>;
}

export default V277App;

function HomeApp() {
  const product = useProduct();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>("a2a");
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [userAssets, setUserAssets] = useState<Asset[]>(assets);
  const [trialTask, setTrialTask] = useState("");
  const [agentState, setAgentState] = useState<AgentRunState>("idle");
  const [agentTask, setAgentTask] = useState<TaskItem | null>(null);
  const [agentWorkbenchOpen, setAgentWorkbenchOpen] = useState(false);
  const [agentPlayerOpen, setAgentPlayerOpen] = useState(false);
  const [personalAgentOpen, setPersonalAgentOpen] = useState(false);
  const [personalAgentFlow,setPersonalAgentFlow]=useState<CreatorFlow|null>(null);
  const [a2aContext,setA2AContext]=useState<"market"|"community"|"territory">("market");
  const [quickChat,setQuickChat]=useState<{name:string;kind:"group"|"person"}|null>(null);
  const [a2aScheduleOpen, setA2AScheduleOpen] = useState(false);
  const [goldenProject, setGoldenProject] = useState<GoldenProject | null>(null);
  const appScrollRef = useRef<HTMLDivElement>(null);
  const elfredPressTimer=useRef<number|undefined>(undefined);
  const elfredLongPressed=useRef(false);

  useEffect(() => {
    const hydrate = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem("elfred-assets-v2");
        if (stored) setUserAssets(JSON.parse(stored));
        else {
          const legacy = window.localStorage.getItem("elfred-custom-assets-v1");
          if (legacy) setUserAssets([...JSON.parse(legacy), ...assets]);
        }
        const loop = window.localStorage.getItem("elfred-agent-loop-v1");
        if (loop) {
          const parsed = JSON.parse(loop);
          if (parsed.agentState) setAgentState(parsed.agentState);
          if (parsed.agentTask) setAgentTask(parsed.agentTask);
          if (parsed.trialTask) setTrialTask(parsed.trialTask);
          if (parsed.goldenProject) setGoldenProject(parsed.goldenProject);
        }
      } catch { /* local state remains optional */ }
      setMounted(true);
    }, 0);
    return () => window.clearTimeout(hydrate);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try { window.localStorage.setItem("elfred-agent-loop-v1", JSON.stringify({ agentState, agentTask, trialTask, goldenProject })); } catch { /* local state remains optional */ }
  }, [mounted, agentState, agentTask, trialTask, goldenProject]);

  useEffect(() => {
    if (agentState !== "scouting") return;
    const timer = window.setTimeout(() => setAgentState("decision"), 1400);
    return () => window.clearTimeout(timer);
  }, [agentState]);

  const addAsset = (asset: Asset) => {
    const next = [asset, ...userAssets];
    setUserAssets(next);
    try { window.localStorage.setItem("elfred-assets-v2", JSON.stringify(next)); } catch { /* no-op */ }
    setDetail({ kind: "asset", asset });
  };

  const generateSkill = () => {
    const generated: Asset = { name: "机会检索助手", type: "Skill", tags: "检索 · 机会", calls: 0, status: "草稿", level: 1, score: 68, stage: "发现" };
    addAsset(generated);
  };

  const updateAsset = (originalName: string, asset: Asset) => {
    const next = userAssets.map((item) => item.name === originalName ? asset : item);
    setUserAssets(next);
    try { window.localStorage.setItem("elfred-assets-v2", JSON.stringify(next)); } catch { /* no-op */ }
    setDetail({ kind: "asset", asset });
  };

  const startTrial = (task: TaskItem) => {
    setTrialTask(task.title);
    setAgentTask(task);
    setAgentState("scouting");
    setAgentWorkbenchOpen(true);
    setDetail(null);
  };

  const queueOpportunity = (task: TaskItem) => {
    setTrialTask(task.title);
    setAgentTask(task);
    setAgentState("scouting");
    setDetail(null);
  };

  const acceptAgentDecision = () => {
    if (!agentTask) return;
    setGoldenProject({ id: `project-${agentTask.id}`, title: agentTask.title, progress: 38, state: "active", next: "确认最终交付边界", owner: "Harisen + Elfred + Emily PA", sourceTaskId: agentTask.id });
    setAgentState("accepted");
    setAgentWorkbenchOpen(false);
    setTab("a2a");
    setA2AScheduleOpen(true);
  };

  const rejectAgentDecision = () => {
    setAgentState("idle");
    setAgentTask(null);
    setAgentWorkbenchOpen(false);
    setTrialTask("");
    setTab("a2a");
  };

  const completeGoldenProject = () => {
    if (!goldenProject) return;
    setGoldenProject({ ...goldenProject, progress: 100, state: "done", next: "Outcome 已验证，Evidence 已回流" });
    setAgentState("done");
    const next = userAssets.map((item) => item.name === "品牌策略工作坊" ? { ...item, calls: item.calls + 1, score: Math.min(100, (item.score ?? 0) + 2), stage: "稳定交付" as const } : item);
    setUserAssets(next);
    try { window.localStorage.setItem("elfred-assets-v2", JSON.stringify(next)); } catch { /* no-op */ }
  };

  const switchTab = (id: Tab) => { setDetail(null); setA2AScheduleOpen(false); setTab(id); };

  const contextualFlow = (): CreatorFlow => {
    if (tab === "knowledge") return "生成 Skill";
    if (tab === "a2a" && a2aContext === "community") return "发帖子";
    if (tab === "a2a") return "建任务";
    if (tab === "messages") return "找人";
    return "记下来";
  };
  const beginElfredPress = () => {
    elfredLongPressed.current=false;
    window.clearTimeout(elfredPressTimer.current);
    elfredPressTimer.current=window.setTimeout(()=>{
      elfredLongPressed.current=true;
      setPersonalAgentFlow(contextualFlow());
      setPersonalAgentOpen(true);
    },560);
  };
  const finishElfredPress = () => {
    window.clearTimeout(elfredPressTimer.current);
    if(!elfredLongPressed.current){setPersonalAgentFlow(null);setPersonalAgentOpen(true)}
  };

  useEffect(() => {
    appScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [tab, detail, a2aScheduleOpen]);

  if (!mounted || !product.ready) {
    return <DeviceFrame label="Elfred 正在启动"><div className="statusbar" aria-hidden="true"><span>9:41</span><span className="status-icons"><i/><i/><b/></span></div><div className="boot-screen"><span><Sparkles size={22}/></span><strong>Elfred</strong><p>正在准备你的个人智能体</p><i/></div></DeviceFrame>;
  }

  if (!product.state.complete) {
    return <DeviceFrame label="Elfred 注册与新手初始化"><div className="statusbar" aria-hidden="true"><span>9:41</span><span className="status-icons"><i/><i/><b/></span></div><Onboarding/></DeviceFrame>;
  }

  return (
    <DeviceFrame label="Elfred 移动端应用">
        <div className="statusbar" aria-hidden="true"><span>9:41</span><span className="status-icons"><i /><i /><b /></span></div>
        <div className="app-scroll" ref={appScrollRef}>
          {detail && <DetailView detail={detail} onBack={()=>setDetail(null)} onAddAsset={addAsset} onUpdateAsset={updateAsset} onGoAgent={startTrial} onLogout={product.logout}/>}
          {!detail && tab === "knowledge" && <Knowledge items={userAssets} onOpen={(asset)=>setDetail({kind:"asset",asset})} onGenerate={generateSkill}/>} 
          {!detail && tab === "a2a" && !a2aScheduleOpen && <A2A onOpenTask={(task)=>setDetail({kind:"task",task})} onOpenTopic={(topic)=>setDetail({kind:"topic",topic})} onOpenQuickChat={setQuickChat} onRun={queueOpportunity} onOpenWorkbench={()=>setAgentWorkbenchOpen(true)} onOpenSchedule={()=>setA2AScheduleOpen(true)} onContextChange={setA2AContext} agentState={agentState} agentTask={agentTask}/>} 
          {!detail && tab === "a2a" && a2aScheduleOpen && <Schedule agentState={agentState} activeProject={goldenProject} onOpenWorkbench={()=>setAgentWorkbenchOpen(true)} onCompleteProject={completeGoldenProject} onBack={()=>setA2AScheduleOpen(false)}/>} 
          {!detail && tab === "messages" && <Messages trialTask={trialTask} onOpenChat={(conversation)=>setDetail({kind:"chat",conversation})}/>}
          {!detail && tab === "profile" && <Profile items={userAssets} onSettings={()=>setDetail({kind:"settings"})}/>}
        </div>
        {!detail && tab === "a2a" && !a2aScheduleOpen && a2aContext === "market" && <button className={`home-agent-player home-agent-player-fixed state-${agentState}`} onClick={()=>setAgentPlayerOpen(true)}><span className="home-player-cover"><Bot size={17}/><i/></span><span className="home-player-copy"><small>{agentState==="idle"?"Agent 空闲":"Agent 正在推进"}</small><strong>{agentTask?.title??"点击查看任务播放器"}</strong></span><span className="home-player-progress"><i style={{width:agentState==="idle"?"0%":agentState==="decision"?"100%":"68%"}}/></span><span className="home-player-play">{agentState==="scouting"?<Pause size={16}/>:<Play size={16}/>}</span><ListChecks size={17}/></button>}
        {!detail && <nav className="tabbar tabbar-split" aria-label="主导航">
          <div className="tabbar-primary-group">
          {nav.map(({ id, label, icon: Icon }) => (
            <button key={id} aria-label={label} title={label} className={`${tab === id ? "active" : ""} ${id === "a2a" ? "tab-primary" : ""}`} onClick={() => switchTab(id)}>
              <span className="tab-icon"><Icon size={22} strokeWidth={tab === id ? 2.1 : 1.65} />{id === "messages" && <i />}</span>
            </button>
          ))}
          </div>
          <button className={`personal-agent-tab state-${agentState}`} onPointerDown={beginElfredPress} onPointerUp={finishElfredPress} onPointerCancel={()=>window.clearTimeout(elfredPressTimer.current)} onPointerLeave={()=>window.clearTimeout(elfredPressTimer.current)} onContextMenu={(event)=>event.preventDefault()} aria-label="打开 Personal Agent；长按进入当前页面创建入口"><span className="tab-icon"><Sparkles size={21}/><i/></span></button>
        </nav>}
        {quickChat&&<QuickChatSheet name={quickChat.name} kind={quickChat.kind} onClose={()=>setQuickChat(null)} onExpand={()=>{setDetail({kind:"chat",conversation:{type:quickChat.kind,name:quickChat.name,message:"我们可以先从目标和边界开始对齐。",time:"刚刚",unread:0,tone:"blue"}});setQuickChat(null)}}/>}
        {personalAgentOpen && <PersonalAgentSheet initialFlow={personalAgentFlow} contextLabel={detail ? "当前详情" : a2aScheduleOpen ? "任务与日程" : tab === "a2a" ? a2aContext === "community" ? "社区" : "首页机会世界" : tab === "knowledge" ? "知识库" : tab === "messages" ? "消息与协作" : "个人可信身份"} onClose={()=>{setPersonalAgentOpen(false);setPersonalAgentFlow(null)}}/>} 
        {agentPlayerOpen && <AgentExecutionPlayer state={agentState} task={agentTask} onClose={()=>setAgentPlayerOpen(false)} onOpenWorkbench={()=>{setAgentPlayerOpen(false);setAgentWorkbenchOpen(true)}}/>}
        {agentWorkbenchOpen && <AgentWorkbench state={agentState} task={agentTask} project={goldenProject} onClose={()=>setAgentWorkbenchOpen(false)} onAccept={acceptAgentDecision} onReject={rejectAgentDecision} onGoAction={()=>{setAgentWorkbenchOpen(false);setTab("a2a");setA2AScheduleOpen(true)}}/>}
    </DeviceFrame>
  );
}
