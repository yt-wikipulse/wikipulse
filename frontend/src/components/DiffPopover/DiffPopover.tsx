import type { HexagonEvent } from "../../api/hexagons";
import { useWikiDiff } from "../../features/wiki-diff/useWikiDiff";
import { DiffPopoverView } from "./DiffPopoverView";

type DiffPopoverProps = {
  event: HexagonEvent;
  openedAt: number;
  onClose?: () => void;
};

export function DiffPopover({ event, openedAt, onClose }: DiffPopoverProps) {
  const { diff, loading, error, retry } = useWikiDiff(event);

  return (
    <DiffPopoverView
      event={event}
      openedAt={openedAt}
      diff={diff}
      loading={loading}
      error={error}
      onRetry={retry}
      onClose={onClose}
    />
  );
}
