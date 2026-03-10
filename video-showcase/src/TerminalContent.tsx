import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { Cursor } from "./Cursor";

const LINES = [
    { text: "ssh root@starknet.io", type: "input", delay: 0 },
    { text: "starknet_client: connecting to sequencer...", type: "log", delay: 30 },
    { text: "starknet_client: connected. block 1,489,203", type: "success", delay: 50 },
    { text: "npm run launch:guessNFT", type: "input", delay: 80 },
    { text: "> guess-nft@1.0.0 launch", type: "log", delay: 110 },
    { text: "> cross-env NODE_ENV=production node server.js", type: "log", delay: 120 },
    { text: "INIT: Indexing 999 Schizodios...", type: "log", delay: 140 },
    { text: "INIT: Synchronizing zero-knowledge proofs...", type: "log", delay: 160 },
    { text: "STATUS: System Online. Awaiting targets.", type: "success", delay: 190 },
];

export const TerminalContent: React.FC = () => {
    const frame = useCurrentFrame();

    return (
        <div style={{ padding: "40px", color: "#A3A3A3", fontFamily: "'Fira Code', monospace", fontSize: "24px", lineHeight: "1.6" }}>
            <div style={{ marginBottom: "20px", color: "#F472B6" }}>
                guessNFTOS v2.0.4 (Starknet)
            </div>

            {LINES.map((line, i) => {
                // Find if this is the currently typing input line
                const isInput = line.type === "input";
                const isVisible = frame >= line.delay;

                let displayLines = "";
                let typingDone = false;

                if (!isVisible) return null;

                if (isInput) {
                    // Typewriter effect
                    const charsTyped = Math.floor(interpolate(frame, [line.delay, line.delay + line.text.length], [0, line.text.length], { extrapolateRight: "clamp" }));
                    displayLines = line.text.substring(0, charsTyped);
                    typingDone = charsTyped === line.text.length;
                } else {
                    displayLines = line.text;
                    typingDone = true;
                }

                // Color mapped to type
                let color = "#A3A3A3";
                if (line.type === "input") color = "#E8A444";
                if (line.type === "success") color = "#4ADE80";

                // Determine if this line should render the cursor
                // Cursor renders on the last visible line
                const isLastVisibleLine = i === LINES.length - 1 || frame < LINES[i + 1].delay;

                return (
                    <div key={i} style={{ color, display: "flex", alignItems: "center", marginBottom: "8px" }}>
                        {isInput && <span style={{ color: "#F472B6", marginRight: "12px" }}>❯</span>}
                        <span>{displayLines}</span>
                        {isLastVisibleLine && (
                            <Cursor typingDuration={line.delay + line.text.length} visible={true} />
                        )}
                    </div>
                );
            })}
        </div>
    );
};
