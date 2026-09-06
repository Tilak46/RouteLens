import { useState } from "react";
import { Sparkles, ArrowUpCircle, X } from "lucide-react";

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

  if (!enforcement || !enforcement.hasPendingUpdate || isDismissed) {
    return null;
  }

  return (
    <div className="relative z-40 bg-[hsl(240,6%,13%)]/95 border-b border-primary/25 px-4 py-2 flex items-center justify-between text-xs text-foreground/90 backdrop-blur-md shadow-md select-none transition-all duration-200">
      <div className="flex items-center gap-2.5 overflow-hidden mr-3">
        <div className="w-6 h-6 rounded-md bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0 shadow-sm">
          <Sparkles size={13} className="animate-pulse" />
        </div>
        <div className="truncate flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-white">Update Ready:</span>
          <span className="text-zinc-300">RouteLens</span>
          <span className="font-mono font-medium text-primary px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-[11px]">
            v{enforcement.version}
          </span>
          <span className="text-zinc-400 hidden sm:inline text-[11px]">
            is ready to install. Restart to apply the latest improvements.
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onInstall}
          className="py-1 px-3 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-[11px] flex items-center gap-1.5 shadow-sm transition-all duration-150 cursor-pointer hover:shadow-primary/20 hover:shadow-md active:scale-95"
        >
          <ArrowUpCircle size={13} />
          <span>Restart & Update</span>
        </button>
        <button
          onClick={() => setIsDismissed(true)}
          className="p-1 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
          title="Dismiss banner for this session"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
