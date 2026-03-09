import type { DerivedAppModel, IntentControls } from "../../app/model";
import ConfigEditorPanel from "../../shared/ConfigEditorPanel";

interface ConfigPanelProps {
  model: DerivedAppModel;
  configDraft: string;
  setConfigDraft: (next: string) => void;
  configDirty: boolean;
  controls: IntentControls;
}

export default function ConfigPanel({ model, configDraft, setConfigDraft, configDirty, controls }: ConfigPanelProps) {
  return (
    <ConfigEditorPanel
      configState={model.configState}
      configDraft={configDraft}
      setConfigDraft={setConfigDraft}
      configDirty={configDirty}
      controls={controls}
    />
  );
}
