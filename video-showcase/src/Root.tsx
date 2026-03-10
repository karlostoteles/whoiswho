import { Composition } from 'remotion';
import { FlowchartVideo } from './FlowchartVideo';
import React from 'react';

export const RemotionRoot: React.FC = () => {
    return (
        <>
            <Composition
                id="FlowchartShowcase"
                component={FlowchartVideo}
                durationInFrames={750}
                fps={30}
                width={1920}
                height={1080}
            />
        </>
    );
};
