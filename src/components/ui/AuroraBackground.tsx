import type { ComponentProps, ReactNode } from "react";

interface AuroraBackgroundProps extends ComponentProps<"div"> {
  children?: ReactNode;
  className?: string;
}

export function AuroraBackground({ children, className = "", ...props }: AuroraBackgroundProps) {
  return (
    <div className={`relative isolate overflow-hidden ${className}`.trim()} {...props}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {/* Subtle ReactBits radial dot grid */}
        <div
          className="rb-dot-grid absolute inset-0 opacity-80"
          style={{
            maskImage: "radial-gradient(ellipse 85% 75% at 50% 25%, #000 35%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(ellipse 85% 75% at 50% 25%, #000 35%, transparent 100%)",
          }}
        />
        {/* Aurora blobs */}
        <div
          className="rb-decorative-motion pointer-events-none absolute -top-[30%] -left-[20%] h-[80vh] w-[80vh] rounded-full opacity-30"
          style={{
            background: "radial-gradient(circle, rgba(34,211,238,0.38) 0%, rgba(59,130,246,0.18) 40%, transparent 70%)",
            filter: "blur(80px)",
            animation: "aurora-1 15s ease-in-out infinite",
          }}
        />
        <div
          className="rb-decorative-motion pointer-events-none absolute top-[10%] -right-[20%] h-[70vh] w-[70vh] rounded-full opacity-20"
          style={{
            background: "radial-gradient(circle, rgba(168,85,247,0.38) 0%, rgba(59,130,246,0.18) 40%, transparent 70%)",
            filter: "blur(100px)",
            animation: "aurora-2 20s ease-in-out infinite",
          }}
        />
        <div
          className="rb-decorative-motion pointer-events-none absolute -bottom-[20%] left-[20%] h-[60vh] w-[60vh] rounded-full opacity-15"
          style={{
            background: "radial-gradient(circle, rgba(34,211,238,0.28) 0%, rgba(168,85,247,0.14) 50%, transparent 70%)",
            filter: "blur(90px)",
            animation: "aurora-3 25s ease-in-out infinite",
          }}
        />
      </div>
      {children}
    </div>
  );
}
