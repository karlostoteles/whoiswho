import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { OldWorldScene } from "./OldWorldScene";
import { GameDataVatScene } from "./GameDataVatScene";
import { EngineScene } from "./EngineScene";
import { ImpactScene } from "./ImpactScene";
import { FlowchartOutroScene } from "./FlowchartOutroScene";

export const FlowchartVideo: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    return (
        <AbsoluteFill style={{ backgroundColor: "#0f0e17" }}>
            {/* Scene 1: Old World (0 - 150) */}
            <Sequence from={0} durationInFrames={150}>
                <OldWorldScene />
            </Sequence>

            {/* Scene 2: Game Data Vat (140 - 300) */}
            <Sequence from={140} durationInFrames={160}>
                <AbsoluteFill style={{
                    opacity: interpolate(frame - 140, [0, 10], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" })
                }}>
                    <GameDataVatScene />
                </AbsoluteFill>
            </Sequence>

            {/* Scene 3: Engine (Fees) (290 - 450) */}
            <Sequence from={290} durationInFrames={160}>
                <AbsoluteFill style={{
                    transform: `translateX(${interpolate(frame - 290, [0, 15], [1920, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" })}px)`
                }}>
                    <EngineScene />
                </AbsoluteFill>
            </Sequence>

            {/* Scene 4: Market Impact (440 - 600) */}
            <Sequence from={440} durationInFrames={160}>
                <AbsoluteFill style={{
                    transform: `translateX(${interpolate(frame - 440, [0, 15], [1920, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" })}px)`
                }}>
                    <ImpactScene />
                </AbsoluteFill>
            </Sequence>

            {/* Scene 5: Outro (590 - 750) */}
            <Sequence from={590} durationInFrames={160}>
                <AbsoluteFill style={{
                    opacity: interpolate(frame - 590, [0, 15], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" })
                }}>
                    <FlowchartOutroScene />
                </AbsoluteFill>
            </Sequence>
        </AbsoluteFill>
    );
};
