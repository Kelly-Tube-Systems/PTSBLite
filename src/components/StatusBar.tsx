import { activeToolLabel, toolShowsElevation } from "@/components/active-tool";
import { Icons } from "@/components/Icons";
import { useReadyPulse } from "@/components/ready-pulse";
import { ValidationSummary } from "@/components/ValidationSummary";
import { totalPathLength } from "@/domain/parts";
import { MAX_CENTERLINE_FEET } from "@/domain/validation";
import type { DesignState, ToolId, Warning } from "@/types";
import "@/components/StatusBar.css";

export type StatusBarProps = {
  design: DesignState;
  warnings: Warning[];
  expanded: boolean;
  onToggle: () => void;
  /** Opens the Finalize dialog, which is where the bill of materials lives.
   * Anchored here rather than in the top bar, where Auto-Build now sits — the
   * client asked for the two to trade places. */
  onFinalize: () => void;
  /** The armed tool, read out in the rail's empty middle (ADR-0048). */
  tool: ToolId;
  /** Y of the active placement plane, shown so the elevation keys are not blind. */
  elevation: number;
  /** Which floor that plane is on, or null for a single-floor design. */
  floor: 1 | 2 | null;
};

export function StatusBar({
  design,
  warnings,
  expanded,
  onToggle,
  onFinalize,
  tool,
  elevation,
  floor
}: StatusBarProps) {
  const errors = warnings.filter((w) => w.level === "error").length;
  const warns = warnings.filter((w) => w.level === "warn").length;
  const len = totalPathLength(design);
  const okState = warnings.length === 0 && design.parts.length > 0;
  const state = okState ? "ok" : errors ? "error" : warns ? "warn" : "none";
  const pulse = useReadyPulse(okState);
  return (
    <div className="status-bar nosel">
      {expanded && warnings.length > 0 && (
        <div className="status-bar__validation">
          <ValidationSummary warnings={warnings} />
        </div>
      )}

      <div className="status-bar__row">
        <button className="status-bar__toggle" data-state={state} onClick={onToggle}>
          <span className="status-bar__dot" />
          <span className="status-bar__state-label">
            {okState
              ? "All checks pass"
              : warnings.length === 0
                ? "No system yet"
                : `${warnings.length} issue${warnings.length === 1 ? "" : "s"}`}
          </span>
          {warnings.length > 0 &&
            (expanded ? <Icons.ChevD size={13} /> : <Icons.ChevU size={13} />)}
        </button>

        <Sep />
        <Meta
          label="LENGTH"
          value={`${len.toFixed(1)}ft`}
          hint={`/ ${MAX_CENTERLINE_FEET}`}
          used={len}
          capacity={MAX_CENTERLINE_FEET}
        />
        <Sep />
        <Meta label="PARTS" value={`${design.parts.length}`} />

        <div className="status-bar__spacer" />
        {/* The armed tool reads out here, in the empty stretch of rail the
            client pointed at, rather than in a box floating over the bottom of
            the viewport where the corner panels covered it (ADR-0048). It is
            written as the rail's own metadata — the same label, value and
            separator as LENGTH and PARTS — because that is what it is. The
            spacer either side centres it in whatever the rail has spare, and
            the whole group is absent under the cursor tool, which places
            nothing. */}
        {tool !== "cursor" && (
          <>
            <Meta name="tool" label="TOOL" value={activeToolLabel(tool)} />
            {toolShowsElevation(tool) && (
              <>
                <Sep />
                <Meta
                  name="elevation"
                  label="EL"
                  value={`${elevation} ft`}
                  hint={floor !== null ? `· Floor ${floor}` : undefined}
                  accent
                />
              </>
            )}
            <div className="status-bar__spacer" />
          </>
        )}
        {/* The same state drives Finalize, so the button goes green at exactly
            the moment the label beside it says the checks pass. It stays
            clickable in every state: a design that is still short of valid is
            when you most want the dialog's issue list. Passing also starts it
            pulsing, the same tell Auto-Build and the obstacle strip give when
            they become usable, and it pulses until someone presses it. */}
        <button
          type="button"
          className={`status-bar__finalize${pulse.pulsing ? " ready-pulse" : ""}`}
          data-state={state}
          onClick={() => {
            pulse.dismiss();
            onFinalize();
          }}
        >
          <Icons.Bom size={18} /> Finalize
        </button>
      </div>
    </div>
  );
}

function Sep() {
  return <div className="status-bar__sep" />;
}

function Meta({
  label,
  value,
  hint,
  used,
  capacity,
  name,
  accent = false
}: {
  label: string;
  value: string;
  hint?: string;
  used?: number;
  capacity?: number;
  /** Names the readout for the suites, which need this one and not its neighbours. */
  name?: string;
  /** For a value that changes under the keyboard and wants finding again. */
  accent?: boolean;
}) {
  const load =
    used !== undefined && capacity !== undefined
      ? used / capacity > 0.9
        ? "over"
        : used / capacity > 0.7
          ? "warn"
          : "ok"
      : null;
  return (
    <div className="status-bar__meta" data-meta={name}>
      <span className="status-bar__meta-label">{label}</span>
      <span className={`status-bar__meta-value${accent ? " status-bar__meta-value--accent" : ""}`}>
        {value}
      </span>
      {hint && <span className="status-bar__meta-hint">{hint}</span>}
      {used !== undefined && capacity !== undefined && (
        <progress
          className="status-bar__meta-meter"
          data-load={load}
          value={Math.min(used, capacity)}
          max={capacity}
          aria-label={`${label.toLowerCase()} used`}
        />
      )}
    </div>
  );
}
