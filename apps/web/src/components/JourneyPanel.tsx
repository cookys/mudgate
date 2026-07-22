import { useCallback, useEffect, useState } from "react";
import type { Journey, NavStore } from "@mudgate/nav-memory";

export type JourneyStepRequest = {
  cmd: string;
  journeyId: string;
  stepIndex: number;
  total: number;
};

type Props = {
  store: NavStore;
  profileKey: string;
  recordingId: string | null;
  onRecordingId: (id: string | null) => void;
  replay: { journeyId: string; step: number } | null;
  onReplay: (r: { journeyId: string; step: number } | null) => void;
  /**
   * Parent sends cmd and owns move-fail / title settle gate (C1.2).
   * Must NOT advance step here — parent calls onReplay after settle.
   */
  onRequestStep: (req: JourneyStepRequest) => void;
  /** true while waiting for mud settle after next */
  stepPending?: boolean;
  stopReason?: string | null;
  labels: {
    title: string;
    record: string;
    stop: string;
    play: string;
    next: string;
    stopPlay: string;
    del: string;
    export: string;
    import: string;
    empty: string;
    experimental: string;
    stopped?: string;
  };
};

export function JourneyPanel({
  store,
  profileKey,
  recordingId,
  onRecordingId,
  replay,
  onReplay,
  onRequestStep,
  stepPending = false,
  stopReason = null,
  labels,
}: Props) {
  const [list, setList] = useState<Journey[]>([]);
  const [name, setName] = useState("");

  const reload = useCallback(async () => {
    setList(await store.listJourneys(profileKey));
  }, [store, profileKey]);

  useEffect(() => {
    void reload();
  }, [reload, recordingId, replay]);

  const startRecord = async () => {
    const j = await store.putJourney({
      name: name.trim() || `journey-${Date.now().toString(36)}`,
      profileKey,
      steps: [],
    });
    onRecordingId(j.id);
    setName("");
    await reload();
  };

  const stopRecord = () => onRecordingId(null);

  const startPlay = (id: string) => {
    onReplay({ journeyId: id, step: 0 });
  };

  const sendNext = async () => {
    if (!replay || stepPending) return;
    const j = await store.getJourney(replay.journeyId);
    if (!j) {
      onReplay(null);
      return;
    }
    const step = j.steps[replay.step];
    if (!step) {
      onReplay(null);
      return;
    }
    onRequestStep({
      cmd: step.cmd,
      journeyId: replay.journeyId,
      stepIndex: replay.step,
      total: j.steps.length,
    });
  };

  const doExport = async (id: string) => {
    const j = await store.getJourney(id);
    if (!j) return;
    const text = store.exportJourneyJson(j);
    try {
      await navigator.clipboard?.writeText(text);
    } catch {
      /* ignore */
    }
  };

  const doImport = async () => {
    const raw = window.prompt("Paste journey JSON");
    if (!raw) return;
    await store.importJourneyJson(profileKey, raw);
    await reload();
  };

  return (
    <div className="border-t px-2 py-1.5 space-y-1 text-[10px]" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between gap-1">
        <span className="font-medium" style={{ color: "var(--text-dim)" }}>
          {labels.title}
        </span>
        <span style={{ color: "var(--text-faint)" }}>{labels.experimental}</span>
      </div>
      <div className="flex gap-1">
        <input
          className="flex-1 min-w-0 rounded border px-1 py-0.5 bg-transparent"
          style={{ borderColor: "var(--border)", color: "var(--text)" }}
          value={name}
          placeholder="name"
          onChange={(e) => setName(e.target.value)}
        />
        {recordingId ? (
          <button type="button" className="px-1 rounded border" style={{ borderColor: "var(--border)" }} onClick={stopRecord}>
            {labels.stop}
          </button>
        ) : (
          <button type="button" className="px-1 rounded border" style={{ borderColor: "var(--border)" }} onClick={() => void startRecord()}>
            {labels.record}
          </button>
        )}
        <button type="button" className="px-1 rounded border" style={{ borderColor: "var(--border)" }} onClick={() => void doImport()}>
          {labels.import}
        </button>
      </div>
      {replay && (
        <div className="flex gap-1 items-center flex-wrap">
          <span style={{ color: "var(--accent)" }}>
            step {replay.step + 1}
            {stepPending ? " …" : ""}
          </span>
          <button
            type="button"
            className="px-1 rounded border"
            style={{ borderColor: "var(--border)" }}
            disabled={stepPending}
            onClick={() => void sendNext()}
          >
            {labels.next}
          </button>
          <button type="button" className="px-1 rounded border" style={{ borderColor: "var(--border)" }} onClick={() => onReplay(null)}>
            {labels.stopPlay}
          </button>
        </div>
      )}
      {stopReason && (
        <p style={{ color: "#e06c75" }} data-testid="journey-stop-reason">
          {labels.stopped ?? "stopped"}: {stopReason}
        </p>
      )}
      {list.length === 0 ? (
        <p style={{ color: "var(--text-faint)" }}>{labels.empty}</p>
      ) : (
        <ul className="space-y-0.5 max-h-24 overflow-auto">
          {list.map((j) => (
            <li key={j.id} className="flex gap-1 items-center">
              <span className="flex-1 truncate" style={{ color: "var(--text-dim)" }}>
                {j.name} ({j.steps.length})
              </span>
              <button type="button" className="px-0.5" onClick={() => startPlay(j.id)}>
                {labels.play}
              </button>
              <button type="button" className="px-0.5" onClick={() => void doExport(j.id)}>
                {labels.export}
              </button>
              <button
                type="button"
                className="px-0.5"
                style={{ color: "#e06c75" }}
                onClick={() => void store.deleteJourney(j.id).then(reload)}
              >
                {labels.del}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
