import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring, staticFile } from 'remotion';
import React from 'react';

const LogoReveal: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
    const scale = spring({
        frame,
        fps,
        config: { stiffness: 100 },
    });

    return (
        <AbsoluteFill style={{
            backgroundColor: '#0f0e17',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'column'
        }}>
            <div style={{
                opacity,
                transform: `scale(${scale})`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
            }}>
                <img src={staticFile("logo.png")} style={{ height: 200, filter: 'drop-shadow(0 0 30px rgba(232,164,68,0.5))' }} />
                <h1 style={{
                    color: '#FFFFFE',
                    fontFamily: "'Space Grotesk', sans-serif",
                    marginTop: 20,
                    fontSize: 60,
                    background: 'linear-gradient(135deg, #E8A444 0%, #F472B6 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                }}>guessNFT</h1>
            </div>
        </AbsoluteFill>
    );
};

const NFTScroll: React.FC = () => {
    const frame = useCurrentFrame();
    const scrollOffset = frame * 10;

    return (
        <AbsoluteFill style={{ backgroundColor: '#0f0e17', overflow: 'hidden' }}>
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                width: '200%',
                transform: `translateX(-${scrollOffset}px)`,
                gap: 20,
                padding: 40
            }}>
                {/* Simplified placeholders for NFTs */}
                {Array.from({ length: 50 }).map((_, i) => (
                    <div key={i} style={{
                        width: 200,
                        height: 250,
                        backgroundColor: '#1c1228',
                        border: '2px solid rgba(232,164,68,0.3)',
                        borderRadius: 16
                    }} />
                ))}
            </div>
            <AbsoluteFill style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                background: 'rgba(0,0,0,0.4)'
            }}>
                <h2 style={{
                    color: '#FFF',
                    fontSize: 80,
                    fontWeight: 900,
                    textShadow: '0 0 20px rgba(0,0,0,1)'
                }}>999 SCHIZODIOS. ONE WINNER.</h2>
            </AbsoluteFill>
        </AbsoluteFill>
    );
};

const GameplayAction: React.FC = () => {
    return (
        <AbsoluteFill style={{ backgroundColor: '#0f0e17' }}>
            <img src={staticFile("vs_background.jpg")} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.3 }} />
            <AbsoluteFill style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <h2 style={{ color: '#E8A444', fontSize: 70 }}>HIGH-STAKES DEDUCTION</h2>
            </AbsoluteFill>
        </AbsoluteFill>
    );
};

const RealTimeFeatures: React.FC = () => {
    return (
        <AbsoluteFill style={{
            backgroundColor: '#0f0e17',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
        }}>
            <h2 style={{ color: '#F472B6', fontSize: 70 }}>REAL-TIME THRILL.</h2>
        </AbsoluteFill>
    );
};

const Outro: React.FC = () => {
    return (
        <AbsoluteFill style={{
            backgroundColor: '#0f0e17',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'column'
        }}>
            <img src={staticFile("logo.png")} style={{ height: 150 }} />
            <h2 style={{ color: '#FFFFFE', fontSize: 50, marginTop: 40 }}>PLAY NOW ON STARKNET</h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 24, marginTop: 10 }}>guess-nft.io</p>
        </AbsoluteFill>
    );
};

export const Showcase: React.FC = () => {
    return (
        <AbsoluteFill>
            <Sequence from={0} durationInFrames={60}>
                <LogoReveal />
            </Sequence>
            <Sequence from={60} durationInFrames={90}>
                <NFTScroll />
            </Sequence>
            <Sequence from={150} durationInFrames={150}>
                <GameplayAction />
            </Sequence>
            <Sequence from={300} durationInFrames={90}>
                <RealTimeFeatures />
            </Sequence>
            <Sequence from={390} durationInFrames={60}>
                <Outro />
            </Sequence>
        </AbsoluteFill>
    );
};
