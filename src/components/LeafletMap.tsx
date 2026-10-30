import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Report, Hotspot, PriorityBand } from '../types/index.ts';

interface LeafletMapProps {
  mode: 'citizen-picker' | 'authority-dashboard';
  center?: [number, number];
  zoom?: number;
  selectedCoord?: { lat: number; lon: number } | null;
  onCoordSelect?: (lat: number, lon: number) => void;
  reports?: Report[];
  hotspots?: Hotspot[];
  selectedReportId?: string | null;
  selectedHotspotId?: string | null;
  onSelectReport?: (report: Report) => void;
  onSelectHotspot?: (hotspot: Hotspot) => void;
  className?: string;
}

const PRIORITY_COLORS: Record<PriorityBand, string> = {
  critical: '#D9480F',
  high: '#F59F00',
  medium: '#3B82F6',
  low: '#94A3B8',
};

export const LeafletMap: React.FC<LeafletMapProps> = ({
  mode,
  center = [12.9141, 74.8560],
  zoom = 14,
  selectedCoord,
  onCoordSelect,
  reports = [],
  hotspots = [],
  selectedReportId,
  selectedHotspotId,
  onSelectReport,
  onSelectHotspot,
  className = 'w-full h-full min-h-[350px]',
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const hotspotsLayerRef = useRef<L.LayerGroup | null>(null);
  const pickerMarkerRef = useRef<L.Marker | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center,
      zoom,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    hotspotsLayerRef.current = L.layerGroup().addTo(map);

    if (mode === 'citizen-picker') {
      map.on('click', (e: L.LeafletMouseEvent) => {
        if (onCoordSelect) {
          onCoordSelect(e.latlng.lat, e.latlng.lng);
        }
      });
    }

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Sync selectedCoord in citizen picker mode
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || mode !== 'citizen-picker') return;

    if (selectedCoord) {
      const pinIcon = L.divIcon({
        className: 'custom-pin',
        html: `
          <div style="
            background: #1F7A8C;
            width: 24px;
            height: 24px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 2px solid #FFFFFF;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div style="width: 8px; height: 8px; background: white; border-radius: 50%;"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 24],
      });

      if (!pickerMarkerRef.current) {
        pickerMarkerRef.current = L.marker([selectedCoord.lat, selectedCoord.lon], {
          icon: pinIcon,
          draggable: true,
        }).addTo(map);

        pickerMarkerRef.current.on('dragend', (e: any) => {
          const latlng = e.target.getLatLng();
          if (onCoordSelect) {
            onCoordSelect(latlng.lat, latlng.lng);
          }
        });
      } else {
        pickerMarkerRef.current.setLatLng([selectedCoord.lat, selectedCoord.lon]);
      }
      map.panTo([selectedCoord.lat, selectedCoord.lon], { animate: true });
    }
  }, [selectedCoord, mode, onCoordSelect]);

  // Sync reports & hotspots in authority mode or citizen preview
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    const hotspotsLayer = hotspotsLayerRef.current;
    if (!map || !markersLayer || !hotspotsLayer) return;

    markersLayer.clearLayers();
    hotspotsLayer.clearLayers();

    // 1. Draw Hotspots (translucent circles)
    hotspots.forEach((hs) => {
      const isSelected = selectedHotspotId === hs.id;
      let circleColor = '#3B82F6';
      if (hs.score >= 70) circleColor = '#D9480F';
      else if (hs.score >= 50) circleColor = '#F59F00';

      const circle = L.circle([hs.center.lat, hs.center.lon], {
        radius: hs.radiusMeters,
        color: circleColor,
        weight: isSelected ? 3 : 2,
        fillColor: circleColor,
        fillOpacity: isSelected ? 0.35 : 0.18,
        dashArray: hs.isWide ? '6, 6' : undefined,
      });

      circle.on('click', () => {
        if (onSelectHotspot) onSelectHotspot(hs);
      });

      // Hotspot count badge with high z-index so it is always clickable above report pins
      const countBadge = L.marker([hs.center.lat, hs.center.lon], {
        zIndexOffset: 2000,
        icon: L.divIcon({
          className: 'hotspot-badge',
          html: `
            <div style="
              background: ${circleColor};
              color: white;
              font-weight: 700;
              font-size: 11px;
              padding: 3px 8px;
              border-radius: 9999px;
              border: 2px solid white;
              box-shadow: 0 2px 4px rgba(0,0,0,0.25);
              white-space: nowrap;
              cursor: pointer;
              transform: translate(-50%, -50%);
            ">
              ${hs.totalReportsCount} reports
            </div>
          `,
          iconSize: [0, 0],
        }),
      });

      countBadge.on('click', () => {
        if (onSelectHotspot) onSelectHotspot(hs);
      });

      circle.addTo(hotspotsLayer);
      countBadge.addTo(hotspotsLayer);
    });

    // 2. Draw Report Markers
    reports.forEach((report) => {
      // Do not display merged duplicates directly on authority map if parent exists (they are clustered with parent)
      if (report.duplicateOf) return;

      const isSelected = selectedReportId === report.id;
      const color = PRIORITY_COLORS[report.priorityBand] || '#94A3B8';
      const size = isSelected ? 28 : 20;

      const icon = L.divIcon({
        className: 'report-pin',
        html: `
          <div style="
            background: ${color};
            width: ${size}px;
            height: ${size}px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: ${isSelected ? '3px solid #14213D' : '2px solid #FFFFFF'};
            box-shadow: ${isSelected ? '0 0 0 3px rgba(31,122,140,0.4), 0 4px 8px rgba(0,0,0,0.3)' : '0 2px 5px rgba(0,0,0,0.25)'};
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
          ">
            <div style="width: ${size / 3}px; height: ${size / 3}px; background: white; border-radius: 50%;"></div>
          </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
      });

      const marker = L.marker([report.lat, report.lon], { icon });

      marker.on('click', () => {
        if (onSelectReport) onSelectReport(report);
      });

      marker.bindTooltip(
        `<strong>${report.trackingCode}</strong> (${report.priorityBand.toUpperCase()})<br>${report.category}<br>${report.summary_en.slice(0, 40)}...`,
        { direction: 'top', offset: [0, -size] }
      );

      marker.addTo(markersLayer);
    });
  }, [reports, hotspots, selectedReportId, selectedHotspotId, onSelectReport, onSelectHotspot]);

  // Center on selected report if changed
  useEffect(() => {
    if (!selectedReportId || !mapInstanceRef.current) return;
    const rep = reports.find((r) => r.id === selectedReportId);
    if (rep) {
      mapInstanceRef.current.panTo([rep.lat, rep.lon], { animate: true });
    }
  }, [selectedReportId, reports]);

  return (
    <div className={`relative overflow-hidden rounded-xl border border-[#E1E4EE] bg-[#FFFFFF] shadow-sm ${className}`}>
      <div ref={mapContainerRef} className="w-full h-full min-h-[300px]" />
    </div>
  );
};
