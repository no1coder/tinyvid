import { useEffect } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { useAppStore } from "@/stores/appStore";
import { useTaskStore } from "@/stores/taskStore";

/**
 * Recalculates estimations whenever settings or encoders change.
 * Should be called once in the root component.
 */
export function useEstimation() {
  const { config } = useSettingsStore();
  const { encoders } = useAppStore();
  const updateEstimations = useTaskStore((s) => s.updateEstimations);

  useEffect(() => {
    if (encoders.length > 0) {
      updateEstimations(config, encoders);
    }
  }, [config, encoders, updateEstimations]);
}
