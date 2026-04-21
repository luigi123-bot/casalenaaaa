'use client';

import { useEffect, useState, ComponentType } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

// Fix for dynamic components with children in TypeScript
import type { MapContainerProps, TileLayerProps, MarkerProps, PopupProps, PolylineProps } from 'react-leaflet';

// Dynamic import for Leaflet elements (disables SSR which breaks Leaflet)
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer as ComponentType<MapContainerProps>), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer as ComponentType<TileLayerProps>), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker as ComponentType<MarkerProps>), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup as ComponentType<PopupProps>), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then(mod => mod.Polyline as ComponentType<PolylineProps>), { ssr: false });

let L: any = null;
if (typeof window !== 'undefined') {
    L = require('leaflet');
    
    // Fix leaflet marker icon paths
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: '/leaflet/marker-icon-2x.png',
        iconUrl: '/leaflet/marker-icon.png',
        shadowUrl: '/leaflet/marker-shadow.png',
    });
}

// Map Component Props
interface DeliveryMapProps {
    origin: [number, number];
    destination: [number, number] | null;
    driverLocation: [number, number] | null;
    driverName?: string;
}

export default function DeliveryMap({ origin, destination, driverLocation, driverName }: DeliveryMapProps) {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted || typeof window === 'undefined') return <div className="w-full h-full bg-gray-100 animate-pulse rounded-2xl flex items-center justify-center">Cargando mapa...</div>;

    const restaurantIcon = new L.Icon({
        iconUrl: 'https://cdn-icons-png.flaticon.com/512/3081/3081986.png',
        iconSize: [35, 35],
        iconAnchor: [17, 35],
        popupAnchor: [0, -35]
    });

    const destinationIcon = new L.Icon({
        iconUrl: 'https://cdn-icons-png.flaticon.com/512/484/484167.png',
        iconSize: [35, 35],
        iconAnchor: [17, 35],
        popupAnchor: [0, -35]
    });

    const driverIcon = new L.Icon({
        iconUrl: 'https://cdn-icons-png.flaticon.com/512/3097/3097003.png',
        iconSize: [45, 45],
        iconAnchor: [22, 45],
        popupAnchor: [0, -45],
        className: 'transition-all duration-1000'
    });

    // Simple bounds calculation
    const bounds = L.latLngBounds([]);
    if (origin) bounds.extend(origin);
    if (destination) bounds.extend(destination);
    if (driverLocation) bounds.extend(driverLocation);

    // Fallback if no bounds
    const defaultCenter = [19.4326, -99.1332]; // CDMX center default if absolutely nothing is known
    
    // Si no hay limites validos, no pasamos `bounds` sino un center estático.
    const hasValidBounds = !!origin || !!destination || !!driverLocation;

    return (
        <div className="w-full h-full min-h-[250px] relative z-0 rounded-2xl overflow-hidden shadow-inner border border-gray-200">
            {hasValidBounds ? (
                <MapContainer 
                    bounds={bounds} 
                    zoom={14} 
                    scrollWheelZoom={true} 
                    className="w-full h-full z-0"
                    boundsOptions={{ padding: [50, 50] }}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    
                    {/* Store Marker */}
                    {origin && (
                        <Marker position={origin} icon={restaurantIcon}>
                            <Popup><div className="font-black text-sm">Restaurante</div></Popup>
                        </Marker>
                    )}

                    {/* Customer Marker */}
                    {destination && (
                        <Marker position={destination} icon={destinationIcon}>
                            <Popup><div className="font-black text-sm">Destino Cliente</div></Popup>
                        </Marker>
                    )}

                    {/* Driver Marker */}
                    {driverLocation && (
                        <Marker position={driverLocation} icon={driverIcon}>
                            <Popup>
                                <div className="font-black text-sm">{driverName || 'Tu ubicación'}</div>
                                <div className="text-xs text-gray-500">En ruta...</div>
                            </Popup>
                        </Marker>
                    )}

                    {origin && destination && (
                        <Polyline positions={[origin, destination]} color="#f7951d" dashArray="5, 10" weight={3} opacity={0.5} />
                    )}
                    
                    {driverLocation && destination && (
                        <Polyline positions={[driverLocation, destination]} color="#10b981" weight={4} />
                    )}
                </MapContainer>
            ) : (
                <div className="w-full h-full bg-gray-100 flex items-center justify-center font-bold text-gray-400">
                    Buscando señal GPS...
                </div>
            )}
        </div>
    );
}
