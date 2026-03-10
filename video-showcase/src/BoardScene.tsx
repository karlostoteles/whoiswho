import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Img, staticFile, Sequence } from "remotion";

export const BoardScene: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // The whole board slides up and rotates dynamically
    const boardScale = spring({ frame: frame - 15, fps, config: { damping: 15, stiffness: 100 } });
    const tiltX = interpolate(frame, [0, 150], [30, 15]);
    const tiltY = interpolate(frame, [0, 150], [-25, -15]);

    // Cursor flies in from bottom right to the center
    const cursorX = interpolate(frame, [30, 50], [1500, 600], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
    const cursorY = interpolate(frame, [30, 50], [900, 480], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
    const cursorClick = spring({ frame: frame - 55, fps, config: { damping: 10, stiffness: 200 } });

    // Hover state of the card when cursor reaches it
    const cardGlow = interpolate(frame, [48, 55], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

    // Screen Shake effect when timer starts ticking
    const shakeIntensity = interpolate(frame, [90, 140], [0, 10], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
    const shakeX = Math.sin(frame * 2.5) * shakeIntensity;
    const shakeY = Math.cos(frame * 2.1) * shakeIntensity;

    // Timer text changes
    let timerText = "15";
    if (frame > 100) timerText = "10";
    if (frame > 110) timerText = "05";
    if (frame > 120) timerText = "03";
    if (frame > 130) timerText = "01";
    if (frame > 140) timerText = "00";

    const isTimerUrgent = frame > 120;
    const timerColor = isTimerUrgent ? "#F472B6" : "#FFF"; // Neon red/pink vs White

    // "GUESS AUTOMATED" stamp
    const stampVisible = frame > 140;
    const stampScale = stampVisible ? spring({ frame: frame - 140, fps, config: { damping: 12, stiffness: 250 } }) : 0;

    return (
        <AbsoluteFill style={{ backgroundColor: "#0f0e17", transform: `translate(${shakeX}px, ${shakeY}px)` }}>
            {/* Background elements */}
            <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 50%, rgba(232, 164, 68, 0.1) 0%, rgba(0,0,0,0) 70%)" }} />

            {/* 3D Board Container */}
            <AbsoluteFill style={{
                perspective: "1500px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center"
            }}>
                <div style={{
                    width: "1200px",
                    height: "800px",
                    transform: `scale(${boardScale}) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`,
                    transformStyle: "preserve-3d",
                    display: "flex",
                    gap: "40px",
                    justifyContent: "center",
                    alignItems: "center"
                }}>
                    {/* Game Card */}
                    <div style={{
                        width: "500px",
                        height: "700px",
                        backgroundColor: "rgba(30, 20, 45, 0.8)",
                        borderRadius: "24px",
                        border: `4px solid rgba(232,164,68,${cardGlow})`,
                        boxShadow: `0 30px 60px rgba(0,0,0,0.6), 0 0 ${cardGlow * 100}px rgba(232,164,68,0.5)`,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        padding: "40px",
                        transform: `scale(${1 + cardGlow * 0.05}) translateZ(50px)`
                    }}>
                        <div style={{ fontSize: "50px", fontWeight: "bold", color: "#FFF", marginBottom: "20px" }}>PLAY FOR REAL</div>
                        <div style={{ fontSize: "24px", color: "rgba(255,255,255,0.7)", textAlign: "center", marginBottom: "40px" }}>
                            0.01 STRK BUY-IN • 999 SCHIZODIOS
                        </div>
                        <div style={{
                            width: "100%", height: "80px", backgroundColor: "#E8A444", borderRadius: "12px",
                            display: "flex", justifyContent: "center", alignItems: "center", fontSize: "32px", fontWeight: "bold",
                            color: "#1e142d", marginTop: "auto"
                        }}>
                            CREATE GAME
                        </div>
                    </div>

                    {/* Turn Timer UI (Appears later in scene) */}
                    <Sequence from={75}>
                        <div style={{
                            width: "250px",
                            height: "250px",
                            backgroundColor: "rgba(20, 20, 25, 0.9)",
                            borderRadius: "50%",
                            border: `6px solid ${timerColor}`,
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            boxShadow: `0 0 ${isTimerUrgent ? 100 : 30}px ${timerColor}`,
                            position: "absolute",
                            right: "-100px",
                            top: "-100px",
                            transform: "translateZ(100px)" // Pops out more
                        }}>
                            <div style={{ fontSize: "100px", fontWeight: "bold", color: timerColor, fontFamily: "monospace" }}>
                                {timerText}
                            </div>
                        </div>
                    </Sequence>
                </div>
            </AbsoluteFill>

            {/* Glowing Cursor Layer */}
            <div style={{
                position: "absolute",
                left: `${cursorX}px`,
                top: `${cursorY}px`,
                width: "48px",
                height: "48px",
                zIndex: 100,
                filter: "drop-shadow(0 0 10px rgba(255,255,255,0.8))",
                transform: `scale(${1 - cursorClick * 0.2})` // Shrinks slightly when clicking
            }}>
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 4L11.5 21l3-7.5L22 10.5L4 4z" fill="#FFF" stroke="#000" strokeWidth="1" />
                </svg>
            </div>

            {/* Huge Stamp overlay */}
            {stampVisible && (
                <div style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    zIndex: 200,
                    transform: `scale(${Math.max(stampScale, 0.01)})`,
                    opacity: stampScale > 0.9 ? 1 : interpolate(stampScale, [0, 1], [0, 1])
                }}>
                    <div style={{
                        border: "15px solid #F472B6",
                        color: "#F472B6",
                        fontSize: "120px",
                        fontWeight: 900,
                        padding: "20px 60px",
                        transform: "rotate(-10deg)",
                        textShadow: "0 0 40px rgba(244, 114, 182, 0.8)",
                        boxShadow: "0 0 40px rgba(244, 114, 182, 0.5) inset"
                    }}>
                        GUESS AUTOMATED
                    </div>
                </div>
            )}
        </AbsoluteFill>
    );
};
