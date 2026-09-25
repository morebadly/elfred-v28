"use client";

import {
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  ChevronRight,
  Layers3,
  Sparkles,
} from "lucide-react";
import type { V277State } from "../../../../v27-7-state";
import type { Screen } from "../../../core/screen";
import { ProfileShareSheet } from "../../../legacy/legacy-ui";
import knowledgeStyles from "../styles/knowledge.module.css";
import {
  hasLiveAlignment,
  libraryHeader,
  abilityCardSamples,
  readAlignmentStage,
  readStage,
} from "../data/knowledge-data";
import { CapabilitySheet, type SheetCard } from "../parts/capability-sheet";
import { readPage2, setCardLevel, setPendingSkill } from "../api/page2-store";
import { draftTask } from "../api/task-draft";
import { launchWithSkill } from "../api/skill-launch";
import {
  fetchBadges,
  fetchFeed,
  usePage2Live,
  type LiveBadge,
  type LiveFeedItem,
} from "../api/page2-api";
import styles from "../styles/profile.module.css";

export function ProfilePage({
  state,
  setState,
  go,
  notify,
  initialShareOpen = false,
  runtime,
}: {
  state: V277State;
  setState: Dispatch<SetStateAction<V277State>>;
  go: (screen: Screen) => void;
  notify: (text: string) => void;
  /** 整合版由 app-shell 传入；只用来把「用它做一件事」的契约写进对话草稿。 */
  runtime?: unknown;
  initialShareOpen?: boolean;
}) {
  const profile = state.profile;
  // ⚠️ 必须订阅/启动第二页的数据：不然"先打开『我的』"时后端根本不会被调用，
  // 能力栏会一直显示本地演示卡（实测踩到）。usePage2Live 既启动加载又订阅变更。
  const page2 = usePage2Live();
  // 名字旁边那个胶囊跟"理解度"那条线（不是卡片等级）。
  // 后端没给理解度时按第一档显示——**不能拿演示兜底值当用户真等级**（新用户不是 Lv.4）。
  const level = hasLiveAlignment ? libraryHeader.level : 1;
  const stageName = readAlignmentStage(level);
  const [tab, setTab] = useState("动态");
  const [shareOpen, setShareOpen] = useState(initialShareOpen);
  // 能力 tab 里点开的那张卡（详情弹层和第二页那个是同一个组件）
  const [selectedCard, setSelectedCard] = useState<SheetCard | null>(null);
  // 改过等级之后要重画（等级存在 page2 的本地 store 里，不是 React state）
  const [cardVersion, setCardVersion] = useState(0);
  const cardStore = readPage2();
  const myCards = abilityCardSamples.map((card) => ({
    ...card,
    level: cardStore.levelOverride[card.title] ?? card.level,
  }));
  // ── 后端接线（第四页原来是纯本地状态：资料、动态、勋章都不落库）──
  // 读：进页面拉一次真资料/动态/勋章；写：本地改过的资料回到这一页时同步给后端。
  const [feed, setFeed] = useState<LiveFeedItem[] | null>(null);
  const [badges, setBadges] = useState<LiveBadge[] | null>(null);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const [liveFeed, liveBadges] = await Promise.all([
        fetchFeed(),
        fetchBadges(),
      ]);
      if (!alive) return;
      if (liveFeed?.items) setFeed(liveFeed.items);
      if (liveBadges?.badges) setBadges(liveBadges.badges);
    })();
    return () => {
      alive = false;
    };
  }, [page2.data]);
  return (
    <main className="v277-page v277-profile-page">
      <section
        className={`v277-profile-hero ${styles.hero}`}
        aria-label="我的个人主页"
      >
        {/* 背景：没有设置过就是待设置（不再拿一张假人照片顶上） */}
        <div className={styles.cover}>
          {/* 背景还没设置：一颗淡胶囊提示（原来居中的那行虚字太突兀） */}
          <span className={styles.coverHint}>设置背景</span>
        </div>
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
        {/* 编辑资料：原来那个可见的胶囊是画在贴图里的，现在自己画一个（点击区照旧） */}
        <button
          type="button"
          className={styles.editHit}
          aria-label="编辑资料"
          onClick={() => go({ name: "profile-edit" })}
        >
          编辑资料
        </button>
        {/* 头像 / 名字 / 简介 / 标签 / 数字：都读 state.profile，空就显示"待设置" */}
        <div className={styles.profileBlock}>
          <div className={styles.avatar} aria-label={profile.name ? "默认头像" : "还没有设置头像"}>
            {profile.name ? (
              profile.name.trim().slice(0, 1).toUpperCase()
            ) : (
              // 没有名字时的人形默认头像（行业做法，不用网图：不依赖网络、无版权问题）
              <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 12a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Zm0 2.1c-3.3 0-6.3 1.8-6.3 4v1.5h12.6v-1.5c0-2.2-3-4-6.3-4Z"
                />
              </svg>
            )}
          </div>
          <div className={styles.lines}>
            <h1>
              {profile.name || "还没有名字"}
              <span className={styles.levelChip}>Lv.{level} · {stageName}</span>
            </h1>
            {profile.username ? <p className={styles.handle}>@{profile.username}</p> : null}
            <p className={styles.bio}>
              {profile.bio || "点右侧「编辑资料」写下你是谁"}
            </p>
            <div className={styles.tags}>
              {profile.tags.length > 0 ? (
                profile.tags.map((tag) => <span key={tag}>{tag}</span>)
              ) : (
                <span className={styles.tagsEmpty}>+ 添加标签</span>
              )}
            </div>
            {/* 关注 / 粉丝 / 获赞：
                这三个数以前是写死在页面上的 0/0/0——后端 /page2/profile 里
                根本没有这三个字段，所以它永远只会是 0，属于"看着有数据其实是假的"。
                先整块撤掉，等后端真有计数（关注关系/被关注/被点赞）再放回来。
                相关样式 .stats 留在 profile.module.css 里，回填时直接用。 */}
          </div>
        </div>
      </section>
      <section className="v277-profile-body">
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
        {tab === "动态" ? (
          feed && feed.length > 0 ? (
            // 真数据：动态 = 后端把"真实成果 + 真实记忆"按时间合并后的流
            <ul className={styles.feed}>
              {feed.map((item) => (
                <li key={`${item.kind}-${item.id}`} className={styles.feedItem}>
                  <b>{item.title}</b>
                  {item.detail ? <p>{item.detail}</p> : null}
                  <span className={styles.feedMeta}>
                    {item.kind === "evidence" ? "成果" : "记忆"}
                    {item.count && item.count > 1 ? ` · 共 ${item.count} 次` : ""}
                    {item.at ? ` · ${item.at.replace("T", " ").slice(0, 16)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            // 空态：后端确实没有动态时才这么显示（原来这里硬编码过一条假动态）
            <section className={knowledgeStyles.emptyBlock}>
              <i className={knowledgeStyles.emptyBlockIcon}>
                <Sparkles size={26} />
              </i>
              <b>还没有动态</b>
              <p>你做过的事被验收之后，会在这里留下一条</p>
            </section>
          )
        ) : tab === "能力" ? (
          /* 第四页的"能力"这一栏以前只是一张"去知识库看看"的跳转卡 ——
             那等于第四页什么都看不见。现在直接把用户的能力卡摆在这里，
             点开就是第二页那张详情（同一个 CapabilitySheet，同一份数据）。 */
          myCards.length > 0 ? (
            <ul className={styles.cardList}>
              {myCards.map((card) => {
                const Icon = card.icon;
                return (
                  <li key={card.title}>
                    <button
                      type="button"
                      onClick={() => setSelectedCard(card)}
                      aria-label={`${card.title}：${card.type}，Lv.${card.level} ${readStage(card.level)}`}
                    >
                      <i>
                        <Icon size={18} />
                      </i>
                      <span>
                        <b>{card.title}</b>
                        <small>
                          {card.type} · Lv.{card.level} {readStage(card.level)}
                        </small>
                      </span>
                      <em>{card.notRunYet ? (card.evidence ? "待评估" : "证据不足") : card.score}</em>
                      <ChevronRight size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <section className={knowledgeStyles.emptyBlock}>
              <i className={knowledgeStyles.emptyBlockIcon}>
                <Layers3 size={26} />
              </i>
              <b>还没有能力卡</b>
              <p>你让 Agent 干成的事，会沉淀成一张张能力卡</p>
            </section>
          )
        ) : (
          <button
            type="button"
            className="v277-profile-tab-card"
            onClick={() => go({ name: "utility", kind: "honors" })}
          >
            <span>
              <Sparkles size={24} />
            </span>
            <h2>成长勋章</h2>
            <p>
              {badges
                ? `已获得 ${badges.filter((badge) => badge.earned).length}/${badges.length} 枚，点击查看荣誉。`
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
      {selectedCard && (
        <CapabilitySheet
          key={cardVersion}
          card={selectedCard}
          go={go}
          onClose={() => setSelectedCard(null)}
          onOpenEvidence={(evidenceId) => {
            setSelectedCard(null);
            go({ name: "evidence-detail", id: evidenceId });
          }}
          onOpenEvidenceList={() => {
            setSelectedCard(null);
            go({ name: "evidence" });
          }}
          onCreateTask={async (card, goal) => {
            // 和知识库那边一致：带着这张 skill 的任务契约，建一条**真任务**。
            // 原来只跳对话，而对话页没有会话对象，什么都发不出去。
            const result = await launchWithSkill(runtime, card.title, goal);
            if (result.ok && result.system && result.prompt) {
              setSelectedCard(null);
              go({ name: "chat", id: result.system, prefill: result.prompt });
              return { ok: true };
            }
            return { ok: false, note: result.note };
          }}
          tasks={state.tasks}
          onUpgrade={(card) => {
            setCardLevel(card.title, card.level + 1);
            setCardVersion((version) => version + 1);
            setSelectedCard({ ...card, level: card.level + 1 });
          }}
        />
      )}
    </main>
  );
}
