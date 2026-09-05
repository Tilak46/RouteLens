import React from "react";
import { FolderOpen, Sparkles, Zap, ArrowRight } from "lucide-react";
import { OnboardingMascot } from "./OnboardingMascot";

type OnboardingViewProps = {
  onOpenFolder: () => void;
  onQuickRequest: () => void;
  onLoadDemo: () => void;
  onOpenManualModal?: () => void;
};

export const OnboardingView: React.FC<OnboardingViewProps> = ({
  onOpenFolder,
  onQuickRequest,
  onLoadDemo,
  onOpenManualModal,
}) => {
  return (
    <div className="w-full max-w-3xl mx-auto py-8 px-4 flex flex-col items-center select-none animate-in fade-in duration-300">
      {/* Hero: Soulful Mascot as the Center of Attraction */}
      <div className="flex flex-col items-center mb-5">
        <OnboardingMascot />
      </div>

      {/* Clean, Confident Typography */}
      <div className="text-center max-w-lg mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight mb-2">
          Welcome to <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">RouteLens</span>
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Connect your local backend to automatically discover, test, and monitor your API routes in real-time.
        </p>
      </div>

      {/* 3 Balanced Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mb-8">
        {/* Card 1: Open Project (Primary) */}
        <div
          onClick={onOpenFolder}
          className="group relative flex flex-col justify-between p-5 rounded-2xl bg-card/40 hover:bg-card/70 border border-primary/40 hover:border-primary/80 transition-all duration-200 cursor-pointer shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:shadow-[0_12px_36px_rgba(59,130,246,0.18)] hover:-translate-y-0.5"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3.5 group-hover:scale-105 transition-transform">
              <FolderOpen size={20} />
            </div>
            <h3 className="text-sm font-bold text-foreground mb-1.5 flex items-center justify-between">
              <span>Open Project Folder</span>
              <ArrowRight size={14} className="text-primary opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Select your Express, Next.js, or NestJS backend folder to scan routes.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between text-[11px] font-semibold text-primary">
            <span>Choose Folder</span>
            <span className="text-xs font-mono">↵</span>
          </div>
        </div>

        {/* Card 2: Explore Demo API */}
        <div
          onClick={onLoadDemo}
          className="group relative flex flex-col justify-between p-5 rounded-2xl bg-card/30 hover:bg-card/60 border border-border/50 hover:border-emerald-500/50 transition-all duration-200 cursor-pointer shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:shadow-[0_12px_36px_rgba(16,185,129,0.12)] hover:-translate-y-0.5"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3.5 group-hover:scale-105 transition-transform">
              <Sparkles size={20} />
            </div>
            <h3 className="text-sm font-bold text-foreground mb-1.5 flex items-center justify-between">
              <span>Explore Demo API</span>
              <ArrowRight size={14} className="text-emerald-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Explore a sample Store &amp; Auth API with pre-populated endpoints and cookies.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between text-[11px] font-semibold text-muted-foreground group-hover:text-emerald-400 transition-colors">
            <span>Load Sample</span>
            <span className="text-xs font-mono">↵</span>
          </div>
        </div>

        {/* Card 3: Quick Request */}
        <div
          onClick={onQuickRequest}
          className="group relative flex flex-col justify-between p-5 rounded-2xl bg-card/30 hover:bg-card/60 border border-border/50 hover:border-amber-500/50 transition-all duration-200 cursor-pointer shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:shadow-[0_12px_36px_rgba(245,158,11,0.12)] hover:-translate-y-0.5"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3.5 group-hover:scale-105 transition-transform">
              <Zap size={20} />
            </div>
            <h3 className="text-sm font-bold text-foreground mb-1.5 flex items-center justify-between">
              <span>Quick API Request</span>
              <ArrowRight size={14} className="text-amber-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Send a fast GET, POST, or custom request to any URL without a project.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between text-[11px] font-semibold text-muted-foreground group-hover:text-amber-400 transition-colors">
            <span>New Request</span>
            <span className="text-xs font-mono">↵</span>
          </div>
        </div>
      </div>

      {/* Subtle, Clean Footer */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/60">
        <span>Supports Express, Next.js, NestJS, Fastify &amp; Hono</span>
        {onOpenManualModal && (
          <>
            <span>•</span>
            <button
              onClick={onOpenManualModal}
              className="hover:text-foreground transition-colors underline underline-offset-2 cursor-pointer"
            >
              Manual Config
            </button>
          </>
        )}
      </div>
    </div>
  );
};
