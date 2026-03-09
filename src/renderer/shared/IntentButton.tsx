import type { SetupIntent } from "../app/model";

interface IntentButtonProps {
  intent: SetupIntent;
  fallbackLabel: string;
  variant?: "primary" | "secondary";
  executeIntent: (intent: SetupIntent) => Promise<void> | void;
  isIntentDisabled: (intent: SetupIntent) => boolean;
  resolveIntentLabel: (intent: SetupIntent, fallbackLabel: string) => string;
}

export default function IntentButton({
  intent,
  fallbackLabel,
  variant = "secondary",
  executeIntent,
  isIntentDisabled,
  resolveIntentLabel,
}: IntentButtonProps) {
  return (
    <button
      className={variant === "primary" ? "primary-button" : "ghost-button"}
      disabled={isIntentDisabled(intent)}
      onClick={() => void executeIntent(intent)}
    >
      {resolveIntentLabel(intent, fallbackLabel)}
    </button>
  );
}
