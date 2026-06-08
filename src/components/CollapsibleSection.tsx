import type { ReactNode } from "react";
import Panel from "../ui/primitives/Panel";

interface Props {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export default function CollapsibleSection({ title, defaultOpen = false, children }: Props) {
  return (
    <Panel title={title} defaultOpen={defaultOpen} variant="section">
      {children}
    </Panel>
  );
}
