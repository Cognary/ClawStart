import type { DerivedAppModel } from "../../app/model";
import LogsPanelContent from "../../shared/LogsPanel";

interface LogsPanelProps {
  model: DerivedAppModel;
}

export default function LogsPanel({ model }: LogsPanelProps) {
  return <LogsPanelContent logs={model.logs} emptyMessage="还没有命令输出。开始执行 Doctor、Status、Dashboard 或 Gateway 后，这里会出现最近日志。" />;
}
