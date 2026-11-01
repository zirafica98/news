import React from 'react';
import { Composition } from 'remotion';
import { EP_FPS, Episode, EpizodaProps, izracunaj } from './Episode';
import primer from './primer.json';

// Primer (Ep. 1) je samo za Remotion Studio; pravi scenario stiže kroz --props iz scripts/ai-wars.mjs.
export const Root: React.FC = () => (
  <Composition
    id="Episode"
    component={Episode}
    defaultProps={primer as EpizodaProps}
    calculateMetadata={izracunaj}
    durationInFrames={1}
    fps={EP_FPS}
    width={1080}
    height={1920}
  />
);
