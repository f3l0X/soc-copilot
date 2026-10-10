"use client";

import { useTheme } from "@/lib/theme";

/** Logo del ojo (mismo diseño que el de la barra lateral). */
export function SocEyeLogo({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="loginlogo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF2E93" />
          <stop offset="1" stopColor="#7B2FF7" />
        </linearGradient>
        <radialGradient id="loginlogo-iris" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.35" stopColor="#5CF2FF" />
          <stop offset="1" stopColor="#1B4BFF" />
        </radialGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#loginlogo-bg)" />
      <path d="M6 32 C16 16 48 16 58 32 C48 48 16 48 6 32 Z" fill="#12061F" />
      <circle cx="32" cy="32" r="11" fill="url(#loginlogo-iris)" />
      <circle cx="32" cy="32" r="4.5" fill="#12061F" />
      <path d="M32 21v-5M43 32h5M32 43v5M21 32h-5" stroke="#5CF2FF" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="35" cy="29" r="1.6" fill="#FFFFFF" />
    </svg>
  );
}

/** Fondo animado del login: un ojo que vigila, con radar y escáner. */
export function LoginBackground() {
  const { theme } = useTheme();
  const mode = theme === "dark" ? "is-dark" : "is-light";

  return (
    <div aria-hidden="true" className={`soc-login-bg ${mode}`}>
      <div className="soc-grid" />
      <div className="soc-glow soc-glow-a" />
      <div className="soc-glow soc-glow-b" />
      <div className="soc-scan" />

      <div className="soc-eye-wrap">
        <div className="soc-ring" />
        <div className="soc-ring r2" />
        <div className="soc-ring r3" />
        <div className="soc-sweep" />

        <svg viewBox="0 0 600 300" className="soc-eye">
          <defs>
            <linearGradient id="lbg-lid" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#FF2E93" />
              <stop offset="1" stopColor="#7B2FF7" />
            </linearGradient>
            <radialGradient id="lbg-iris" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#FFFFFF" />
              <stop offset="0.35" stopColor="#5CF2FF" />
              <stop offset="1" stopColor="#1B4BFF" />
            </radialGradient>
          </defs>

          <g className="soc-blink">
            <path
              d="M20 150 C120 20 480 20 580 150 C480 280 120 280 20 150 Z"
              className="soc-almond"
              stroke="url(#lbg-lid)"
              strokeWidth="3"
            />
            <g className="soc-iris">
              <circle cx="300" cy="150" r="95" fill="url(#lbg-iris)" />
              <circle cx="300" cy="150" r="40" className="soc-pupil" />
              <circle cx="330" cy="122" r="10" fill="#FFFFFF" />
            </g>
          </g>

          <g className="soc-ticks" stroke="#5CF2FF" strokeWidth="3" strokeLinecap="round">
            <path d="M300 50V25M400 150H425M300 250V275M200 150H175" />
          </g>
        </svg>
      </div>

      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.soc-login-bg{position:fixed;inset:0;overflow:hidden;z-index:0;pointer-events:none}
.soc-login-bg.is-dark{
  --grid:rgba(92,242,255,.07);--glowop:.30;--eyeop:.6;--almond:#12061F;--pupil:#12061F;
  --ring:rgba(92,242,255,.45);--sweep:rgba(92,242,255,.22);--scan:rgba(92,242,255,.07);
  background:radial-gradient(1200px 650px at 50% 45%,#1d0c3a 0%,#0b0618 60%,#05030c 100%);
}
.soc-login-bg.is-light{
  --grid:rgba(123,47,247,.08);--glowop:.22;--eyeop:.75;--almond:#FFFFFF;--pupil:#12061F;
  --ring:rgba(123,47,247,.35);--sweep:rgba(123,47,247,.16);--scan:rgba(123,47,247,.05);
  background:radial-gradient(1200px 650px at 50% 45%,#ffffff 0%,#f4effe 55%,#e8f7fb 100%);
}
.soc-grid{position:absolute;inset:0;
  background-image:linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px);
  background-size:44px 44px;
  -webkit-mask-image:radial-gradient(ellipse at center,#000 25%,transparent 75%);
          mask-image:radial-gradient(ellipse at center,#000 25%,transparent 75%)}
.soc-glow{position:absolute;width:45vw;height:45vw;border-radius:50%;filter:blur(90px);opacity:var(--glowop);
  animation:socDrift 18s ease-in-out infinite alternate}
.soc-glow-a{left:-12vw;top:-15vw;background:#FF2E93}
.soc-glow-b{right:-12vw;bottom:-18vw;background:#5CF2FF;animation-delay:-9s}
.soc-scan{position:absolute;left:0;right:0;top:0;height:140px;
  background:linear-gradient(to bottom,transparent,var(--scan),transparent);
  animation:socScan 9s linear infinite}
.soc-eye-wrap{position:absolute;left:50%;top:50%;width:min(1150px,150vw);aspect-ratio:2/1;transform:translate(-50%,-50%)}
.soc-eye{position:absolute;inset:0;width:100%;height:100%;opacity:var(--eyeop)}
.soc-almond{fill:var(--almond);fill-opacity:.85}
.soc-pupil{fill:var(--pupil)}
.soc-iris circle:first-child{filter:drop-shadow(0 0 28px #5CF2FF)}
.soc-blink{transform-box:fill-box;transform-origin:center;animation:socBlink 9s ease-in-out infinite}
.soc-iris{transform-box:fill-box;transform-origin:center;animation:socPulse 4s ease-in-out infinite}
.soc-ticks{transform-box:view-box;transform-origin:300px 150px;animation:socSpin 40s linear infinite}
.soc-ring{position:absolute;left:50%;top:50%;width:34%;aspect-ratio:1;border-radius:50%;
  border:1px solid var(--ring);animation:socRing 6s ease-out infinite}
.soc-ring.r2{animation-delay:2s}
.soc-ring.r3{animation-delay:4s}
.soc-sweep{position:absolute;left:50%;top:50%;width:40%;aspect-ratio:1;border-radius:50%;
  background:conic-gradient(from 0deg,transparent 0deg 290deg,var(--sweep) 360deg);
  animation:socSweep 7s linear infinite}
@keyframes socBlink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.06)}}
@keyframes socPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
@keyframes socSpin{to{transform:rotate(360deg)}}
@keyframes socSweep{from{transform:translate(-50%,-50%) rotate(0)}to{transform:translate(-50%,-50%) rotate(360deg)}}
@keyframes socRing{0%{transform:translate(-50%,-50%) scale(.4);opacity:.7}100%{transform:translate(-50%,-50%) scale(1.7);opacity:0}}
@keyframes socDrift{to{transform:translate(6vw,4vw) scale(1.1)}}
@keyframes socScan{from{transform:translateY(-140px)}to{transform:translateY(100vh)}}
@media (prefers-reduced-motion:reduce){.soc-login-bg *{animation:none!important}}
`;