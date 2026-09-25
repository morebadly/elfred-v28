"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  CircleSlash,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { Screen } from "../../../core/screen";
import { AppHeader } from "../../../legacy/legacy-ui";
import {
  clearEvidenceVerdict,
  readPage2,
  setEvidenceVerdict,
  setPendingCard,
} from "../api/page2-store";
import { readEvidence } from "../data/knowledge-data";
import { pushVerdict } from "../api/page2-api";
import styles from "../styles/knowledge.module.css";

// 成果详情：以前点一条成果给的是"用户访谈提纲"知识卡，文不对题。
// 这一屏回答四件事：这是什么 · 从哪来 · 改变了什么 · 我能怎么办。
export function EvidenceDetailPage({
  id,
  go,
  onBack,
}: {
  id: string;
  go: (screen: Screen) => void;
  onBack: () => void;
}) {
  const store = readPage2();
  const [state, setState] = useState<"idle" | "confirmed" | "disputed" | "forgotten">(
    store.verdicts[id] ?? "idle",
  );
  const record = readEvidence(id);
  // 裁定这条成果：后端在跑就交给它重算（它会回新的卡片分数），
  // 后端够不着就退回本地那套（前端自己扣分）。两条路都给同一个结果。
  const judge = (verdict: "confirmed" | "disputed" | "forgotten") => {
    setEvidenceVerdict(id, verdict);
    void pushVerdict(id, verdict);
  };

  if (!record) {
    return (
      <main className="v277-page">
        <AppHeader title="成果" onBack={onBack} />
        <div className={styles.screen}>
          <p className={styles.empty}>这条成果已经不在了</p>
        </div>
      </main>
    );
  }

  if (state === "forgotten") {
    return (
      <main className="v277-page">
        <AppHeader title="成果" onBack={onBack} />
        <div className={styles.screen}>
          <p className={styles.empty}>
            已忘掉这条成果，它会从这张卡的数字里扣掉。
          </p>
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => {
              clearEvidenceVerdict(id);
              void pushVerdict(id, "confirmed");
              setState("idle");
            }}
          >
            撤销，让它重新算数
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="v277-page">
      <AppHeader
        title="成果详情"
        // agent 为空时别写成"由  写入"（后端在某些卡片上确实给不出署名）
        subtitle={
          record.agent
            ? `${record.day} ${record.time} · 由 ${record.agent} 写入`
            : `${record.day} ${record.time}`
        }
        onBack={onBack}
      />
      <div className={styles.screen}>
        <section className={styles.block}>
          <h3>
            {record.title}
            {record.verified && (
              <small>
                <BadgeCheck size={13} /> 已验收
              </small>
            )}
          </h3>
          <div className={styles.chips}>
            <span>{record.kindLabel}</span>
            <span>{record.weightLabel}</span>
          </div>
        </section>

        <section className={styles.block}>
          <h3>来源</h3>
          <button
            type="button"
            className={styles.sourceRow}
            onClick={() =>
              go(
                record.source.ref.kind === "task"
                  ? { name: "task", id: record.source.ref.id }
                  : { name: "chat", id: record.source.ref.id },
              )
            }
          >
            <span>
              <b>{record.source.label}</b>
              <small>{record.source.note}</small>
            </span>
            <ArrowUpRight size={16} />
          </button>
        </section>

        <section className={styles.block}>
          <h3>原始摘要</h3>
          <p className={styles.quote}>{record.summary}</p>
        </section>

        <section className={styles.block}>
          <h3>
            带来了什么变化
            <small>
              {record.impacts.length === 0 ? "没有影响卡片" : "影响的能力卡"}
            </small>
          </h3>
          {record.impacts.map((impact) => (
            <div className={styles.impactRow} key={impact.card}>
              {/* 卡名可点：点了直接回到知识库并打开那张卡（以前只是回列表，不定位） */}
              <button
                type="button"
                className={styles.impactCard}
                onClick={() => {
                  setPendingCard(impact.card);
                  go({ name: "knowledge" });
                }}
              >
                {impact.card}
                <ArrowUpRight size={13} />
              </button>
              <span>
                {impact.score && (
                  <em>
                    能力分 {impact.score.from} → {impact.score.to}
                  </em>
                )}
                {impact.evidence && (
                  <em>
                  成果 {impact.evidence.from} → {impact.evidence.to}
                  </em>
                )}
                {impact.upgraded && (
                  <em className={styles.upgrade}>
                    <Sparkles size={12} />
                    {impact.upgraded}
                  </em>
                )}
              </span>
            </div>
          ))}
          {record.note && <p className={styles.note}>{record.note}</p>}
          {/* 裁定之后要看得见"真的退回去了多少"——不然按钮只是个装饰 */}
          {state !== "idle" && state !== "confirmed" && (
            <p className={styles.note}>
              待核对期间：
              {record.impacts
                .flatMap((impact) => {
                  const parts: string[] = [];
                  if (impact.score)
                    parts.push(
                      `${impact.card} 能力分 ${impact.score.to} → ${impact.score.from}`,
                    );
                  if (impact.evidence)
                    parts.push(
                      `${impact.card} 成果 ${impact.evidence.to} → ${impact.evidence.from}`,
                    );
                  return parts;
                })
                .join(" · ") || "这条没有牵动卡片数字"}
            </p>
          )}
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => {
              const first = record.impacts[0];
              if (first) setPendingCard(first.card);
              go({ name: "knowledge" });
            }}
          >
            {record.impacts[0]
              ? `去卡组看「${record.impacts[0].card}」`
              : "去能力卡组看看"}
          </button>
        </section>

        <section className={styles.block}>
          <h3>我能怎么办</h3>
          <div className={styles.actions}>
            <button
              type="button"
              className={state === "confirmed" ? styles.actionOn : undefined}
              onClick={() => {
                setState("confirmed");
                judge("confirmed");
              }}
            >
              <BadgeCheck size={16} />
              {state === "confirmed" ? "已确认" : "确认这条"}
            </button>
            <button
              type="button"
              className={state === "disputed" ? styles.actionOn : undefined}
              onClick={() => {
                setState("disputed");
                judge("disputed");
              }}
            >
              <CircleSlash size={16} />
              {state === "disputed" ? "已标记待核对" : "这条不对"}
            </button>
            <button
              type="button"
              onClick={() => {
                onBack();
                go({ name: "new-task" });
              }}
            >
              <RotateCcw size={16} />
              再跑一次
            </button>
            <button
              type="button"
              className={styles.danger}
              onClick={() => {
                setState("forgotten");
                judge("forgotten");
              }}
            >
              <Trash2 size={16} />
              忘掉它
            </button>
          </div>
          {state === "disputed" && (
            <p className={styles.note}>
              已标记：Elfred 会重新核对这条成果的来源，核对期间它不再参与评分。
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
