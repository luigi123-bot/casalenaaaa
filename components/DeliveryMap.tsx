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
    driverLocation?: [number, number] | null;
    driverName?: string;
    drivers?: Array<{
        id: string;
        full_name: string;
        current_lat: number;
        current_lng: number;
        status: string;
    }>;
}

export default function DeliveryMap({ origin, destination, driverLocation, driverName, drivers }: DeliveryMapProps) {
    const [isMounted, setIsMounted] = useState(false);
    const [route, setRoute] = useState<[number, number][]>([]);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Effect to fetch road route from OSRM
    useEffect(() => {
        if (!driverLocation || !destination) {
            setRoute([]);
            return;
        }

        const abortController = new AbortController();
        
        const fetchRoute = async () => {
            if (!driverLocation || !destination) return;
            
            try {
                const wp1 = `${driverLocation[1]},${driverLocation[0]}`;
                const wp2 = `${destination[1]},${destination[0]}`;
                const url = `https://router.project-osrm.org/route/v1/driving/${wp1};${wp2}?overview=full&geometries=geojson`;
                
                // Silently attempt fetch to avoid crashing on network glitches
                const res = await fetch(url, { 
                    signal: abortController.signal,
                    cache: 'force-cache' // Improve performance and reduce requests
                });
                
                if (!res.ok) {
                    setRoute([]);
                    return;
                }

                const data = await res.json();
                if (data?.routes?.[0]?.geometry?.coordinates) {
                    const coords = data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]] as [number, number]);
                    setRoute(coords);
                } else {
                    setRoute([]);
                }
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.log('[Routing] Notice: Road route unavailable, using straight line.');
                    setRoute([]);
                }
            }
        };

        fetchRoute();
        return () => abortController.abort();
    }, [driverLocation, destination]);

    if (!isMounted || typeof window === 'undefined') return <div className="w-full h-full bg-gray-100 animate-pulse rounded-2xl flex items-center justify-center font-bold text-gray-400">Cargando mapa...</div>;

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

    const driverIcon = (status: string) => new L.Icon({
        iconUrl: status === 'disponible' ? 'https://cdn-icons-png.flaticon.com/512/3097/3097003.png' : 'https://cdn-icons-png.flaticon.com/512/3097/3097011.png',
        iconSize: [45, 45],
        iconAnchor: [22, 45],
        popupAnchor: [0, -45],
        className: 'transition-all duration-1000'
    });

    // Simple bounds calculation
    const bounds = L.latLngBounds([]);
    
    if (route.length > 0) {
        route.forEach(p => bounds.extend(p));
    } else {
        if (origin) bounds.extend(origin);
        if (destination) bounds.extend(destination);
        if (driverLocation) bounds.extend(driverLocation);
    }
    
    if (drivers && drivers.length > 0) {
        drivers.forEach(d => {
            if (d.current_lat && d.current_lng) {
                bounds.extend([d.current_lat, d.current_lng]);
            }
        });
    }

    // Si no hay limites validos, no pasamos `bounds` sino un center estático.
    const hasValidBounds = (origin && origin[0] !== 0) || (destination && destination[0] !== 0) || (driverLocation && driverLocation[0] !== 0) || (drivers && drivers.length > 0);

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
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                        url="https://{s}.basemaps.cartocdn.com/voyager/{z}/{x}/{y}{r}.png"
                    />
                    
                    {/* Store Marker */}
                    {origin && (
                        <Marker position={origin} icon={restaurantIcon}>
                            <Popup><div className="font-black text-sm text-[#181511]">Casa Leña</div></Popup>
                        </Marker>
                    )}

                    {/* Customer Marker */}
                    {destination && (
                        <Marker position={destination} icon={destinationIcon}>
                            <Popup><div className="font-black text-sm">Destino Cliente</div></Popup>
                        </Marker>
                    )}

                    {/* Single Driver Marker */}
                    {driverLocation && (
                        <Marker position={driverLocation} icon={driverIcon('ocupado')}>
                            <Popup>
                                <div className="font-black text-sm">{driverName || 'Repartidor'}</div>
                                <div className="text-xs text-gray-500">En ruta...</div>
                            </Popup>
                        </Marker>
                    )}

                    {/* Fleet Markers */}
                    {drivers && drivers.map(d => (
                        d.current_lat && d.current_lng && (
                            <Marker key={d.id} position={[d.current_lat, d.current_lng]} icon={driverIcon(d.status)}>
                                <Popup>
                                    <div className="font-black text-sm">{d.full_name}</div>
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#f7951d]">{d.status}</div>
                                </Popup>
                            </Marker>
                        )
                    ))}

                    {/* Road Route Path (OSRM) */}
                    {route.length > 0 && (
                        <Polyline positions={route} color="#10b981" weight={5} opacity={0.8} />
                    )}

                    {/* Fallback straight line if route fails or is loading */}
                    {route.length === 0 && driverLocation && destination && (
                        <Polyline positions={[driverLocation, destination]} color="#10b981" weight={4} dashArray="5, 10" opacity={0.5} />
                    )}

                    {origin && destination && (
                        <Polyline positions={[origin, destination]} color="#f7951d" dashArray="5, 10" weight={2} opacity={0.3} />
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


