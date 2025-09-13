'use client'

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Map, Source, Layer } from 'react-map-gl/maplibre';
import { clusterLayer, clusterCountLayer, unclusteredPointLayer } from './layers';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerDescription,
    DrawerClose,
} from "@/components/ui/drawer";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { worldCountries } from "@/components/Map/worldCountries";
import { Users, CheckCircle, XCircle } from "lucide-react";
import Draggable from "react-draggable";
import { GoogleGenerativeAI } from "@google/generative-ai";


export default function Globe() {
    const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY);
    const nodeRef = useRef(null);
    const mapRef = useRef(null);
    const [universities, setUniversities] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [hoverInfo, setHoverInfo] = useState(null);
    const [drawerInfo, setDrawerInfo] = useState(null);
    const [filterMode, setFilterMode] = useState(false);
    const [hoveredCountry, setHoveredCountry] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [showEmployeePanel, setShowEmployeePanel] = useState(false);
    const [aiDescription, setAiDescription] = useState("");
    const [viewState, setViewState] = useState({
        latitude: 0,
        longitude: 0,
        zoom: 1,
    });


    // Fetch universities from backend API
    useEffect(() => {
        async function fetchUniversities() {
            try {
                const res = await fetch('http://localhost:3000/api/universities');
                const data = await res.json();

                // Transform API response to GeoJSON FeatureCollection
                const geojson = {
                    type: "FeatureCollection",
                    features: data.map((uni) => ({
                        type: "Feature",
                        geometry: {
                            type: "Point",
                            coordinates: [parseFloat(uni.longitude), parseFloat(uni.latitude)]
                        },
                        properties: {
                            id: uni.id,
                            name: uni.name,
                            country: uni.country,
                            region: uni.region,
                            category: uni.category
                        }
                    }))
                };

                setUniversities(geojson);
            } catch (error) {
                console.error("Failed to fetch universities:", error);
            }
        }

        fetchUniversities();
    }, []);

    // Fetch employees from backend API
    useEffect(() => {
        async function fetchEmployees() {
            try {
                const res = await fetch('http://localhost:3000/api/employees');
                const data = await res.json();
                setEmployees(data);
            } catch (error) {
                console.error("Failed to fetch employees:", error);
            }
        }

        fetchEmployees();
    }, []);

    // Available categories
    const categories = ['All', 'ENGINEERING', 'ARTS', 'FINANCE', 'SCIENCE'];

    const countryConfigs = {
        'India': {
            center: [78.9629, 20.5937],
            zoom: 5,
            defaultColor: '#00FF00',
            hoverColor: '#FF6B35',
            borderColor: '#00CC00',
            hoverBorderColor: '#CC5500'
        },
        'Afghanistan': {
            center: [67.7090, 33.9391],
            zoom: 6,
            defaultColor: '#FF4444',
            hoverColor: '#FF8888',
            borderColor: '#CC3333',
            hoverBorderColor: '#FF6666'
        },
        'South Africa': {
            center: [22.9375, -30.5595],
            zoom: 5,
            defaultColor: '#FFD700',
            hoverColor: '#FFA500',
            borderColor: '#CCAA00',
            hoverBorderColor: '#CC8800'
        },
        'Greenland': {
            center: [-42.6043, 71.7069],
            zoom: 3,
            defaultColor: '#87CEEB',
            hoverColor: '#4682B4',
            borderColor: '#5F9EA0',
            hoverBorderColor: '#4169E1'
        },
        'Australia': {
            center: [133.7751, -25.2744],
            zoom: 4,
            defaultColor: '#FF6347',
            hoverColor: '#FF4500',
            borderColor: '#CD5C5C',
            hoverBorderColor: '#DC143C'
        },
        'New Zealand': {
            center: [174.8860, -40.9006],
            zoom: 5,
            defaultColor: '#32CD32',
            hoverColor: '#228B22',
            borderColor: '#00FF32',
            hoverBorderColor: '#008000'
        },
        'United States of America': {
            center: [-95.7129, 37.0902],
            zoom: 4,
            defaultColor: '#4169E1',
            hoverColor: '#0000FF',
            borderColor: '#1E90FF',
            hoverBorderColor: '#0066CC'
        },
        'Iran': {
            center: [53.6880, 32.4279],
            zoom: 5,
            defaultColor: '#9370DB',
            hoverColor: '#8A2BE2',
            borderColor: '#7B68EE',
            hoverBorderColor: '#6A5ACD'
        },
        'China': {
            center: [104.1954, 35.8617],
            zoom: 4,
            defaultColor: '#DC143C',
            hoverColor: '#B22222',
            borderColor: '#FF1493',
            hoverBorderColor: '#C71585'
        },
        'Russia': {
            center: [105.3188, 61.5240],
            zoom: 3,
            defaultColor: '#FF69B4',
            hoverColor: '#FF1493',
            borderColor: '#FF6347',
            hoverBorderColor: '#FF4500'
        }
    };

    // Get list of supported countries
    const supportedCountries = Object.keys(countryConfigs);

    const filteredUniversitiesData = useMemo(() => {
        if (!universities.features) return { type: "FeatureCollection", features: [] };

        if (selectedCategory === 'All') {
            return universities;
        }

        return {
            ...universities,
            features: universities.features.filter(
                (feature) => feature.properties.category === selectedCategory
            )
        };
    }, [selectedCategory, universities]);

    // Create inspection zones for selected employees
    const inspectionZonesData = useMemo(() => {
        if (selectedEmployees.length === 0 || !universities.features) {
            return { type: "FeatureCollection", features: [] };
        }

        const zones = [];
        selectedEmployees.forEach((employeeId) => {
            const employee = employees.find(emp => emp.id === employeeId);
            if (!employee) return;

            employee.inspections.forEach((inspection) => {
                const university = universities.features.find(
                    uni => uni.properties.id === inspection.universityId
                );
                if (university) {
                    // Create a circular zone around the university
                    const center = university.geometry.coordinates;
                    const radius = 5; // degrees (approximately 55km)
                    const points = 64;
                    const coordinates = [];

                    for (let i = 0; i <= points; i++) {
                        const angle = (i * 2 * Math.PI) / points;
                        const lat = center[1] + (radius * Math.cos(angle));
                        const lng = center[0] + (radius * Math.sin(angle));
                        coordinates.push([lng, lat]);
                    }

                    zones.push({
                        type: "Feature",
                        geometry: {
                            type: "Polygon",
                            coordinates: [coordinates]
                        },
                        properties: {
                            employeeId: employee.id,
                            employeeName: employee.name,
                            universityId: inspection.universityId,
                            inspectedAt: inspection.inspectedAt,
                            isInspected: true
                        }
                    });
                }
            });
        });

        return {
            type: "FeatureCollection",
            features: zones
        };
    }, [selectedEmployees, employees, universities]);

    // Get inspection status for a university
    const getUniversityInspectionStatus = (universityId) => {
        if (selectedEmployees.length === 0) return null;

        const inspections = [];
        selectedEmployees.forEach(employeeId => {
            const employee = employees.find(emp => emp.id === employeeId);
            if (employee) {
                const inspection = employee.inspections.find(
                    insp => insp.universityId === universityId
                );
                if (inspection) {
                    inspections.push({
                        employee: employee.name,
                        inspectedAt: inspection.inspectedAt
                    });
                }
            }
        });

        return inspections.length > 0 ? inspections : null;
    };

    useEffect(() => {
        const map = mapRef.current?.getMap?.();
        if (!map) return;

        // remove overlay host since we don't use react-map-gl Popup
        const container = map.getContainer();
        const overlayHost = container.querySelector('[mapboxgl-children]');
        if (overlayHost) overlayHost.remove();
    }, []);

    const onClick = async (event) => {
        // Try to find marker first
        const markerFeature = event.features?.find(f => f.source === 'universitiesData');
        if (markerFeature) {
            if (markerFeature.properties.cluster) {
                const clusterId = markerFeature.properties.cluster_id;
                const geojsonSource = mapRef.current?.getSource('universitiesData');
                const zoom = await geojsonSource.getClusterExpansionZoom(clusterId);
                mapRef.current?.easeTo({
                    center: markerFeature.geometry.coordinates,
                    zoom,
                    duration: 500,
                });
            } else {
                const inspectionStatus = getUniversityInspectionStatus(markerFeature.properties.id);
                setDrawerInfo({
                    ...markerFeature.properties,
                    inspectionStatus
                });
            }
            return; // handled marker click
        }

        // Then check if country was clicked (filterMode)
        if (filterMode) {
            const countryFeature = event.features?.find(f => f.source === 'countries');
            if (countryFeature) {
                const countryName = countryFeature.properties.name;
                const countryConfig = countryConfigs[countryName];
                if (countryConfig) {
                    mapRef.current?.easeTo({
                        center: countryConfig.center,
                        zoom: countryConfig.zoom,
                        duration: 1000,
                    });
                }
            }
        }
    };

    const onHover = (event) => {
        // Handle university marker tooltips (always active)
        const universityFeature = event.features && event.features.find(f =>
            f.source === 'universitiesData' && !f.properties.cluster
        );

        if (universityFeature) {
            const inspectionStatus = getUniversityInspectionStatus(universityFeature.properties.id);
            setHoverInfo({
                properties: {
                    ...universityFeature.properties,
                    inspectionStatus
                },
                pixel: { x: event.point.x, y: event.point.y }
            });
        } else {
            setHoverInfo(null);
        }

        // Handle country hover (only in filter mode)
        if (filterMode) {
            const countryFeature = event.features && event.features.find(f => f.source === 'countries');
            if (countryFeature) {
                const countryName = countryFeature.properties.name;
                // Only set hover state for supported countries
                if (supportedCountries.includes(countryName)) {
                    setHoveredCountry(countryName);
                } else {
                    setHoveredCountry(null);
                }
            } else {
                setHoveredCountry(null);
            }
        }
    };

    const onMouseLeave = () => {
        setHoverInfo(null);
        if (filterMode) {
            setHoveredCountry(null);
        }
    };

    const toggleFilterMode = () => {
        setFilterMode(!filterMode);
        setHoveredCountry(null);
    };

    const handleCategoryChange = (category) => {
        setSelectedCategory(category);
    };

    const handleEmployeeSelection = (employeeId, checked) => {
        setSelectedEmployees(prev =>
            checked
                ? [...prev, employeeId]
                : prev.filter(id => id !== employeeId)
        );
    };

    const toggleEmployeePanel = () => {
        setShowEmployeePanel(!showEmployeePanel);
    };

    useEffect(() => {
        async function fetchAIDescription() {
            if (!drawerInfo?.name) {
                setAiDescription("");
                return;
            }

            try {
                const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
                const prompt = `Give a short, professional 2–3 sentence description of the university named "${drawerInfo.name}" in ${drawerInfo.country}. Keep it factual and concise. with lots of emojis related to the context`;

                const result = await model.generateContent(prompt);
                const text = result.response.text();
                setAiDescription(text);
            } catch (error) {
                console.error("AI description fetch failed:", error);
                setAiDescription("AI description unavailable.");
            }
        }

        fetchAIDescription();
    }, [drawerInfo]);
    return (
        <main className="h-screen relative">
            {/* Control Panel */}
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                <button
                    onClick={toggleFilterMode}
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                        filterMode
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                >
                    {filterMode ? 'Filter: ON' : 'Filter: OFF'}
                </button>

                {/* Category Dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-200 flex items-center gap-2">
                            Category: {selectedCategory}
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                        {categories.map((category) => (
                            <DropdownMenuItem
                                key={category}
                                onClick={() => handleCategoryChange(category)}
                                className={`cursor-pointer ${
                                    selectedCategory === category
                                        ? 'bg-indigo-50 text-indigo-600 font-medium'
                                        : ''
                                }`}
                            >
                                {category}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Employee Panel Toggle */}
                <button
                    onClick={toggleEmployeePanel}
                    className="bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-200 flex items-center gap-2"
                >
                    <Users size={16} />
                    Employees ({selectedEmployees.length})
                </button>
            </div>

            {/* Employee Selection Panel */}
            {showEmployeePanel && (
                <div className="absolute top-4 left-46  z-10 bg-white rounded-lg shadow-lg border border-gray-200 p-4 max-w-sm">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-gray-900">Select Employees</h3>
                        <button
                            onClick={toggleEmployeePanel}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            ×
                        </button>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {employees.map((employee) => (
                            <div key={employee.id} className="flex items-center space-x-3">
                                <Checkbox
                                    id={`employee-${employee.id}`}
                                    checked={selectedEmployees.includes(employee.id)}
                                    onCheckedChange={(checked) =>
                                        handleEmployeeSelection(employee.id, checked)
                                    }
                                />
                                <label
                                    htmlFor={`employee-${employee.id}`}
                                    className="flex-1 cursor-pointer"
                                >
                                    <div className="text-sm font-medium text-gray-900">
                                        {employee.name}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {employee.department}
                                    </div>
                                    <div className="flex items-center gap-1 mt-1">
                                        {employee.inspections.length > 0 ? (
                                            <Badge variant="success" className="text-xs">
                                                <CheckCircle size={10} className="mr-1" />
                                                {employee.inspections.length} inspections
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="text-xs">
                                                <XCircle size={10} className="mr-1" />
                                                No inspections
                                            </Badge>
                                        )}
                                    </div>
                                </label>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <Map
                ref={mapRef}
                {...viewState}
                onMove={evt => setViewState({
                    ...evt.viewState,
                    zoom: Math.min(evt.viewState.zoom, 7) // clamp to 10
                })}
                mapStyle="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
                onMouseMove={onHover} onMouseLeave={onMouseLeave} onClick={onClick}
                interactiveLayerIds={[
                    clusterLayer.id,
                    unclusteredPointLayer.id,
                    ...(filterMode ? ['country-fill', 'country-outline'] : [])
                ]}
                className="h-full w-full"
                renderWorldCopies={false}
                attributionControl={false}
                cursor={filterMode ? 'pointer' : 'default'}
                maxZoom={10}
            >
                {/* Inspection Zones */}
                {inspectionZonesData.features.length > 0 && (
                    <Source
                        id="inspectionZones"
                        type="geojson"
                        data={inspectionZonesData}
                    >
                        <Layer
                            id="inspection-zones"
                            type="fill"
                            source="inspectionZones"
                            paint={{
                                'fill-color': '#4ECDC4',
                                'fill-opacity': 0.3
                            }}
                        />
                        <Layer
                            id="inspection-zones-outline"
                            type="line"
                            source="inspectionZones"
                            paint={{
                                'line-color': '#333333',
                                'line-width': 2,
                                'line-opacity': 0.6
                            }}
                        />
                    </Source>
                )}

                {/* Universities */}
                {universities.features && (
                    <Source
                        id="universitiesData"
                        type="geojson"
                        data={filteredUniversitiesData}
                        cluster={true}
                        clusterMaxZoom={14}
                        clusterRadius={50}
                    >
                        <Layer {...clusterLayer} />
                        <Layer {...clusterCountLayer} />
                        <Layer {...unclusteredPointLayer} />
                    </Source>
                )}

                {/* Countries Layer */}
                <Source
                    id="countries"
                    type="geojson"
                    data={worldCountries}
                >
                    <Layer
                        id="country-fill"
                        type="fill"
                        source="countries"
                        paint={{
                            'fill-color': [
                                'case',
                                // Hovered country
                                ['==', ['get', 'name'], hoveredCountry],
                                '#FF6B35',// Hover color (set directly here)

                                // Default colors
                                ['==', ['get', 'name'], 'India'], '#00FF00',
                                ['==', ['get', 'name'], 'Afghanistan'], '#FF4444',
                                ['==', ['get', 'name'], 'South Africa'], '#FFD700',
                                ['==', ['get', 'name'], 'Greenland'], '#87CEEB',
                                ['==', ['get', 'name'], 'Australia'], '#FF6347',
                                ['==', ['get', 'name'], 'New Zealand'], '#32CD32',
                                ['==', ['get', 'name'], 'United States of America'], '#4169E1',
                                ['==', ['get', 'name'], 'Iran'], '#9370DB',
                                ['==', ['get', 'name'], 'China'], '#DC143C',
                                ['==', ['get', 'name'], 'Russia'], '#FF69B4',

                                '#CCCCCC' // fallback
                            ],

                            'fill-opacity': filterMode
                                ? [
                                    'case',
                                    ['==', ['get', 'name'], hoveredCountry],
                                    0.1,
                                    ['in', ['get', 'name'], ['literal', supportedCountries]],
                                    0.6,
                                    0.1
                                ]
                                : 0,
                        }}
                    />
                    <Layer
                        id="country-outline"
                        type="line"
                        source="countries"
                        paint={{
                            'line-color': filterMode
                                ? [
                                    'case',
                                    ['==', ['get', 'name'], hoveredCountry],
                                    '#333333',
                                    ['in', ['get', 'name'], ['literal', supportedCountries]],
                                    '#000000',
                                    '#666666'
                                ]
                                : 'transparent',
                            'line-width': filterMode
                                ? [
                                    'case',
                                    ['==', ['get', 'name'], hoveredCountry],
                                    3,
                                    ['in', ['get', 'name'], ['literal', supportedCountries]],
                                    2,
                                    1
                                ]
                                : 0,
                        }}
                    />
                </Source>

                <style>{
                    `[mapboxgl-children] {
  display: none !important;
}`
                }</style>
            </Map>

            {/* Country name tooltip when in filter mode */}
            {filterMode && hoveredCountry && (
                <div className="absolute top-40 left-4 z-10 bg-black bg-opacity-75 text-white px-3 py-2 rounded-lg text-sm pointer-events-none">
                    {hoveredCountry}
                    <div className="text-xs text-gray-300 mt-1">Click to zoom in</div>
                </div>
            )}

            {/* Tooltip on hover */}
            {hoverInfo && (
                <TooltipProvider>
                    <Tooltip open>
                        <TooltipTrigger asChild>
                            <div
                                className="absolute"
                                style={{
                                    transform: "translate(-50%, -100%)",
                                    left: `${hoverInfo.pixel.x}px`,
                                    top: `${hoverInfo.pixel.y}px`,
                                }}
                            />
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            <div>
                                <div className="font-medium">{hoverInfo.properties.name}</div>
                                <div className="text-xs text-gray-400">
                                    {hoverInfo.properties.category}
                                </div>
                                {hoverInfo.properties.inspectionStatus && (
                                    <div className="mt-2 pt-2 border-t border-gray-200">
                                        <div className="text-xs font-medium text-green-600 mb-1">
                                            Inspected by:
                                        </div>
                                        {hoverInfo.properties.inspectionStatus.map((inspection, idx) => (
                                            <div key={idx} className="text-xs text-gray-500">
                                                {inspection.employee}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}

            {/* Drawer on click */}
            {/*<Drawer open={!!drawerInfo} onOpenChange={() => setDrawerInfo(null)}>*/}
            {/*    <DrawerContent>*/}
            {/*        <DrawerHeader>*/}
            {/*            <DrawerTitle className="flex items-center gap-2">*/}
            {/*                {drawerInfo?.name}*/}
            {/*                {drawerInfo?.inspectionStatus && (*/}
            {/*                    <Badge variant="success">*/}
            {/*                        <CheckCircle size={12} className="mr-1" />*/}
            {/*                        Inspected*/}
            {/*                    </Badge>*/}
            {/*                )}*/}
            {/*            </DrawerTitle>*/}
            {/*            <DrawerDescription>*/}
            {/*                <span>Country: {drawerInfo?.country}</span>*/}
            {/*                <br/>*/}
            {/*                <span>State: {drawerInfo?.state}</span>*/}
            {/*                <br/>*/}
            {/*                <span>Category: {drawerInfo?.category}</span>*/}

            {/*                {drawerInfo?.inspectionStatus && (*/}
            {/*                    <div className="mt-4 pt-4 border-t border-gray-200">*/}
            {/*                        <div className="font-medium text-gray-900 mb-2">*/}
            {/*                            Inspection Details:*/}
            {/*                        </div>*/}
            {/*                        {drawerInfo.inspectionStatus.map((inspection, idx) => (*/}
            {/*                            <div key={idx} className="bg-gray-50 rounded p-2 mb-2">*/}
            {/*                                <div className="font-medium text-sm">*/}
            {/*                                    Inspector: {inspection.employee}*/}
            {/*                                </div>*/}
            {/*                                <div className="text-xs text-gray-500">*/}
            {/*                                    Inspected: {new Date(inspection.inspectedAt).toLocaleDateString()}*/}
            {/*                                </div>*/}
            {/*                            </div>*/}
            {/*                        ))}*/}
            {/*                    </div>*/}
            {/*                )}*/}
            {/*            </DrawerDescription>*/}
            {/*        </DrawerHeader>*/}
            {/*        <DrawerClose className="absolute right-4 top-4">Close</DrawerClose>*/}
            {/*    </DrawerContent>*/}
            {/*</Drawer>*/}


            {drawerInfo && (
                <Draggable handle=".drag-handle" nodeRef={nodeRef}>
                    <div ref={nodeRef} className="absolute bottom-10 right-10 w-90 max-h-[50vh] bg-white shadow-xl rounded-lg border border-gray-300 overflow-x-hidden overflow-y-scroll z-50">
                    {/* Header */}
                        <div className="drag-handle cursor-move bg-gray-100 px-4 py-2 flex items-center justify-between">
                            <div className="flex items-center gap-2 font-medium">
                                {drawerInfo?.name}
                                {drawerInfo?.inspectionStatus && (
                                    <Badge variant="success">
                                        <CheckCircle size={12} className="mr-1" />
                                        Inspected
                                    </Badge>
                                )}
                            </div>
                            <button
                                onClick={() => setDrawerInfo(null)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                ×
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="p-4 overflow-y-auto max-h-[60vh]">
                            <p><strong>Country:</strong> {drawerInfo?.country}</p>
                            <p><strong>State:</strong> {drawerInfo?.region}</p>
                            <p><strong>Category:</strong> {drawerInfo?.category}</p>

                            {drawerInfo?.inspectionStatus && (
                                <div className="mt-4 pt-4 border-t border-gray-200">
                                    <span className="font-medium text-gray-900 mb-2">
                                        Inspection Details:
                                    </span>

                                    {drawerInfo.inspectionStatus.map((inspection, idx) => (
                                        <div key={idx} className="bg-gray-50 rounded p-2 mb-2">
                                            <span className="font-medium text-sm">
                                                Inspector: {inspection.employee}
                                            </span>
                                            <div className="text-xs text-gray-500">
                                                Inspected:{" "}
                                                {new Date(inspection.inspectedAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                    ))}

                                </div>
                            )}

                            {aiDescription && (
                                <div className="mt-4 pt-4 border-t border-gray-200">
      <span className="font-medium text-gray-900 mb-2">
        Description:
      </span>
                                    <p className="text-sm text-gray-700">{aiDescription}</p>
                                </div>
                            )}

                        </div>
                    </div>
                </Draggable>
            )}
        </main>
    );
}