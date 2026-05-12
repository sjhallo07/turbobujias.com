import { useState } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';

const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

export function MapSearch() {
  if (!hasValidKey) {
    return (
      <div className="p-4 border border-orange-500/20 bg-neutral-900 text-neutral-400 text-sm">
        <p>Google Maps API Key required for store locator functionality. Please add <code>GOOGLE_MAPS_PLATFORM_KEY</code> in Settings.</p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={API_KEY} version="weekly">
      <Map
        defaultCenter={{lat: 10.4806, lng: -66.9036}} // Default to Caracas for the business focus
        defaultZoom={11}
        mapId="DEMO_MAP_ID"
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{width: '100%', height: '400px'}}
      >
        <AdvancedMarker position={{lat: 10.4806, lng: -66.9036}}>
          <Pin background="#F97316" glyphColor="#fff" />
        </AdvancedMarker>
      </Map>
    </APIProvider>
  );
}
