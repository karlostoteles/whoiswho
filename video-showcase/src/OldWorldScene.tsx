import React from "react";
import { AbsoluteFill, Sequence, spring, interpolate, useCurrentFrame, useVideoConfig, Img, staticFile } from "remotion";

export const OldWorldScene: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const textScale = spring({ frame: frame - 10, fps, config: { damping: 12, stiffness: 200 } });
    const fadeOut = interpolate(frame, [100, 120], [1, 0], { extrapolateRight: "clamp" });

    return (
        <AbsoluteFill style={{ backgroundColor: "#0f0e17", display: "flex", justifyContent: "center", alignItems: "center", opacity: fadeOut }}>
            {/* Gray/Dusty Background pattern */}
            <AbsoluteFill style={{
                backgroundImage: "linear-gradient(#1a1a24 2px, transparent 2px), linear-gradient(90deg, #1a1a24 2px, transparent 2px)",
                backgroundSize: "40px 40px",
                opacity: 0.3
            }} />

            <div style={{ transform: `scale(${textScale})`, display: "flex", flexDirection: "column", gap: "20px", width: "80%", maxWidth: "1000px" }}>
                <h1 style={{ color: "#F472B6", fontSize: "70px", borderBottom: "4px solid #F472B6", paddingBottom: "10px" }}>
                    OLD WORLD SCHIZODIO NFT Market
                </h1>

                <div style={{
                    backgroundColor: "rgba(255,255,255,0.05)",
                    padding: "30px",
                    borderRadius: "16px",
                    border: "2px solid rgba(255,255,255,0.1)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "15px"
                }}>
                    <p style={{ color: "#FFF", fontSize: "40px", opacity: interpolate(frame, [20, 30], [0, 1], { extrapolateRight: "clamp" }) }}>
                        • Traits & pfps don't matter.
                    </p>
                    <p style={{ color: "#FFF", fontSize: "40px", opacity: interpolate(frame, [40, 50], [0, 1], { extrapolateRight: "clamp" }) }}>
                        • Low trait liquidity - Only floor price matters.
                    </p>
                    <p style={{ color: "rgba(244, 114, 182, 0.8)", fontSize: "40px", opacity: interpolate(frame, [60, 70], [0, 1], { extrapolateRight: "clamp" }) }}>
                        • Many collect and stay dead in dust.
                    </p>
                </div>
            </div>
        </AbsoluteFill>
    );
};
