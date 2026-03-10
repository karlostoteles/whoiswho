import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Img, staticFile } from "remotion";

export const OutroScene: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // Floor grid scroll
    const scrollOffset = (frame * 30) % 200; // Fast scroll loop

    // Logo entrance with spring
    const logoVisible = frame > 30;
    const logoScale = logoVisible ? spring({ frame: frame - 30, fps, config: { damping: 10, stiffness: 150 } }) : 0;

    // Chromatic aberration effect (RGB split amount)
    const aberration = interpolate(frame, [30, 40, 50], [50, 0, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

    return (
        <AbsoluteFill style={{ backgroundColor: "#0f0e17", overflow: "hidden" }}>
            {/* 3D scrolling floor of boxes */}
            <div style={{
                position: "absolute",
                bottom: "-100%",
                width: "200%",
                height: "200%",
                left: "-50%",
                transformStyle: "preserve-3d",
                transform: "perspective(800px) rotateX(75deg) translateZ(0)",
            }}>
                <div style={{
                    position: "absolute",
                    inset: 0,
                    backgroundSize: "200px 200px",
                    backgroundImage: "linear-gradient(rgba(232, 164, 68, 0.4) 4px, transparent 4px), linear-gradient(90deg, rgba(232, 164, 68, 0.4) 4px, transparent 4px)",
                    transform: `translateY(${scrollOffset}px)`
                }} />
            </div>

            <AbsoluteFill style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                {logoVisible && (
                    <div style={{ position: "relative", transform: `scale(${logoScale})` }}>
                        {/* Base Logo */}
                        <div style={{
                            fontSize: "150px",
                            fontWeight: 900,
                            fontFamily: "'Space Grotesk', sans-serif",
                            color: "#FFF",
                            zIndex: 10,
                            position: "relative"
                        }}>
                            guessNFT
                        </div>

                        {/* Red Channel (Left shift) */}
                        <div style={{
                            position: "absolute", inset: 0,
                            fontSize: "150px", fontWeight: 900, fontFamily: "'Space Grotesk', sans-serif",
                            color: "red",
                            mixBlendMode: "screen",
                            zIndex: 9,
                            transform: `translateX(-${aberration}px)`
                        }}>
                            guessNFT
                        </div>

                        {/* Blue Channel (Right shift) */}
                        <div style={{
                            position: "absolute", inset: 0,
                            fontSize: "150px", fontWeight: 900, fontFamily: "'Space Grotesk', sans-serif",
                            color: "blue",
                            mixBlendMode: "screen",
                            zIndex: 9,
                            transform: `translateX(${aberration}px)`
                        }}>
                            guessNFT
                        </div>
                    </div>
                )}

                {/* URL Fade In */}
                <div style={{
                    opacity: interpolate(frame, [70, 90], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" }),
                    color: "rgba(255,255,255,0.7)",
                    fontSize: "50px",
                    marginTop: "40px",
                    fontFamily: "'Space Grotesk', sans-serif"
                }}>
                    guess-nft.io
                </div>
            </AbsoluteFill>
        </AbsoluteFill>
    );
};
