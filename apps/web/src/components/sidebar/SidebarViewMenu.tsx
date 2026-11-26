import { T, useGT, useMessages } from "gt-react";
import { ListFilterIcon } from "lucide-react";
import type { ReactNode } from "react";

import { updateClientSettings, useClientSettings } from "../../hooks/useSettings";
import {
  Menu,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRadioItemIndicator,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from "../ui/menu";
import { SidebarHeaderIconButton } from "./SidebarThreadHeader";
import { SIDEBAR_GROUP_BY_OPTIONS, SIDEBAR_SORT_BY_OPTIONS } from "./sidebarViewOptions";

/**
 * The sidebar header's view menu: Group by and Sort by write client settings, and the
 * Project submenu holds the project filter the sidebar builds.
 */
export function SidebarViewMenu(props: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly label: string;
  /** A project filter is on; the trigger shows a dot so the narrowed list never goes unexplained. */
  readonly filtered: boolean;
  readonly projectDetail: string;
  /** Called only while the Project submenu is open, so a closed menu costs the sidebar nothing. */
  readonly renderProjectMenu: () => ReactNode;
}) {
  const gt = useGT();
  const m = useMessages();
  const groupByProject = useClientSettings((settings) => settings.boringSidebarEnabled);
  const sortOrder = useClientSettings((settings) => settings.sidebarActiveSortOrder);
  return (
    <Menu open={props.open} onOpenChange={(open) => props.onOpenChange(open)}>
      <MenuTrigger render={<SidebarHeaderIconButton label={props.label} />}>
        <ListFilterIcon />
        {props.filtered ? (
          <span
            aria-hidden
            className="pointer-events-none absolute top-1 right-1 size-1.5 rounded-full bg-primary"
          />
        ) : null}
      </MenuTrigger>
      <MenuPopup align="start" collisionAvoidance={{ side: "flip", align: "shift" }}>
        <ViewRadioSubmenu
          label={gt("Group by")}
          value={groupByProject ? "project" : "status"}
          options={SIDEBAR_GROUP_BY_OPTIONS.map((option) => ({
            value: option.value,
            label: m(option.label),
          }))}
          onChange={(value) => {
            void updateClientSettings({ boringSidebarEnabled: value === "project" });
          }}
        />
        <ViewRadioSubmenu
          label={gt("Sort by")}
          value={sortOrder}
          options={SIDEBAR_SORT_BY_OPTIONS.map((option) => ({
            value: option.value,
            label: m(option.label),
          }))}
          onChange={(value) => {
            void updateClientSettings({ sidebarActiveSortOrder: value });
          }}
        />
        <MenuSub>
          <MenuSubTrigger>
            <span className="flex-1">
              <T>Project</T>
            </span>
            <span className="min-w-0 max-w-32 truncate text-xs text-muted-foreground">
              {props.projectDetail}
            </span>
          </MenuSubTrigger>
          <MenuSubPopup className="w-[min(18rem,var(--available-width))]">
            <RenderOnMount render={props.renderProjectMenu} />
          </MenuSubPopup>
        </MenuSub>
      </MenuPopup>
    </Menu>
  );
}

function RenderOnMount(props: { readonly render: () => ReactNode }) {
  return props.render();
}

function ViewRadioSubmenu<Value extends string>(props: {
  readonly label: string;
  readonly value: Value;
  readonly options: ReadonlyArray<{ readonly value: Value; readonly label: string }>;
  readonly onChange: (value: Value) => void;
}) {
  const current = props.options.find((option) => option.value === props.value);
  return (
    <MenuSub>
      <MenuSubTrigger>
        <span className="flex-1">{props.label}</span>
        <span className="min-w-0 max-w-32 truncate text-xs text-muted-foreground">
          {current?.label}
        </span>
      </MenuSubTrigger>
      <MenuSubPopup>
        <MenuRadioGroup
          value={props.value}
          onValueChange={(next) => {
            const option = props.options.find((candidate) => candidate.value === next);
            if (option && option.value !== props.value) props.onChange(option.value);
          }}
        >
          {props.options.map((option) => (
            <MenuRadioItem key={option.value} value={option.value}>
              <span className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                <MenuRadioItemIndicator />
              </span>
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuSubPopup>
    </MenuSub>
  );
}
