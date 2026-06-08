import type { ReactNode } from "react";
import Panel from "../ui/primitives/Panel";

interface Props {
  title: string;
  defaultOpen?: boolean;
  testId: string;
  children: ReactNode;
}

export default function CollapsiblePanel({
  title,
  defaultOpen = true,
  testId,
  children,
}: Props) {
  return (
    <Panel
      title={title}
      defaultOpen={defaultOpen}
      testId={testId}
      variant="panel"
      stopPointerPropagation
    >
      {children}
    </Panel>
  );
}
