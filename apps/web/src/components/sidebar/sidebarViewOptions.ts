import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import {
  resolveThreadActivityTimestamp,
  sortActiveThreadsByOrderKey,
  sortThreads,
} from "@t3tools/client-runtime/state/thread-sort";
import type { SidebarActiveSortOrder } from "@t3tools/contracts/settings";
import { msg } from "gt-react";

export const SIDEBAR_GROUP_BY_OPTIONS = [
  { value: "status", label: msg("Status", { $context: "sidebar group by" }) },
  { value: "project", label: msg("Project", { $context: "sidebar group by" }) },
] as const;

export const SIDEBAR_SORT_BY_OPTIONS = [
  { value: "updated_at", label: msg("Last updated", { $context: "sidebar sort by" }) },
  { value: "created_at", label: msg("Created", { $context: "sidebar sort by" }) },
  { value: "manual", label: msg("Manual", { $context: "sidebar sort by" }) },
] as const satisfies ReadonlyArray<{
  readonly value: SidebarActiveSortOrder;
  readonly label: unknown;
}>;

/** Orders the active threads; pinned, working, snoozed and settled keep their own orders. */
type ActiveSortInput = Pick<
  EnvironmentThreadShell,
  | "id"
  | "environmentId"
  | "createdAt"
  | "updatedAt"
  | "unsettledAt"
  | "latestRun"
  | "latestUserMessageAt"
  | "activeOrderKey"
>;

/** Orders the active threads; pinned, working, snoozed and settled keep their own orders. */
export function sortSidebarActiveThreads<T extends ActiveSortInput>(
  threads: readonly T[],
  sortOrder: SidebarActiveSortOrder,
): T[] {
  switch (sortOrder) {
    case "manual":
      return sortActiveThreadsByOrderKey(threads);
    case "created_at":
      return sortThreads(threads, "created_at");
    case "updated_at":
      // The time each row shows, so the list reads in order.
      return sortByActivity(threads);
  }
}

function sortByActivity<T extends ActiveSortInput>(threads: readonly T[]): T[] {
  const activityMs = new Map(
    threads.map((thread) => [
      thread,
      Date.parse(resolveThreadActivityTimestamp(thread) ?? "") || 0,
    ]),
  );
  return [...threads].sort(
    (left, right) =>
      activityMs.get(right)! - activityMs.get(left)! ||
      left.id.localeCompare(right.id) ||
      left.environmentId.localeCompare(right.environmentId),
  );
}
