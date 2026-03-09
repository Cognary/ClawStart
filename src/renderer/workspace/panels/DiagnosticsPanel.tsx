import type { DerivedAppModel, IntentControls } from "../../app/model";
import DiagnosticsList from "../../shared/DiagnosticsList";

interface DiagnosticsPanelProps {
  model: DerivedAppModel;
  controls: IntentControls;
}

export default function DiagnosticsPanel({ model, controls }: DiagnosticsPanelProps) {
  return (
    <DiagnosticsList
      diagnostics={model.diagnostics}
      controls={controls}
      emptyTitle="当前没有明显阻塞项"
      emptyBody="维护台只保留真正需要处理的问题；没有问题时就不制造噪音。"
    />
  );
}
