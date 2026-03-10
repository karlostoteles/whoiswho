import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Img, staticFile } from "remotion";

export const FlowchartOutroScene: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    return (
        <AbsoluteFill style={{ backgroundColor: "#0f0e17", display: "flex", justifyContent: "center", alignItems: "center" }}>
            {/* Practice BG fading in */}
            <Img src={staticFile("practice-bg.jpg")} style={{
                position: "absolute", width: "100%", height: "100%", objectFit: "cover",
                opacity: interpolate(frame, [0, 30], [0, 0.4], { extrapolateRight: "clamp" })
            }} />

            <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: "30px", zIndex: 10,
                transform: `scale(${spring({ frame: frame - 15, fps, config: { damping: 12, stiffness: 100 } })})`
            }}>
                <Img src={staticFile("newlogo.png")} style={{ width: "400px" }} />

                <p style={{ color: "#FFF", fontSize: "36px", textAlign: "center", maxWidth: "1200px", lineHeight: "1.5" }}>
                    "guessNFT represents the solid foundation of the future IP economy where UX, gamification values, internal AMMs, PHP and warrants mix-run."
                </p>

                <p style={{ color: "#F472B6", fontSize: "36px", textAlign: "center", marginTop: "20px" }}>
                    It is not just a game, it's the first of its kind.
                </p>

                <h1 style={{
                    color: "#E8A444", fontSize: "60px", textAlign: "center", marginTop: "40px",
                    transform: `scale(${spring({ frame: frame - 60, fps, config: { damping: 10, stiffness: 150 } })})`,
                    opacity: interpolate(frame, [60, 70], [0, 1], { extrapolateRight: "clamp" })
                }}>
                    THE SMART APES CHOOSE (Starts Day 0)
                </h1>
            </div>
        </AbsoluteFill>
    );
};
