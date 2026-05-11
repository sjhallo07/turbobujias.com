import React from 'react';

export const PartnerSkeleton = () => {
  return (
    <div className="group relative bg-neutral-900 border border-neutral-800 p-6 rounded-none animate-pulse">
      <div className="flex gap-6">
        <div className="w-20 h-20 shrink-0 bg-neutral-800 border border-neutral-800"></div>
        <div className="flex-1 flex flex-col gap-2">
          <div className="h-2 w-16 bg-neutral-800 rounded-sm"></div>
          <div className="h-5 w-40 bg-neutral-800 rounded-sm"></div>
          <div className="h-3 w-28 bg-neutral-800 rounded-sm"></div>
          <div className="flex gap-3 mt-2">
            <div className="h-4 w-4 bg-neutral-800 rounded-full"></div>
            <div className="h-4 w-4 bg-neutral-800 rounded-full"></div>
            <div className="h-4 w-4 bg-neutral-800 rounded-full"></div>
          </div>
        </div>
      </div>
      <div className="mt-6 h-8 w-full bg-neutral-800 rounded-sm"></div>
    </div>
  );
};
