import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { TerminalContent } from "./TerminalContent";

export const MacTerminal: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // Entrance spring animation
    const scale = spring({
        frame,
        fps,
        config: { damping: 14, stiffness: 120 },
    });

    const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });

    return (
        <AbsoluteFill style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "100px" }}>
            <div
                style={{
                    width: "100%",
                    maxWidth: "1200px",
                    height: "800px",
                    backgroundColor: "rgba(15, 14, 23, 0.85)", // dark transparent background
                    backdropFilter: "blur(20px)", // Glassmorphism
                    borderRadius: "16px",
                    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255,255,255,0.1)",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    transform: `scale(${scale})`,
                    opacity,
                }}
            >
                {/* Title bar */}
                <div style={{
                    height: "48px",
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                    display: "flex",
                    alignItems: "center",
                    padding: "0 20px"
                }}>
                    {/* Traffic lights */}
                    <div style={{ display: "flex", gap: "8px" }}>
                        <div style={{ width: "16px", height: "16px", borderRadius: "50%", backgroundColor: "#FF5F56" }} />
                        <div style={{ width: "16px", height: "16px", borderRadius: "50%", backgroundColor: "#FFBD2E" }} />
                        <div style={{ width: "16px", height: "16px", borderRadius: "50%", backgroundColor: "#27C93F" }} />
                    </div>
                    {/* Title */}
                    <div style={{ flex: 1, textAlign: "center", color: "#A3A3A3", fontSize: "16px", fontFamily: "'Inter', sans-serif" }}>
                        Terminal - guessNFTOS - 120x40
                    </div>
                </div>

                {/* Terminal Content body */}
                <div style={{ flex: 1, position: "relative" }}>
                    <TerminalContent />
                </div>
            </div>
        </AbsoluteFill>
    );
};
