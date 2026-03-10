import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Img, staticFile, Sequence } from "remotion";

export const EngineScene: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    return (
        <AbsoluteFill style={{ backgroundColor: "#0f0e17", display: "flex", justifyContent: "center", alignItems: "center", padding: "60px" }}>
            {/* The Engine Diagram */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "50px", width: "100%" }}>

                {/* 0.01 STRK Fee Block */}
                <div style={{
                    padding: "30px", border: "4px solid #FFF", borderRadius: "12px", backgroundColor: "#000",
                    transform: `scale(${spring({ frame: frame - 10, fps, config: { damping: 10, stiffness: 150 } })})`
                }}>
                    <h2 style={{ color: "#FFF", fontSize: "40px" }}>0.01 STRK</h2>
                    <p style={{ color: "#A3A3A3", fontSize: "28px" }}>Game page. ET. or Floor price fee</p>
                </div>

                {/* Arrows container */}
                <div style={{ display: "flex", width: "80%", justifyContent: "space-between", position: "relative" }}>
                    {/* Line connecting them conceptually */}
                    <div style={{ position: "absolute", top: "50%", left: "10%", right: "10%", height: "4px", backgroundColor: "rgba(255,255,255,0.2)", zIndex: 0 }} />

                    {/* Treasury 10% */}
                    <div style={{
                        padding: "30px", border: "4px solid #22c55e", borderRadius: "12px", backgroundColor: "rgba(34, 197, 94, 0.1)", zIndex: 1,
                        transform: `scale(${spring({ frame: frame - 25, fps, config: { damping: 12, stiffness: 120 } })})`
                    }}>
                        <h2 style={{ color: "#22c55e", fontSize: "36px" }}>10% Platform Treasury</h2>
                    </div>

                    {/* Collective Reward 90% */}
                    <div style={{
                        padding: "30px", border: "4px solid #22c55e", borderRadius: "12px", backgroundColor: "rgba(34, 197, 94, 0.1)", zIndex: 1,
                        transform: `scale(${spring({ frame: frame - 40, fps, config: { damping: 12, stiffness: 120 } })})`
                    }}>
                        <h2 style={{ color: "#22c55e", fontSize: "36px" }}>90% Collective Reward Treasury</h2>
                        <p style={{ color: "#FFF", fontSize: "24px", marginTop: "10px" }}>Automated floor bindings & token AMM</p>
                    </div>
                </div>

                {/* Volume Pumpers Outcome */}
                <div style={{
                    padding: "40px", border: "4px solid #f97316", borderRadius: "12px", backgroundColor: "rgba(249, 115, 22, 0.1)",
                    transform: `scale(${spring({ frame: frame - 60, fps, config: { damping: 10, stiffness: 150 } })})`,
                    boxShadow: "0 0 50px rgba(249, 115, 22, 0.3)"
                }}>
                    <h1 style={{ color: "#f97316", fontSize: "50px", textAlign: "center" }}>VOLUME PUMPERS!</h1>
                    <h2 style={{ color: "#FFF", fontSize: "36px", textAlign: "center", marginTop: "15px" }}>More txns -&gt; more fees -&gt; stronger floors</h2>
                    <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "28px", textAlign: "center", marginTop: "10px" }}>(more players & no outbids)</p>
                </div>

            </div>
        </AbsoluteFill>
    );
};
