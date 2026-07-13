import type { AdapterEnvironmentTestResult } from "@paperclipai/shared";
import { Button } from "@/components/ui/button";
import { AdapterEnvironmentResult } from "./AgentConfigForm";

interface NewAgentFooterProps {
  readonly createPending: boolean;
  readonly formError: string | null;
  readonly isFirstAgent: boolean;
  readonly name: string;
  readonly testAction: (() => void) | null;
  readonly testAgentFeedback: {
    readonly errorMessage: string | null;
    readonly result: AdapterEnvironmentTestResult | null;
  };
  readonly testAgentState: {
    readonly disabled: boolean;
    readonly pending: boolean;
  };
  readonly onCancel: () => void;
  readonly onSubmit: () => void;
}

export function NewAgentFooter({
  createPending,
  formError,
  isFirstAgent,
  name,
  testAction,
  testAgentFeedback,
  testAgentState,
  onCancel,
  onSubmit,
}: NewAgentFooterProps) {
  return (
    <div className="border-t border-border px-4 py-3">
      {isFirstAgent ? (
        <p className="mb-2 text-xs text-muted-foreground">This will be the CEO</p>
      ) : null}
      {formError ? (
        <p className="mb-2 text-xs text-destructive">{formError}</p>
      ) : null}
      <div className="space-y-3">
        {testAgentFeedback.errorMessage ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {testAgentFeedback.errorMessage}
          </div>
        ) : null}
        {testAgentFeedback.result ? (
          <AdapterEnvironmentResult result={testAgentFeedback.result} />
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={testAgentState.disabled}
              onClick={() => testAction?.()}
            >
              {testAgentState.pending ? "Testing..." : "Test Agent"}
            </Button>
            <Button
              size="sm"
              disabled={!name.trim() || createPending}
              onClick={onSubmit}
            >
              {createPending ? "Creating..." : "Create agent"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
