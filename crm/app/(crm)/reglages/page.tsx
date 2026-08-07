import { SettingsView } from "@/components/settings/settings-view";
import { listSequences } from "@/lib/api/sequences";

export const dynamic = "force-dynamic";

export default async function ReglagesPage() {
  const sequences = await listSequences();

  return (
    <SettingsView
      sequences={sequences.map((sequence) => ({
        id: sequence.id,
        name: sequence.name,
        trigger: sequence.trigger,
        active: sequence.active,
        steps: sequence.steps.map((step) => ({
          day: step.day,
          channel: step.channel,
          label: step.label,
        })),
      }))}
    />
  );
}
