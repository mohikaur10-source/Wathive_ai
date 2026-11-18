import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Compass,
  MapPin,
  Navigation,
  ExternalLink,
  Calendar,
  Clock,
  Layers,
  Building,
  AlertCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  RotateCcw,
  Info
} from 'lucide-react';
import { EventItem } from '../../types';
import { CATEGORY_COLORS, UW_CAMPUS_VENUES } from '../../data/mockData';

interface CampusEventMapProps {
  events: EventItem[];
  onSelectEvent: (event: EventItem) => void;
  onClearFilters?: () => void;
  onSwitchToList?: () => void;
  activeDateLabel?: string;
}

// University of Waterloo main campus coordinates
const UW_CENTER_LAT = 43.4723;
const UW_CENTER_LNG = -80.5449;
const DEFAULT_ZOOM = 15;

export const CampusEventMap: React.FC<CampusEventMapProps> = ({
  events,
  onSelectEvent,
  onClearFilters,
  onSwitchToList,
  activeDateLabel
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  // States
  const [selectedGroup, setSelectedGroup] = useState<EventItem[] | null>(null);
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [tileError, setTileError] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);

  // Apply the same filtered events as the list view (excluding only online, unpositioned, or cancelled)
  const mapEvents = events.filter(
    (e) => !e.isOnline && e.coordinates && e.status !== 'cancelled'
  );

  // Group events by approximate location (within ~20 meters)
  const groupedEvents = React.useMemo(() => {
    const groups: EventItem[][] = [];
    const threshold = 0.00025; // roughly 20-25 meters

    mapEvents.forEach((ev) => {
      if (!ev.coordinates) return;
      const existing = groups.find((g) => {
        const first = g[0];
        if (!first.coordinates) return false;
        const dLat = Math.abs(first.coordinates.lat - ev.coordinates!.lat);
        const dLng = Math.abs(first.coordinates.lng - ev.coordinates!.lng);
        return dLat < threshold && dLng < threshold;
      });

      if (existing) {
        existing.push(ev);
      } else {
        groups.push([ev]);
      }
    });

    return groups;
  }, [mapEvents]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [UW_CENTER_LAT, UW_CENTER_LNG],
        zoom: DEFAULT_ZOOM,
        zoomControl: false,
        attributionControl: false
      });

      // Add OpenStreetMap standard tiles
      const tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
      });

      tileLayer.on('tileerror', () => {
        setTileError(true);
      });

      tileLayer.addTo(map);

      // Add custom positioned attribution
      L.control
        .attribution({
          position: 'bottomright',
          prefix: false
        })
        .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" class="text-stone-700 underline">OpenStreetMap</a>')
        .addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = markersGroup;
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Sync Markers when groupedEvents change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    groupedEvents.forEach((group) => {
      const primary = group[0];
      if (!primary.coordinates) return;

      const count = group.length;
      const catColor = CATEGORY_COLORS[primary.category]?.hex || '#EAAA00';

      // Create a stylish Waterloo custom HTML pin
      const iconHtml = `
        <div class="relative group cursor-pointer transition-transform hover:scale-110 active:scale-95">
          <div class="w-8 h-8 rounded-2xl flex items-center justify-center shadow-md border-2 border-white text-white font-bold text-xs" style="background-color: ${catColor};">
            ${
              count > 1
                ? `<span class="text-xs font-black">${count}</span>`
                : `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path></svg>`
            }
          </div>
          <div class="w-2 h-2 rounded-full bg-stone-900 mx-auto -mt-0.5 opacity-80"></div>
          ${
            count > 1
              ? `<div class="absolute -top-1 -right-1 w-4 h-4 bg-stone-950 text-amber-300 rounded-full border border-white text-[9px] font-black flex items-center justify-center shadow-xs">${count}</div>`
              : ''
          }
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-event-pin',
        html: iconHtml,
        iconSize: [32, 36],
        iconAnchor: [16, 36],
        popupAnchor: [0, -36]
      });

      const marker = L.marker([primary.coordinates.lat, primary.coordinates.lng], {
        icon: customIcon
      });

      marker.on('click', () => {
        setSelectedGroup(group);
        setActiveGroupIndex(0);
        map.panTo([primary.coordinates!.lat, primary.coordinates!.lng], { animate: true });
      });

      marker.addTo(layer);
    });
  }, [groupedEvents]);

  // Request browser location
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationNotice('Geolocation is not supported by your browser.');
      setTimeout(() => setLocationNotice(null), 4000);
      return;
    }

    setIsLocating(true);
    setLocationNotice(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;
        setUserLocation({ lat: latitude, lng: longitude });

        const map = mapInstanceRef.current;
        if (map) {
          map.setView([latitude, longitude], 16, { animate: true });

          // Update or create user marker
          if (userMarkerRef.current) {
            userMarkerRef.current.setLatLng([latitude, longitude]);
          } else {
            const userIconHtml = `
              <div class="relative flex items-center justify-center">
                <span class="animate-ping absolute inline-flex h-7 w-7 rounded-full bg-amber-400 opacity-75"></span>
                <div class="w-4 h-4 rounded-full bg-stone-950 border-2 border-amber-400 shadow-md"></div>
              </div>
            `;
            const userIcon = L.divIcon({
              className: 'custom-user-pin',
              html: userIconHtml,
              iconSize: [28, 28],
              iconAnchor: [14, 14]
            });
            const uMarker = L.marker([latitude, longitude], { icon: userIcon });
            uMarker.bindTooltip('You are here', { permanent: false, direction: 'top' });
            uMarker.addTo(map);
            userMarkerRef.current = uMarker;
          }
        }
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation denied or error:', err.message);
        setLocationNotice('Location permission not granted. You can still explore the map or enter your starting point in Google Maps.');
        setTimeout(() => setLocationNotice(null), 6000);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Re-center on UW Campus
  const handleResetCampus = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([UW_CENTER_LAT, UW_CENTER_LNG], DEFAULT_ZOOM, {
        animate: true
      });
    }
  };

  // Zoom helpers
  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  // Get external Google Maps directions link
  const getDirectionsUrl = (event: EventItem) => {
    if (!event.coordinates) return '#';
    const dest = `${event.coordinates.lat},${event.coordinates.lng}`;
    let url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
    if (userLocation) {
      url += `&origin=${userLocation.lat},${userLocation.lng}`;
    }
    return url;
  };

  const activeEvent = selectedGroup ? selectedGroup[activeGroupIndex] : null;

  return (
    <div className="relative w-full h-[620px] sm:h-[680px] rounded-3xl overflow-hidden border border-stone-200 bg-stone-100 shadow-xs flex flex-col">
      {/* Tile loading warning banner (if OSM tile error occurs) */}
      {tileError && (
        <div className="absolute top-3 left-3 right-3 z-30 p-3 bg-amber-500/10 border border-amber-300 text-amber-950 text-xs font-semibold rounded-2xl flex items-center justify-between gap-2 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Map tiles may be limited offline or by network policy. Event markers and list view remain available.</span>
          </div>
          {onSwitchToList && (
            <button
              onClick={onSwitchToList}
              className="px-2.5 py-1 bg-stone-900 text-amber-300 rounded-lg text-xs font-bold hover:bg-black transition-colors"
            >
              Switch to List
            </button>
          )}
        </div>
      )}

      {/* Location notice toast */}
      {locationNotice && (
        <div className="absolute top-14 left-4 right-4 sm:left-auto sm:right-4 z-40 max-w-sm p-3 bg-stone-900 text-white text-xs rounded-2xl shadow-lg border border-stone-800 flex items-start gap-2 animate-in slide-in-from-top-2">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="leading-snug">{locationNotice}</p>
          </div>
          <button
            onClick={() => setLocationNotice(null)}
            className="text-stone-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Map Container */}
      <div ref={mapContainerRef} className="w-full h-full flex-1 z-0" />

      {/* Floating Top Controls */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
        {/* Use My Location Button */}
        <button
          onClick={handleUseMyLocation}
          disabled={isLocating}
          className={`p-2.5 rounded-2xl shadow-md border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
            userLocation
              ? 'bg-amber-400 text-stone-950 border-amber-400 shadow-amber-400/20'
              : 'bg-white hover:bg-stone-50 text-stone-800 border-stone-200'
          }`}
          title="Use my location to find nearby events"
        >
          <Navigation className={`w-4 h-4 ${isLocating ? 'animate-spin text-amber-600' : ''}`} />
          <span className="hidden sm:inline">
            {isLocating ? 'Locating...' : userLocation ? 'Near You' : 'My Location'}
          </span>
        </button>

        {/* Center UW Campus Button */}
        <button
          onClick={handleResetCampus}
          className="p-2.5 bg-white hover:bg-stone-50 text-stone-800 border border-stone-200 rounded-2xl shadow-md text-xs font-bold flex items-center justify-center transition-all cursor-pointer"
          title="Center map on UW campus"
        >
          <Compass className="w-4 h-4 text-stone-700" />
        </button>

        {/* Legend Toggle */}
        <button
          onClick={() => setLegendOpen(!legendOpen)}
          className={`p-2.5 rounded-2xl shadow-md border text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${
            legendOpen
              ? 'bg-stone-950 text-amber-300 border-stone-950'
              : 'bg-white hover:bg-stone-50 text-stone-800 border-stone-200'
          }`}
          title="Toggle Category Legend"
        >
          <Layers className="w-4 h-4" />
        </button>

        {/* Zoom Controls */}
        <div className="flex flex-col bg-white border border-stone-200 rounded-2xl shadow-md overflow-hidden">
          <button
            onClick={handleZoomIn}
            className="w-9 h-9 flex items-center justify-center text-stone-700 hover:bg-stone-100 font-bold text-base transition-colors border-b border-stone-100 cursor-pointer"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            onClick={handleZoomOut}
            className="w-9 h-9 flex items-center justify-center text-stone-700 hover:bg-stone-100 font-bold text-base transition-colors cursor-pointer"
            aria-label="Zoom out"
          >
            −
          </button>
        </div>
      </div>

      {/* Category Legend Overlay */}
      {legendOpen && (
        <div className="absolute top-14 left-3 z-20 w-64 p-3.5 bg-white/95 backdrop-blur-xs rounded-2xl border border-stone-200 shadow-xl space-y-2.5 animate-in fade-in slide-in-from-top-1 text-xs">
          <div className="flex items-center justify-between pb-1.5 border-b border-stone-100">
            <span className="font-bold text-stone-900 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-amber-600" />
              <span>Event Categories</span>
            </span>
            <button
              onClick={() => setLegendOpen(false)}
              className="text-stone-400 hover:text-stone-700 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
            {Object.entries(CATEGORY_COLORS).map(([cat, style]) => (
              <div key={cat} className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full shrink-0 shadow-2xs border border-white"
                  style={{ backgroundColor: style.hex }}
                />
                <span className="text-[11px] font-medium text-stone-700 truncate">{cat}</span>
              </div>
            ))}
          </div>
          <div className="pt-1 border-t border-stone-100 text-[10px] text-stone-500">
            Numbers on pins indicate multiple events at that campus building.
          </div>
        </div>
      )}

      {/* Floating Status / Total Count Badge (Top Left) */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <div className="bg-stone-950/90 backdrop-blur-xs text-white px-3 py-1.5 rounded-xl border border-stone-800 shadow-md text-xs font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          <span>{mapEvents.length} in-person events on campus</span>
        </div>
      </div>

      {/* Empty State Overlay if 0 in-person events match */}
      {mapEvents.length === 0 && (
        <div className="absolute inset-x-4 top-20 z-20 max-w-md mx-auto p-6 bg-white/95 backdrop-blur-md rounded-3xl border border-stone-200 shadow-xl text-center space-y-3">
          <Building className="w-10 h-10 text-stone-400 mx-auto" />
          <h4 className="font-bold text-stone-900 text-sm sm:text-base">
            No in-person campus events match your filters
          </h4>
          <p className="text-xs text-stone-600 leading-relaxed">
            {activeDateLabel
              ? `No mapped events found for ${activeDateLabel} with your current filters.`
              : 'There are no campus pins matching your current search, date range, or category filters.'}{' '}
            Online events appear in the list view.
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            {onClearFilters && (
              <button
                type="button"
                onClick={onClearFilters}
                className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs font-bold transition-colors cursor-pointer"
              >
                Clear filters
              </button>
            )}
            {onSwitchToList && (
              <button
                type="button"
                onClick={onSwitchToList}
                className="px-3.5 py-2 rounded-xl bg-stone-950 hover:bg-black text-amber-300 text-xs font-bold transition-colors cursor-pointer"
              >
                View Event List
              </button>
            )}
          </div>
        </div>
      )}

      {/* Event Preview Popup / Mobile Bottom Sheet */}
      {activeEvent && (
        <div className="absolute inset-x-3 bottom-3 z-30 sm:max-w-md sm:left-4 sm:right-auto animate-in slide-in-from-bottom-3 duration-200">
          <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl p-4 sm:p-5 space-y-3 relative overflow-hidden">
            {/* Close button */}
            <button
              onClick={() => setSelectedGroup(null)}
              className="absolute top-3 right-3 p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-full transition-colors z-10 cursor-pointer"
              aria-label="Close preview"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Multiple events switcher at same venue */}
            {selectedGroup && selectedGroup.length > 1 && (
              <div className="flex items-center justify-between pb-2 border-b border-stone-100 text-xs">
                <span className="font-bold text-stone-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>{selectedGroup.length} events at this location</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-stone-500 font-semibold">
                    {activeGroupIndex + 1} of {selectedGroup.length}
                  </span>
                  <button
                    onClick={() =>
                      setActiveGroupIndex((prev) => (prev > 0 ? prev - 1 : selectedGroup.length - 1))
                    }
                    className="p-1 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-700 cursor-pointer"
                    aria-label="Previous event at this location"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() =>
                      setActiveGroupIndex((prev) => (prev < selectedGroup.length - 1 ? prev + 1 : 0))
                    }
                    className="p-1 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-700 cursor-pointer"
                    aria-label="Next event at this location"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Event Preview Card Content */}
            <div className="flex gap-3.5 items-start">
              <img
                src={activeEvent.coverImage}
                alt={activeEvent.title}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover shrink-0 border border-stone-100"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `${CATEGORY_COLORS[activeEvent.category]?.hex || '#EAAA00'}18`,
                      color: CATEGORY_COLORS[activeEvent.category]?.hex || '#EAAA00'
                    }}
                  >
                    {activeEvent.category}
                  </span>
                  <span className="text-[10px] font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded-full">
                    {activeEvent.isFree ? 'Free' : activeEvent.price}
                  </span>
                </div>

                <h4 className="font-bold text-sm sm:text-base text-stone-900 line-clamp-2 leading-snug">
                  {activeEvent.title}
                </h4>

                <p className="text-xs text-stone-600 truncate">
                  by {activeEvent.organizer}
                </p>
              </div>
            </div>

            {/* Venue & Time Details */}
            <div className="p-3 bg-stone-50 rounded-2xl border border-stone-100 text-xs space-y-1.5 text-stone-700">
              <div className="flex items-center gap-2 font-medium">
                <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>{activeEvent.date}</span>
                <span className="text-stone-300">·</span>
                <Clock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <span>{activeEvent.startTime} – {activeEvent.endTime}</span>
              </div>

              <div className="flex items-start gap-2 text-stone-800">
                <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{activeEvent.venueName || activeEvent.location}</p>
                  {activeEvent.roomNumber && (
                    <p className="text-[11px] text-stone-500">{activeEvent.roomNumber}</p>
                  )}
                  {activeEvent.arrivalInstructions && (
                    <p className="text-[11px] text-stone-500 italic truncate">
                      &ldquo;{activeEvent.arrivalInstructions}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Actions: View Event & Get Directions */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => onSelectEvent(activeEvent)}
                className="py-2.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-500 active:scale-98 text-stone-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Event</span>
              </button>

              <a
                href={getDirectionsUrl(activeEvent)}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3 rounded-xl bg-stone-950 hover:bg-black text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 border border-stone-800 transition-all cursor-pointer"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Get Directions</span>
                <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
