import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

export const Cursor: React.FC<{
    typingDuration: number;
    visible: boolean;
}> = ({ typingDuration, visible }) => {
    const frame = useCurrentFrame();

    if (!visible) return null;

    const isTyping = frame < typingDuration;
    // Blink only when not typing
    const blink = isTyping
        ? 1
        : interpolate(frame % 30, [0, 15, 16, 30], [1, 1, 0, 0]);

    return (
        <span
            style={{
                display: "inline-block",
                width: "12px",
                height: "24px",
                backgroundColor: "#E8A444",
                marginLeft: "4px",
                verticalAlign: "middle",
                opacity: blink,
            }}
        />
    );
};
