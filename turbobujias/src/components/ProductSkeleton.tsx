import React from 'react';

export const ProductSkeleton = () => {
  return (
    <div className="group bg-neutral-900 border border-neutral-800 overflow-hidden flex flex-col h-full rounded-none relative">
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_1.5s_infinite] pointer-events-none z-10" />
      <div className="relative aspect-square bg-neutral-800"></div>
      <div className="p-4 flex flex-col flex-1 gap-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 bg-neutral-800 rounded-none"></div>
          <div className="h-4 w-20 bg-neutral-800 rounded-none"></div>
        </div>
        <div className="h-6 w-3/4 bg-neutral-800 rounded-none"></div>
        <div className="h-4 w-full bg-neutral-800 rounded-none"></div>
        <div className="h-4 w-1/2 bg-neutral-800 rounded-none"></div>
        <div className="flex items-center justify-between mt-auto pt-4">
          <div className="h-8 w-20 bg-neutral-800 rounded-none"></div>
          <div className="flex gap-2">
            <div className="h-10 w-10 bg-neutral-800 rounded-none"></div>
            <div className="h-10 w-10 bg-neutral-800 rounded-none"></div>
          </div>
        </div>
      </div>
    </div>
  );
};
