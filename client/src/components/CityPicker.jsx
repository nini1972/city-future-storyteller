import React, { useState, useEffect, useRef } from 'react';
import Globe from 'react-globe.gl';
import './CityPicker.css';

const CITIES = [
  { name: 'Tokyo', lat: 35.6762, lng: 139.6503, size: 1.5, color: '#f59e0b' },
  { name: 'New York', lat: 40.7128, lng: -74.0060, size: 1.5, color: '#14b8a6' },
  { name: 'Bruges', lat: 51.2093, lng: 3.2247, size: 1.0, color: '#6366f1' },
  { name: 'Lagos', lat: 6.5244, lng: 3.3792, size: 1.2, color: '#22c55e' },
  { name: 'London', lat: 51.5074, lng: -0.1278, size: 1.5, color: '#ef4444' },
  { name: 'Neo-Seoul', lat: 37.5665, lng: 126.9780, size: 1.5, color: '#d946ef' },
  { name: 'Sao Paulo', lat: -23.5505, lng: -46.6333, size: 1.3, color: '#f97316' },
];

export default function CityPicker({ onSelectCity }) {
  const globeRef = useRef();
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight * 0.7 });
  const [hoveredCity, setHoveredCity] = useState(null);
  const [customCity, setCustomCity] = useState('');

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight * 0.7 });
    };
    window.addEventListener('resize', handleResize);
    
    // Auto-rotate the globe slowly
    if (globeRef.current) {
      globeRef.current.controls().autoRotate = true;
      globeRef.current.controls().autoRotateSpeed = 0.5;
    }
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleCityClick = (city) => {
    // Zoom in on the city before selecting
    globeRef.current.pointOfView({ lat: city.lat, lng: city.lng, altitude: 0.5 }, 1000);
    setTimeout(() => {
      onSelectCity(city.name);
    }, 1200);
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (customCity.trim()) {
      onSelectCity(customCity.trim());
    }
  };

  return (
    <div className="city-picker-view">
      <div className="picker-header">
        <h2>Select Origin Coordinates</h2>
        <p>Choose the geographic anchor for your journey into the future.</p>
      </div>

      <div className="globe-container">
        <Globe
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          backgroundColor="rgba(0,0,0,0)"
          
          labelsData={CITIES}
          labelLat={d => d.lat}
          labelLng={d => d.lng}
          labelText={d => d.name}
          labelSize={d => d.size}
          labelDotRadius={d => d.size * 0.5}
          labelColor={d => d.color}
          labelResolution={2}
          labelAltitude={0.01}
          
          onLabelHover={setHoveredCity}
          onLabelClick={handleCityClick}
          
          ringsData={CITIES}
          ringLat={d => d.lat}
          ringLng={d => d.lng}
          ringColor={d => d.color}
          ringMaxRadius={5}
          ringPropagationSpeed={2}
          ringRepeatPeriod={1000}
        />
        
        {hoveredCity && (
          <div className="city-tooltip" style={{ color: hoveredCity.color }}>
            {hoveredCity.name}
          </div>
        )}
      </div>
      
      <div className="globe-hint">
        Spin the globe and click a glowing coordinate to lock in your location
      </div>
      
      <form onSubmit={handleCustomSubmit} className="custom-city-form">
        <input 
          type="text" 
          placeholder="Or type a custom location (e.g. My Street, Amsterdam)" 
          value={customCity}
          onChange={(e) => setCustomCity(e.target.value)}
          className="custom-city-input"
        />
        <button type="submit" className="custom-city-btn" disabled={!customCity.trim()}>
          Lock Coordinates
        </button>
      </form>
    </div>
  );
}
