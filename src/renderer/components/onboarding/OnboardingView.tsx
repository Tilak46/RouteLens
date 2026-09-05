import React from "react";
import {
  FolderOpen,
  Sparkles,
  Zap,
  Compass,
  ArrowRight,
  Code2,
  Terminal,
  Cookie,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <div className="w-full max-w-4xl mx-auto py-8 px-4 flex flex-col items-center select-none animate-in fade-in duration-300">
      {/* Top Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-6 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-mono text-[11px] tracking-wide text-foreground/80 font-semibold">
          RouteLens v1.0.1
        </span>
        <span className="text-muted-foreground/60">•</span>
        <span className="text-foreground/70">Intelligent API Discovery</span>
      </div>

      {/* Hero Header */}
      <div className="text-center max-w-2xl mb-10">
        <div className="relative inline-block mb-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-[1px] shadow-[0_8px_30px_rgba(59,130,246,0.3)]">
            <div className="w-full h-full bg-card rounded-2xl flex items-center justify-center text-primary">
              <Compass size={32} className="text-blue-400 animate-in spin-in-180 duration-500" />
            </div>
          </div>
        </div>

        <h1 className="text-3xl font-extrabold text-foreground tracking-tight sm:text-4xl mb-3">
          Welcome to <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">RouteLens</span>
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-xl mx-auto">
          RouteLens parses your backend codebase to automatically discover, test, and monitor API endpoints in real-time. Zero manual collection setups, zero outdated docs.
        </p>

        {/* Feature Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/30 border border-border/40 text-[11px] text-muted-foreground font-medium">
            <Code2 size={12} className="text-blue-400" /> AST Route Discovery
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/30 border border-border/40 text-[11px] text-muted-foreground font-medium">
            <Cookie size={12} className="text-amber-400" /> RFC 6265 Cookie Jar
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/30 border border-border/40 text-[11px] text-muted-foreground font-medium">
            <Terminal size={12} className="text-emerald-400" /> Live Process Console
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/30 border border-border/40 text-[11px] text-muted-foreground font-medium">
            <Layers size={12} className="text-purple-400" /> Multi-Environment Sync
          </span>
        </div>
      </div>

      {/* 3 Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full mb-10">
        {/* Card 1: Open Project Folder (Primary) */}
        <div
          onClick={onOpenFolder}
          className="group relative flex flex-col p-6 rounded-2xl bg-card/40 hover:bg-card/70 border border-primary/30 hover:border-primary/60 transition-all duration-200 cursor-pointer shadow-[0_8px_32px_rgba(0,0,0,0.2)] hover:shadow-[0_12px_40px_rgba(59,130,246,0.15)] hover:-translate-y-0.5"
        >
          <div className="absolute top-3.5 right-3.5">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-primary/20 text-primary border border-primary/30">
              Recommended
            </span>
          </div>

          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4 group-hover:scale-105 transition-transform">
            <FolderOpen size={24} />
          </div>

          <h3 className="text-base font-bold text-foreground mb-1.5 flex items-center gap-1.5">
            Open Project Folder
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed mb-6 flex-grow">
            Select your Node.js, Express, Next.js, or NestJS backend folder. RouteLens will auto-scan endpoints and launch your workspace.
          </p>

          <Button
            size="sm"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-9 text-xs shadow-md group-hover:shadow-primary/20 flex items-center justify-center gap-1.5"
          >
            <span>Choose Folder</span>
            <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
          </Button>
        </div>

        {/* Card 2: Explore Demo API */}
        <div
          onClick={onLoadDemo}
          className="group relative flex flex-col p-6 rounded-2xl bg-card/40 hover:bg-card/70 border border-border/60 hover:border-emerald-500/50 transition-all duration-200 cursor-pointer shadow-[0_8px_32px_rgba(0,0,0,0.2)] hover:shadow-[0_12px_40px_rgba(16,185,129,0.1)] hover:-translate-y-0.5"
        >
          <div className="absolute top-3.5 right-3.5">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              1-Click Try
            </span>
          </div>

          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-105 transition-transform">
            <Sparkles size={24} />
          </div>

          <h3 className="text-base font-bold text-foreground mb-1.5">
            Explore Demo API
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed mb-6 flex-grow">
            Don&apos;t have a local backend ready? Explore a sample Store &amp; Auth API with pre-populated endpoints, headers, params, and cookies.
          </p>

          <Button
            variant="outline"
            size="sm"
            className="w-full bg-transparent border-border/80 hover:border-emerald-500/50 hover:bg-emerald-500/10 text-foreground font-semibold h-9 text-xs flex items-center justify-center gap-1.5"
          >
            <span>Load Demo API</span>
            <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform text-emerald-400" />
          </Button>
        </div>

        {/* Card 3: Quick Request */}
        <div
          onClick={onQuickRequest}
          className="group relative flex flex-col p-6 rounded-2xl bg-card/40 hover:bg-card/70 border border-border/60 hover:border-amber-500/50 transition-all duration-200 cursor-pointer shadow-[0_8px_32px_rgba(0,0,0,0.2)] hover:shadow-[0_12px_40px_rgba(245,158,11,0.1)] hover:-translate-y-0.5"
        >
          <div className="absolute top-3.5 right-3.5">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase bg-amber-500/15 text-amber-400 border border-amber-500/25">
              Scratchpad
            </span>
          </div>

          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 group-hover:scale-105 transition-transform">
            <Zap size={24} />
          </div>

          <h3 className="text-base font-bold text-foreground mb-1.5">
            Quick API Request
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed mb-6 flex-grow">
            Send an instant GET, POST, or custom HTTP request to any public or local URL without creating a project, Postman style.
          </p>

          <Button
            variant="outline"
            size="sm"
            className="w-full bg-transparent border-border/80 hover:border-amber-500/50 hover:bg-amber-500/10 text-foreground font-semibold h-9 text-xs flex items-center justify-center gap-1.5"
          >
            <span>New Blank Request</span>
            <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform text-amber-400" />
          </Button>
        </div>
      </div>

      {/* Quick Shortcuts & Supported Frameworks */}
      <div className="w-full border-t border-border/40 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-4 flex-wrap justify-center">
          <span className="text-[11px] font-medium text-foreground/70">Supported Frameworks:</span>
          <span className="px-2 py-0.5 rounded bg-muted/30 border border-border/30 text-[10px] font-mono">Express</span>
          <span className="px-2 py-0.5 rounded bg-muted/30 border border-border/30 text-[10px] font-mono">Next.js App &amp; Pages</span>
          <span className="px-2 py-0.5 rounded bg-muted/30 border border-border/30 text-[10px] font-mono">NestJS</span>
          <span className="px-2 py-0.5 rounded bg-muted/30 border border-border/30 text-[10px] font-mono">Fastify</span>
          <span className="px-2 py-0.5 rounded bg-muted/30 border border-border/30 text-[10px] font-mono">Hono</span>
        </div>

        <div className="flex items-center gap-3">
          {onOpenManualModal && (
            <button
              onClick={onOpenManualModal}
              className="text-[11px] text-muted-foreground hover:text-primary transition-colors underline underline-offset-4 cursor-pointer"
            >
              Advanced project config
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
