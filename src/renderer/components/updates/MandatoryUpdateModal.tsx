import { Sparkles, ArrowUpCircle } from "lucide-react";
import { UpdateEnforcementData } from "./UpdateGraceBanner";

type MandatoryUpdateModalProps = {
  enforcement: UpdateEnforcementData | null;
  onInstall: () => void;
};

export function MandatoryUpdateModal({ enforcement, onInstall }: MandatoryUpdateModalProps) {
  if (!enforcement || !enforcement.hasPendingUpdate || !enforcement.isEnforced) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200"
      onKeyDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-md bg-card/95 border border-primary/30 rounded-xl p-6 shadow-2xl shadow-black/60 text-center relative overflow-hidden">
        {/* Top decorative glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-primary/15 blur-2xl rounded-full pointer-events-none" />

        {/* Update Icon Badge */}
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary mb-4 shadow-inner">
          <Sparkles size={26} className="animate-pulse" />
        </div>

        {/* Headline */}
        <h2 className="text-lg font-bold text-foreground tracking-tight mb-1.5">
          RouteLens Update Ready
        </h2>
        
        <p className="text-xs text-muted-foreground leading-relaxed mb-4">
          RouteLens <span className="font-mono text-primary font-semibold">v{enforcement.version}</span> has been downloaded. Restart RouteLens to apply the latest improvements and continue exploring.
        </p>

        {/* Release Specs Pill */}
        <div className="p-2.5 rounded-lg bg-secondary/50 border border-border/60 text-left space-y-1.5 mb-5 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">New Version:</span>
            <span className="font-mono font-semibold text-primary">v{enforcement.version}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status:</span>
            <span className="font-mono text-emerald-400 font-medium">Ready to install</span>
          </div>
          {enforcement.isSimulated && (
            <div className="pt-1 border-t border-border/40 flex items-center justify-between text-[10px] text-amber-400">
              <span>Test Mode:</span>
              <span>Simulated Expiration</span>
            </div>
          )}
        </div>

        {/* Primary Action Button */}
        <button
          onClick={onInstall}
          className="w-full py-2.5 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all duration-150 cursor-pointer active:scale-98"
        >
          <ArrowUpCircle size={16} />
          <span>Restart & Update Now</span>
        </button>

        <p className="text-[10px] text-muted-foreground/70 mt-3">
          Your open tabs, project states, and environments are preserved automatically.
        </p>
      </div>
    </div>
  );
}
