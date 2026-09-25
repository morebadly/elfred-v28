"use client";

// Persist a draft through the shared authenticated task service.

import type { Dispatch, SetStateAction } from "react";
import type { V277AgentId, V277State } from "../../../../v27-7-state";
import { createPage2Task } from "./page2-api";

export async function draftTask(
  setState: Dispatch<SetStateAction<V277State>>,
  draft: {
    title: string;
    brief: string;
    source: string;
    agent: V277AgentId;
    knowledgeIds?: string[];
  },
) {
  void setState;
  const result = await createPage2Task(draft);
  return (result as { id: string }).id;
}
