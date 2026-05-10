import { motion } from "motion/react";

type VisualizerState = "idle" | "listening" | "processing" | "speaking";

interface VisualizerProps {
  state: VisualizerState;
}

export default function Visualizer({ state }: VisualizerProps) {
  // VisionOS / Siri style liquid aura
  const getGlowStyles = () => {
    switch (state) {
      case "listening":
        return {
          colors: ["#A855F7", "#ec4899", "#8B5CF6", "#f43f5e"], // Violet & Pink
          pulseSpeed: 1.5,
          scaleBase: 1.1,
          opacityBase: 0.8,
        };
      case "processing":
        return {
          colors: ["#38BDF8", "#818CF8", "#c084fc", "#60A5FA"], // Sky & Blue
          pulseSpeed: 1,
          scaleBase: 1.0,
          opacityBase: 0.6,
        };
      case "speaking":
        return {
          colors: ["#F472B6", "#fb7185", "#38BDF8", "#a78bfa"], // Colorful mix
          pulseSpeed: 0.5,
          scaleBase: 1.2,
          opacityBase: 1.0,
        };
      default:
        return {
          colors: ["#64748b", "#94a3b8", "#cbd5e1", "#e2e8f0"], // Sleek Neutral / Silver
          pulseSpeed: 4,
          scaleBase: 1.0,
          opacityBase: 0.3,
        };
    }
  };

  const currentTheme = getGlowStyles();

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden pointer-events-none">
      {/* Central Glass Orb Core */}
      <motion.div
        animate={{
          scale: [currentTheme.scaleBase, currentTheme.scaleBase * 1.05, currentTheme.scaleBase],
          opacity: [0.8, 1, 0.8],
        }}
        transition={{ duration: currentTheme.pulseSpeed * 2, repeat: Infinity, ease: "easeInOut" }}
        className="relative z-10 w-48 h-48 md:w-64 md:h-64 rounded-full border-[0.5px] border-white/20 glass-panel backdrop-blur-[40px] flex items-center justify-center shadow-[inset_0_0_20px_rgba(255,255,255,0.1),0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden"
      >
        <div className="absolute inset-0 rounded-full border-[0.5px] border-white/40" style={{ maskImage: "radial-gradient(black, transparent)" }}/>
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/10 to-transparent mix-blend-overlay" />
        
        {/* Abstract Inner Reflections */}
        <div className="absolute -inset-4 rounded-full border border-white/10 mix-blend-overlay rotate-45 scale-110" />
        <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[140%] bg-gradient-to-br from-white/30 to-transparent blur-2xl opacity-40 mix-blend-overlay" />
      </motion.div>

      {/* Floating Liquid Auras */}
      {currentTheme.colors.map((color, idx) => (
        <motion.div
          key={idx}
          animate={{
            scale: [1, 1.2, 0.9, 1],
            rotate: [0, 180, 360],
            x: [0, idx % 2 === 0 ? 40 : -40, 0],
            y: [0, idx % 2 === 0 ? -40 : 40, 0],
          }}
          transition={{
            duration: currentTheme.pulseSpeed * (4 + idx),
            repeat: Infinity,
            ease: "easeInOut",
            delay: idx * 0.3,
          }}
          className="absolute w-64 h-64 md:w-[600px] md:h-[600px] rounded-[40%] blur-[80px] md:blur-[120px] mix-blend-screen mix-blend-plus-lighter"
          style={{
            backgroundColor: color,
            opacity: currentTheme.opacityBase,
            transformOrigin: `${50 + (idx * 10)}% ${50 + (idx * 5)}%`,
          }}
        />
      ))}
    </div>
  );
}
