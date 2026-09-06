import { useState } from "react";
import { AlertTriangle, ArrowUpCircle, X, Clock } from "lucide-react";

export type UpdateEnforcementData = {
  hasPendingUpdate: boolean;
  version: string | null;
  releaseDate?: string;
  firstDetectedAt: number | null;
  deadlineAt: number | null;
  isDownloaded: boolean;
  isGracePeriodActive: boolean;
  isEnforced: boolean;
  remainingMs: number;
  remainingHours: number;
  remainingMinutes: number;
  isSimulated?: boolean;
};

type UpdateGraceBannerProps = {
  enforcement: UpdateEnforcementData | null;
  onInstall: () => void;
};

export function UpdateGraceBanner({ enforcement, onInstall }: UpdateGraceBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (!enforcement || !enforcement.hasPendingUpdate || !enforcement.isGracePeriodActive || isDismissed) {
    return null;
  }

  const hours = enforcement.remainingHours;
  const minutes = enforcement.remainingMinutes;
  const timeText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes} minutes`;

  return (
    <div className="relative z-40 bg-gradient-to-r from-amber-500/15 via-amber-500/20 to-orange-500/15 border-b border-amber-500/30 px-3 py-1.5 flex items-center justify-between text-xs text-amber-200 backdrop-blur-sm shadow-sm select-none">
      <div className="flex items-center gap-2 overflow-hidden mr-2">
        <div className="p-1 rounded-full bg-amber-500/20 text-amber-400 shrink-0">
          <AlertTriangle size={13} className="animate-pulse" />
        </div>
        <div className="truncate">
          <span className="font-semibold text-amber-300">Mandatory Update: </span>
          <span className="text-foreground/90">
            RouteLens <span className="font-mono font-medium text-amber-300">v{enforcement.version}</span> is ready to install.
          </span>
          <span className="ml-1.5 inline-flex items-center gap-1 text-amber-300 font-mono text-[11px] bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/20">
            <Clock size={10} />
            Required in {timeText}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onInstall}
          className="py-1 px-2.5 rounded bg-amber-500 hover:bg-amber-400 text-black font-semibold text-[11px] flex items-center gap-1.5 shadow-sm transition-all duration-150 cursor-pointer"
        >
          <ArrowUpCircle size={12} />
          <span>Restart & Update</span>
        </button>
        <button
          onClick={() => setIsDismissed(true)}
          className="p-1 rounded hover:bg-amber-500/20 text-amber-300/80 hover:text-amber-200 transition-colors"
          title="Dismiss banner for this session"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
