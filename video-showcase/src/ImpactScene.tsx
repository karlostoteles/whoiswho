import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Img, staticFile } from "remotion";

export const ImpactScene: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    return (
        <AbsoluteFill style={{ backgroundColor: "#0f0e17", display: "flex", justifyContent: "center", alignItems: "center", padding: "60px" }}>
            {/* Background elements (Avatars) zooming by to simulate market activity */}
            <AbsoluteFill style={{ opacity: 0.15 }}>
                <div style={{ display: "flex", flexWrap: "wrap", width: "150%", gap: "20px", transform: `translateY(-${frame * 5}px)` }}>
                    {Array.from({ length: 40 }).map((_, i) => (
                        <Img key={i} src={staticFile(`nft/${(i % 4) + 1}.png`)} style={{ width: "200px", height: "200px", borderRadius: "16px" }} />
                    ))}
                </div>
            </AbsoluteFill>

            {/* Impact Box */}
            <div style={{
                backgroundColor: "rgba(16, 185, 129, 0.15)", // emerald tint
                border: "6px solid #10b981",
                borderRadius: "24px",
                padding: "60px",
                width: "90%",
                maxWidth: "1400px",
                boxShadow: "0 0 100px rgba(16, 185, 129, 0.4)",
                transform: `scale(${spring({ frame: frame - 10, fps, config: { damping: 14, stiffness: 120 } })})`
            }}>
                <h1 style={{ color: "#10b981", fontSize: "70px", borderBottom: "4px solid #10b981", paddingBottom: "20px", marginBottom: "40px" }}>
                    Market Impact & Value Creation
                </h1>

                <div style={{ display: "flex", flexDirection: "row", gap: "40px", justifyContent: "space-between" }}>
                    <div style={{
                        flex: 1, padding: "30px", backgroundColor: "#000", borderRadius: "16px", border: "2px solid #333",
                        opacity: interpolate(frame, [30, 40], [0, 1], { extrapolateRight: "clamp" })
                    }}>
                        <p style={{ color: "#FFF", fontSize: "36px" }}>Players pay premium for 'art/pfps' trait boxes</p>
                    </div>

                    <div style={{
                        flex: 1, padding: "30px", backgroundColor: "#000", borderRadius: "16px", border: "2px solid #333",
                        opacity: interpolate(frame, [50, 60], [0, 1], { extrapolateRight: "clamp" })
                    }}>
                        <p style={{ color: "#FFF", fontSize: "36px" }}>Traits premiums explode. Specific Traits ~10-40% instantly</p>
                    </div>

                    <div style={{
                        flex: 1, padding: "30px", backgroundColor: "#000", borderRadius: "16px", border: "2px solid #333",
                        opacity: interpolate(frame, [70, 80], [0, 1], { extrapolateRight: "clamp" })
                    }}>
                        <p style={{ color: "#FFF", fontSize: "36px" }}>Floors rise 20-50% with volume</p>
                    </div>
                </div>

                <div style={{
                    marginTop: "40px", padding: "30px", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: "16px",
                    opacity: interpolate(frame, [90, 100], [0, 1], { extrapolateRight: "clamp" })
                }}>
                    <p style={{ color: "#E8A444", fontSize: "40px", textAlign: "center", fontStyle: "italic" }}>
                        "New opportunities emerge thru lending mini. Trading price discovery!"
                    </p>
                </div>
            </div>
        </AbsoluteFill>
    );
};
