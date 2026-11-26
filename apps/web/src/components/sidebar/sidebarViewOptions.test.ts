import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { sortSidebarActiveThreads } from "./sidebarViewOptions";

const environmentId = EnvironmentId.make("environment-local");

function thread(
  id: string,
  input: { createdAt: string; lastSentAt: string | null; orderKey: string },
) {
  return {
    id: ThreadId.make(id),
    environmentId,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    unsettledAt: null,
    latestRun: null,
    latestUserMessageAt: input.lastSentAt,
    activeOrderKey: input.orderKey,
  };
}

describe("sortSidebarActiveThreads", () => {
  const threads = [
    thread("old-sent-recently", {
      createdAt: "2026-03-01T09:00:00.000Z",
      lastSentAt: "2026-03-09T12:00:00.000Z",
      orderKey: "k2",
    }),
    thread("newest", {
      createdAt: "2026-03-09T10:00:00.000Z",
      lastSentAt: null,
      orderKey: "k3",
    }),
    thread("arranged-first", {
      createdAt: "2026-03-05T09:00:00.000Z",
      lastSentAt: null,
      orderKey: "k1",
    }),
  ];

  it.each([
    { sortOrder: "manual", expected: ["arranged-first", "old-sent-recently", "newest"] },
    { sortOrder: "created_at", expected: ["newest", "arranged-first", "old-sent-recently"] },
    // By the activity time each row shows, whatever the thread's age.
    { sortOrder: "updated_at", expected: ["old-sent-recently", "newest", "arranged-first"] },
  ] as const)("$sortOrder", ({ sortOrder, expected }) => {
    expect(sortSidebarActiveThreads(threads, sortOrder).map((entry) => entry.id)).toEqual(expected);
  });
});
