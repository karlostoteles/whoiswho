import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Img, staticFile } from "remotion";

export const GameDataVatScene: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const slideIn = spring({ frame: frame - 10, fps, config: { damping: 15, stiffness: 100 } });
    const translateY = interpolate(slideIn, [0, 1], [1080, 0]);

    return (
        <AbsoluteFill style={{ backgroundColor: "#0f0e17", transform: `translateY(${translateY}px)` }}>
            {/* Background Canvas Image from site */}
            <Img src={staticFile("board_card_framework.png")} style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover", opacity: 0.25 }} />

            <div style={{ display: "flex", width: "100%", height: "100%", padding: "60px", flexDirection: "column", position: "relative", zIndex: 10 }}>
                <h1 style={{ color: "#E8A444", fontSize: "70px", textShadow: "0 0 20px rgba(232, 164, 68, 0.5)", borderBottom: "4px solid #E8A444", paddingBottom: "10px", width: "fit-content" }}>
                    THE GAME DATA VAT (guessNFT)
                </h1>

                <div style={{ display: "flex", gap: "40px", marginTop: "40px", flexWrap: "wrap" }}>
                    {/* Card 1 */}
                    <div style={{
                        flex: 1, backgroundColor: "rgba(30, 20, 45, 0.8)", padding: "40px", borderRadius: "16px", border: "2px solid rgba(232, 164, 68, 0.5)",
                        transform: `scale(${spring({ frame: frame - 20, fps, config: { damping: 12, stiffness: 100 } })})`
                    }}>
                        <h2 style={{ color: "#FFF", fontSize: "36px" }}>Classic Guess Who</h2>
                        <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "28px", marginTop: "10px" }}>AI Trivia visual realms questions</p>
                    </div>

                    {/* Card 2 */}
                    <div style={{
                        flex: 1, backgroundColor: "rgba(30, 20, 45, 0.8)", padding: "40px", borderRadius: "16px", border: "2px solid rgba(232, 164, 68, 0.5)",
                        transform: `scale(${spring({ frame: frame - 35, fps, config: { damping: 12, stiffness: 100 } })})`
                    }}>
                        <h2 style={{ color: "#FFF", fontSize: "36px" }}>Betting Main State Element</h2>
                        <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "28px", marginTop: "10px" }}>Sept/Oct 0.5% floor evolution!</p>
                    </div>

                    {/* Card 3 */}
                    <div style={{
                        flex: 1, backgroundColor: "rgba(30, 20, 45, 0.8)", padding: "40px", borderRadius: "16px", border: "2px solid rgba(56, 189, 248, 0.5)",
                        transform: `scale(${spring({ frame: frame - 50, fps, config: { damping: 12, stiffness: 100 } })})`
                    }}>
                        <h2 style={{ color: "#38bdf8", fontSize: "36px" }}>Rare/Unique Trait Combos</h2>
                        <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "28px", marginTop: "10px" }}>= mathematically proven win rate advantage</p>
                    </div>
                </div>
            </div>
        </AbsoluteFill>
    );
};
