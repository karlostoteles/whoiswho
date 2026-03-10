import React from "react";
import { AbsoluteFill, Sequence, spring, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { MacTerminal } from "./MacTerminal";
import { BoardScene } from "./BoardScene";
import { OutroScene } from "./OutroScene";

export const Master: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    return (
        <AbsoluteFill style={{ backgroundColor: "#0f0e17" }}>
            {/* Scene 1: Hacker Terminal (0 - 150 frames / 5 seconds) */}
            <Sequence from={0} durationInFrames={150}>
                {/* Scale up massively at the end of the scene to transition */}
                <AbsoluteFill style={{
                    transform: `scale(${interpolate(frame, [130, 150], [1, 10], { extrapolateRight: "clamp", extrapolateLeft: "clamp" })})`,
                    opacity: interpolate(frame, [140, 150], [1, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" })
                }}>
                    <MacTerminal />
                </AbsoluteFill>
            </Sequence>

            {/* Scene 2 & 3: Board & Turn Timer (140 - 300 frames) */}
            {/* slight overlap for transition */}
            <Sequence from={140} durationInFrames={160}>
                {/* Scale up to transition away */}
                <AbsoluteFill style={{
                    transform: `translateY(${interpolate(frame - 140, [150, 160], [0, -2000], { extrapolateRight: "clamp", extrapolateLeft: "clamp" })}px)`
                }}>
                    <BoardScene />
                </AbsoluteFill>
            </Sequence>

            {/* Scene 4: Outro (290 - 400 frames) */}
            <Sequence from={290} durationInFrames={110}>
                <AbsoluteFill style={{
                    transform: `translateY(${interpolate(frame - 290, [0, 20], [2000, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" })}px)`
                }}>
                    <OutroScene />
                </AbsoluteFill>
            </Sequence>
        </AbsoluteFill>
    );
};
