import React from 'react';
import { Bee } from '../common/Bee';

export interface HoneycombTileItem {
  src: string;
  alt: string;
}

interface HoneycombClusterProps {
  tiles: HoneycombTileItem[];
  prefersReduced?: boolean;
}

const TILE_POSITIONS = [
  'col-start-2 col-span-2 row-start-1',
  'col-start-4 col-span-2 row-start-1',
  'col-start-1 col-span-2 row-start-2',
  'col-start-3 col-span-2 row-start-2',
  'col-start-5 col-span-2 row-start-2'
] as const;

export const HoneycombCluster: React.FC<HoneycombClusterProps> = ({
  tiles,
  prefersReduced = false
}) => {
  return (
    <div
      className="relative isolate w-full max-w-[460px] aspect-square mx-auto p-1 select-none"
      style={{ containerType: 'inline-size' }}
    >
      <div className="grid grid-cols-6 grid-rows-3 gap-[clamp(8px,2.2cqi,14px)] w-full h-full">
        {tiles.slice(0, 5).map((tile, index) => (
          <div
            key={tile.alt}
            className={`${TILE_POSITIONS[index]} aspect-square w-full p-[4.5%] bg-surface/85 hex-mask overflow-hidden shadow-soft transition-transform duration-150 hover:-translate-y-1 motion-reduce:hover:translate-y-0`}
          >
            <img
              src={tile.src}
              alt={tile.alt}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover hex-mask block"
            />
          </div>
        ))}

        {/* Centered gold hex tile with bounded bee artwork */}
        <div
          aria-hidden="true"
          className="col-start-3 col-span-2 row-start-3 aspect-square w-full bg-accent/85 hex-mask overflow-hidden flex items-center justify-center shadow-soft"
        >
          <Bee size={36} flying={!prefersReduced} className="w-[32%] h-auto max-w-[44px]" />
        </div>
      </div>
    </div>
  );
};
