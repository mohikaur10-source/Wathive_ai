import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, Search, Building, Navigation, Compass, Check, AlertCircle } from 'lucide-react';
import { UW_CAMPUS_VENUES, UWVenuePreset } from '../../data/mockData';

interface LocationMapPickerProps {
  coordinates: { lat: number; lng: number };
  onChangeCoordinates: (coords: { lat: number; lng: number }) => void;
  venueName: string;
  onChangeVenueName: (name: string) => void;
  address: string;
  onChangeAddress: (addr: string) => void;
  roomNumber: string;
  onChangeRoomNumber: (room: string) => void;
  arrivalInstructions: string;
  onChangeArrivalInstructions: (notes: string) => void;
}

export const LocationMapPicker: React.FC<LocationMapPickerProps> = ({
  coordinates,
  onChangeCoordinates,
  venueName,
  onChangeVenueName,
  address,
  onChangeAddress,
  roomNumber,
  onChangeRoomNumber,
  arrivalInstructions,
  onChangeArrivalInstructions
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [showPresetsDropdown, setShowPresetsDropdown] = useState(false);

  // Filter campus venue presets based on search query
  const filteredVenues = UW_CAMPUS_VENUES.filter((v) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      v.name.toLowerCase().includes(q) ||
      v.code.toLowerCase().includes(q) ||
      v.description.toLowerCase().includes(q)
    );
  });

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [coordinates.lat, coordinates.lng],
        zoom: 16,
        zoomControl: false,
        attributionControl: false
      });

      // Add OpenStreetMap tiles
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      // Attribution
      L.control
        .attribution({ position: 'bottomright', prefix: false })
        .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>')
        .addTo(map);

      // Custom Waterloo Draggable Marker
      const markerHtml = `
        <div class="relative group cursor-grab active:cursor-grabbing transition-transform">
          <div class="w-9 h-9 rounded-2xl bg-amber-400 border-2 border-stone-950 text-stone-950 flex items-center justify-center shadow-lg font-black">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path></svg>
          </div>
          <div class="w-2.5 h-2.5 rounded-full bg-stone-950 mx-auto -mt-1 opacity-90"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-event-pin',
        html: markerHtml,
        iconSize: [36, 42],
        iconAnchor: [18, 42]
      });

      const marker = L.marker([coordinates.lat, coordinates.lng], {
        icon: customIcon,
        draggable: true
      });

      marker.on('dragend', (e) => {
        const markerPos = (e.target as L.Marker).getLatLng();
        onChangeCoordinates({ lat: Number(markerPos.lat.toFixed(5)), lng: Number(markerPos.lng.toFixed(5)) });
      });

      marker.addTo(map);
      markerRef.current = marker;

      // Click to move pin
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        const newCoords = { lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) };
        marker.setLatLng([newCoords.lat, newCoords.lng]);
        onChangeCoordinates(newCoords);
      });

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update marker position when coordinates prop changes from outside
  useEffect(() => {
    if (markerRef.current && mapInstanceRef.current) {
      markerRef.current.setLatLng([coordinates.lat, coordinates.lng]);
    }
  }, [coordinates.lat, coordinates.lng]);

  const handleSelectVenuePreset = (venue: UWVenuePreset) => {
    onChangeVenueName(venue.name);
    onChangeAddress(venue.address);
    onChangeCoordinates({ lat: venue.lat, lng: venue.lng });
    setShowPresetsDropdown(false);
    setSearchQuery('');

    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.setView([venue.lat, venue.lng], 17, { animate: true });
      markerRef.current.setLatLng([venue.lat, venue.lng]);
    }
  };

  const handleRecenterOnPin = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([coordinates.lat, coordinates.lng], 17, { animate: true });
    }
  };

  return (
    <div className="space-y-4 rounded-2xl bg-stone-50 border border-stone-200 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200/60 pb-3">
        <div>
          <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-amber-600" />
            <span>Campus Location & Interactive Map Pin</span>
          </span>
          <p className="text-[11px] text-stone-500">
            Select a UW campus building or click/drag the pin on the map to set the exact meeting location.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="text-[11px] font-mono text-stone-600 bg-white px-2 py-1 rounded-lg border border-stone-200">
            {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}
          </span>
          <button
            type="button"
            onClick={handleRecenterOnPin}
            className="p-1.5 bg-white hover:bg-stone-100 text-stone-700 rounded-lg border border-stone-200 text-xs font-semibold cursor-pointer"
            title="Focus pin"
          >
            <Compass className="w-3.5 h-3.5 text-stone-700" />
          </button>
        </div>
      </div>

      {/* Campus Venue Search & Quick Presets (No API key required) */}
      <div className="relative">
        <label className="block text-xs font-semibold text-stone-700 mb-1">
          Search UW Campus Venues or Choose Preset
        </label>
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onFocus={() => setShowPresetsDropdown(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowPresetsDropdown(true);
            }}
            placeholder="Type building name (e.g. SLC, Engineering 7, PAC, STC, MC)..."
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Dropdown list of Waterloo campus venues */}
        {showPresetsDropdown && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-30 max-h-56 overflow-y-auto bg-white rounded-2xl border border-stone-200 shadow-xl p-2 space-y-1">
            <div className="flex items-center justify-between px-2 py-1 text-[11px] font-bold text-stone-500 border-b border-stone-100">
              <span>Waterloo Campus Buildings ({filteredVenues.length})</span>
              <button
                type="button"
                onClick={() => setShowPresetsDropdown(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                Close
              </button>
            </div>
            {filteredVenues.map((venue) => (
              <button
                key={venue.name}
                type="button"
                onClick={() => handleSelectVenuePreset(venue)}
                className="w-full text-left p-2 rounded-xl hover:bg-amber-50 flex items-start gap-2.5 transition-colors cursor-pointer group"
              >
                <div className="w-6 h-6 rounded-lg bg-stone-100 group-hover:bg-amber-400 text-stone-700 group-hover:text-stone-950 font-bold text-[10px] flex items-center justify-center shrink-0">
                  {venue.code}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-stone-900 truncate">{venue.name}</div>
                  <div className="text-[11px] text-stone-500 truncate">{venue.description}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick Venue Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
        <span className="text-[11px] text-stone-500 font-semibold shrink-0">Popular:</span>
        {UW_CAMPUS_VENUES.slice(0, 6).map((v) => (
          <button
            key={v.name}
            type="button"
            onClick={() => handleSelectVenuePreset(v)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition-colors cursor-pointer ${
              venueName === v.name
                ? 'bg-stone-950 text-amber-300'
                : 'bg-white border border-stone-200 text-stone-700 hover:border-amber-400'
            }`}
          >
            {v.code}
          </button>
        ))}
      </div>

      {/* Interactive Leaflet Map for Pin Placement */}
      <div className="relative w-full h-56 sm:h-64 rounded-2xl overflow-hidden border border-stone-200 bg-stone-200 shadow-inner">
        <div ref={mapContainerRef} className="w-full h-full z-0" />
        <div className="absolute bottom-2 left-2 z-10 bg-stone-900/85 backdrop-blur-xs text-white text-[11px] px-2.5 py-1 rounded-lg shadow-xs pointer-events-none">
          Click map or drag the pin to set exact coordinates
        </div>
      </div>

      {/* Manual Editable Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">
            Confirmed Building / Venue Name *
          </label>
          <input
            type="text"
            required
            value={venueName}
            onChange={(e) => onChangeVenueName(e.target.value)}
            placeholder="e.g. Student Life Centre (SLC)"
            className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-stone-200 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">
            Campus Address
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => onChangeAddress(e.target.value)}
            placeholder="e.g. 200 University Ave W, Waterloo, ON"
            className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-stone-200 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">
            Room, Floor, or Booth (Optional)
          </label>
          <input
            type="text"
            value={roomNumber}
            onChange={(e) => onChangeRoomNumber(e.target.value)}
            placeholder="e.g. Multi-Purpose Room (MPR), 2nd Floor"
            className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-stone-200 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">
            Arrival & Entrance Instructions (Optional)
          </label>
          <input
            type="text"
            value={arrivalInstructions}
            onChange={(e) => onChangeArrivalInstructions(e.target.value)}
            placeholder="e.g. Enter through West courtyard doors, elevator on left"
            className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-stone-200 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>
    </div>
  );
};
