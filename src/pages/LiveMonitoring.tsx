// src/pages/LiveMonitoring.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getFireAlerts, getFireAlertByDeviceId } from '@/api/fireAlerts';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut, Thermometer, Droplets, Wind, AlertTriangle, Clock, MapPin, Monitor, Flame } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useParams, useNavigate } from 'react-router-dom';
import { SensorData } from '@/types/sensor';

interface SensorReading {
  id: string;
  deviceId: string;
  latitude: number;
  longitude: number;
  humidity: number;
  temp: number;
  smoke: number;
  isFire: boolean;
  timestamp: string;
  name: string;
  status: string;
}

interface FireAlertSession {
  id: string;
  deviceId: string;
  startTime: string;
  endTime: string | null;
  readings: SensorReading[];
  maxTemp: number;
  minTemp: number;
  avgTemp: number;
  maxSmoke: number;
  minSmoke: number;
  avgSmoke: number;
  maxHumidity: number;
  minHumidity: number;
  avgHumidity: number;
  status: 'active' | 'completed';
}

// Convert API data to SensorData format
const convertApiToSensorData = (apiDevices: any[]): SensorData[] => {
  if (!apiDevices || !Array.isArray(apiDevices)) return [];

  return apiDevices.map(device => {
    const deviceId = device.deviceId || device.id || (device._id ? `DEV-${device._id.slice(-4)}` : 'DEV-unknown');
    const id = device._id || device.id || deviceId;

    return {
      id: id,
      deviceId: deviceId,
      latitude: device.latitude || 0,
      longitude: device.longitude || 0,
      humidity: device.humidity || 0,
      temp: device.temp || device.temperature || 0,
      smoke: device.smoke || 0,
      isFire: device.isfire || device.isFire || false,
      timestamp: device.lastUpdate || device.timestamp || new Date().toISOString(),
      name: device.name || `Sensor ${deviceId}`,
      status: device.isfire || device.isFire ? 'warning' : 'active',
    };
  });
};

const LiveMonitoring: React.FC = () => {
  const [selectedSensorId, setSelectedSensorId] = useState<string>('');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [sensorReadings, setSensorReadings] = useState<SensorReading[]>([]);
  const [isMonitoringFire, setIsMonitoringFire] = useState<boolean>(false);
  const [activeSessions, setActiveSessions] = useState<FireAlertSession[]>([]);
  const [completedSessions, setCompletedSessions] = useState<FireAlertSession[]>([]);
  const [currentSession, setCurrentSession] = useState<FireAlertSession | null>(null);
  const [lastProcessedTimestamp, setLastProcessedTimestamp] = useState<string>('');
  const { sensorId } = useParams();
  const navigate = useNavigate();

  // Fetch all available sensors from API
  const { data: allSensorsData, isLoading: isLoadingSensors } = useQuery({
    queryKey: ['allFireAlerts'],
    queryFn: getFireAlerts,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Convert API data to sensor format
  const availableSensors = convertApiToSensorData(allSensorsData || []);

  // Get sensor ID from URL parameters if available
  useEffect(() => {
    if (sensorId) {
      setSelectedSensorId(sensorId);
      setIsMonitoringFire(true); // Auto-enable monitoring for fire alerts
      setSensorReadings([]); // Clear previous readings
      setLastProcessedTimestamp(''); // Reset timestamp tracking
    }
  }, [sensorId]);

  // Fetch data for the selected sensor
  const { data: apiResponse, isLoading, error, refetch } = useQuery({
    queryKey: ['fireAlerts', selectedSensorId],
    queryFn: () => selectedSensorId ? getFireAlertByDeviceId(selectedSensorId) : null,
    refetchInterval: 10000, // Refetch every 10 seconds for live monitoring
    enabled: !!selectedSensorId, // Only run query when a sensor is selected
  });

  // Load saved sessions on component mount
  useEffect(() => {
    const savedSessions = JSON.parse(localStorage.getItem('fireAlertSessions') || '[]');
    setCompletedSessions(savedSessions);
  }, []);

  // Check if reading is a duplicate
  const isDuplicateReading = useCallback((newReading: SensorReading, existingReadings: SensorReading[]) => {
    return existingReadings.some(reading => 
      reading.timestamp === newReading.timestamp &&
      reading.temp === newReading.temp &&
      reading.humidity === newReading.humidity &&
      reading.smoke === newReading.smoke
    );
  }, []);

  // Convert API data to sensor format and store readings history
  useEffect(() => {
    if (apiResponse && selectedSensorId && apiResponse.timestamp !== lastProcessedTimestamp) {
      setLastUpdate(new Date());
      setLastProcessedTimestamp(apiResponse.timestamp);
      
      const newReading = {
        id: apiResponse.id || Date.now().toString(),
        deviceId: apiResponse.deviceId,
        latitude: apiResponse.latitude,
        longitude: apiResponse.longitude,
        humidity: apiResponse.humidity,
        temp: apiResponse.temp,
        smoke: apiResponse.smoke,
        isFire: apiResponse.isFire,
        timestamp: apiResponse.timestamp || new Date().toISOString(),
        name: `Sensor ${apiResponse.deviceId}`,
        status: apiResponse.isFire ? 'warning' : 'active'
      };

      // Always add to history regardless of fire status or monitoring mode
      setSensorReadings(prev => {
        // Check if we already have this reading
        if (isDuplicateReading(newReading, prev)) {
          return prev;
        }
        
        // Keep only the last 20 readings to prevent excessive growth
        return [newReading, ...prev].slice(0, 20);
      });
    }
  }, [apiResponse, selectedSensorId, isDuplicateReading, lastProcessedTimestamp]);

  // Handle session tracking with debouncing
  useEffect(() => {
    if (sensorReadings.length > 0) {
      const latestReading = sensorReadings[0];
      
      // Create a plain object copy of the reading to avoid reference issues
      const plainReading = {
        id: latestReading.id,
        deviceId: latestReading.deviceId,
        latitude: latestReading.latitude,
        longitude: latestReading.longitude,
        humidity: latestReading.humidity,
        temp: latestReading.temp,
        smoke: latestReading.smoke,
        isFire: latestReading.isFire,
        timestamp: latestReading.timestamp,
        name: latestReading.name,
        status: latestReading.status
      };
      
      // If fire is detected and no active session, start a new session
      if (plainReading.isFire && !currentSession) {
        const newSession: FireAlertSession = {
          id: `session-${Date.now()}`,
          deviceId: plainReading.deviceId,
          startTime: plainReading.timestamp,
          endTime: null,
          readings: [plainReading],
          maxTemp: plainReading.temp,
          minTemp: plainReading.temp,
          avgTemp: plainReading.temp,
          maxSmoke: plainReading.smoke,
          minSmoke: plainReading.smoke,
          avgSmoke: plainReading.smoke,
          maxHumidity: plainReading.humidity,
          minHumidity: plainReading.humidity,
          avgHumidity: plainReading.humidity,
          status: 'active'
        };
        
        setCurrentSession(newSession);
        setActiveSessions(prev => [...prev, newSession]);
      }
      
      // If fire continues and we have an active session, update it (but limit frequency)
      else if (plainReading.isFire && currentSession) {
        // Only update if it's been at least 5 seconds since the last reading
        // or if the values have changed significantly
        const lastSessionReading = currentSession.readings[0];
        const timeDiff = new Date(plainReading.timestamp).getTime() - new Date(lastSessionReading.timestamp).getTime();
        const significantChange = 
          Math.abs(plainReading.temp - lastSessionReading.temp) > 1 ||
          Math.abs(plainReading.smoke - lastSessionReading.smoke) > 5 ||
          Math.abs(plainReading.humidity - lastSessionReading.humidity) > 2;
        
        if (timeDiff > 5000 || significantChange) {
          const updatedSession = {
            ...currentSession,
            readings: [plainReading, ...currentSession.readings.slice(0, 49)], // Keep only last 50 readings
            maxTemp: Math.max(currentSession.maxTemp, plainReading.temp),
            minTemp: Math.min(currentSession.minTemp, plainReading.temp),
            maxSmoke: Math.max(currentSession.maxSmoke, plainReading.smoke),
            minSmoke: Math.min(currentSession.minSmoke, plainReading.smoke),
            maxHumidity: Math.max(currentSession.maxHumidity, plainReading.humidity),
            minHumidity: Math.min(currentSession.minHumidity, plainReading.humidity),
          };
          
          // Recalculate averages
          const totalReadings = updatedSession.readings.length;
          updatedSession.avgTemp = updatedSession.readings.reduce((sum, r) => sum + r.temp, 0) / totalReadings;
          updatedSession.avgSmoke = updatedSession.readings.reduce((sum, r) => sum + r.smoke, 0) / totalReadings;
          updatedSession.avgHumidity = updatedSession.readings.reduce((sum, r) => sum + r.humidity, 0) / totalReadings;
          
          setCurrentSession(updatedSession);
          setActiveSessions(prev => 
            prev.map(session => 
              session.id === updatedSession.id ? updatedSession : session
            )
          );
        }
      }
      
      // If fire ended and we had an active session, complete it
      else if (!plainReading.isFire && currentSession) {
        const completedSession = {
          ...currentSession,
          endTime: plainReading.timestamp,
          status: 'completed' as const
        };
        
        setCurrentSession(null);
        setActiveSessions(prev => prev.filter(session => session.id !== completedSession.id));
        
        setCompletedSessions(prev => [completedSession, ...prev.slice(0, 9)]); // Keep only last 10 sessions
        
        // Save to localStorage for persistence
        const savedSessions = JSON.parse(localStorage.getItem('fireAlertSessions') || '[]');
        localStorage.setItem('fireAlertSessions', JSON.stringify([completedSession, ...savedSessions.slice(0, 9)]));
      }
    }
  }, [sensorReadings, currentSession]);

  // Force refetch when sensor is selected from URL
  useEffect(() => {
    if (selectedSensorId) {
      refetch();
    }
  }, [selectedSensorId, refetch]);

  const getStatusColor = (sensor: SensorReading) => {
    if (sensor.isFire) return 'text-red-600';
    if (sensor.temp > 35 || sensor.smoke > 50) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getStatusText = (sensor: SensorReading) => {
    if (sensor.isFire) return 'FIRE DETECTED';
    if (sensor.temp > 35 || sensor.smoke > 50) return 'WARNING';
    return 'NORMAL';
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDuration = (startTime: string, endTime: string | null) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const minutes = Math.floor(diffMs / 60000);
    const seconds = ((diffMs % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  };

  const handleManualSensorSelect = (deviceId: string) => {
    setSelectedSensorId(deviceId);
    setIsMonitoringFire(false); // Disable fire monitoring when manually selecting
    setSensorReadings([]); // Clear previous readings
    setLastProcessedTimestamp(''); // Reset timestamp tracking
    // Update URL to reflect the selected sensor
    navigate(`/monitoring/${deviceId}`);
  };

  const handleMainSite = () => {
    navigate('/');
  };

  const handleDashboard = () => {
    navigate('/dashboard');
  };

  const handleReports = () => {
    navigate('/reports');
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="h-16 glass border-b border-forest-accent/30 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="text-forest-primary" />
          <div>
            <h1 className="text-xl font-bold text-forest-primary">Live Monitoring</h1>
            <p className="text-sm text-muted-foreground">Real-time sensor data tracking</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm" 
            className="border-forest-primary text-forest-primary hover:bg-forest-primary hover:text-white"
            onClick={handleMainSite}
          >
            Main Site
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="border-forest-accent text-forest-primary hover:bg-forest-accent"
            onClick={handleDashboard}
          >
            Dashboard
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="border-forest-accent text-forest-primary hover:bg-forest-accent"
            onClick={handleReports}
          >
            Reports
          </Button>
          <Button size="sm" className="bg-forest-primary text-white hover:bg-forest-primary/90">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        <div className="space-y-6">
          {/* Sensor Selection */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-forest-primary flex items-center gap-2">
                <Monitor className="w-5 h-5" />
                Select Sensor for Monitoring
                {isMonitoringFire && (
                  <span className="flex items-center gap-1 text-sm text-red-600 bg-red-100 px-2 py-1 rounded-full">
                    <Flame className="w-4 h-4" />
                    Fire Alert Mode
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Select value={selectedSensorId} onValueChange={handleManualSensorSelect}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Choose a sensor to monitor" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingSensors ? (
                      <SelectItem value="loading" disabled>Loading sensors...</SelectItem>
                    ) : availableSensors.length > 0 ? (
                      availableSensors.map(sensor => (
                        <SelectItem key={sensor.deviceId} value={sensor.deviceId}>
                          {sensor.name || `Sensor ${sensor.deviceId}`}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-sensors" disabled>No sensors available</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                
                {isLoading && <p className="text-sm text-muted-foreground">Loading sensor data...</p>}
                {error && <p className="text-sm text-red-600">Error loading sensor data</p>}
              </div>
            </CardContent>
          </Card>

          {/* Current Reading Display */}
          {sensorReadings.length > 0 && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className={`w-5 h-5 ${getStatusColor(sensorReadings[0])}`} />
                  Current Reading: {sensorReadings[0].name}
                  {sensorReadings[0].isFire && (
                    <span className="flex items-center gap-1 text-sm text-red-600 bg-red-100 px-2 py-1 rounded-full">
                      <Flame className="w-4 h-4" />
                      FIRE DETECTED
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Device ID</p>
                    <p className="text-lg font-semibold">{sensorReadings[0].deviceId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className={`text-lg font-semibold ${getStatusColor(sensorReadings[0])}`}>
                      {getStatusText(sensorReadings[0])}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="text-lg font-semibold">
                      {sensorReadings[0].latitude.toFixed(4)}, {sensorReadings[0].longitude.toFixed(4)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Update</p>
                    <p className="text-lg font-semibold">
                      {formatTimestamp(sensorReadings[0].timestamp)}
                    </p>
                  </div>
                </div>

                {/* Real-time Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <Card className="bg-forest-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Thermometer className="w-4 h-4 text-red-500" />
                        Temperature
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold text-red-600">{sensorReadings[0].temp}°C</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {sensorReadings[0].temp > 35 ? 'Above normal' : 'Normal range'}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-forest-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Droplets className="w-4 h-4 text-blue-500" />
                        Humidity
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold text-blue-600">{sensorReadings[0].humidity}%</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {sensorReadings[0].humidity < 30 ? 'Low humidity' : 'Normal range'}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-forest-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Wind className="w-4 h-4 text-gray-500" />
                        Smoke Level
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold text-gray-600">{sensorReadings[0].smoke} ppm</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {sensorReadings[0].smoke > 50 ? 'Elevated levels' : 'Normal levels'}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reading History */}
          {sensorReadings.length > 1 && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Reading History ({sensorReadings.length} records)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {sensorReadings.slice(1).map((reading, index) => (
                    <div key={`${reading.timestamp}-${index}`} className="p-3 border rounded-lg bg-white">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-medium">{formatTimestamp(reading.timestamp)}</span>
                        <span className={`text-sm font-semibold ${getStatusColor(reading)}`}>
                          {getStatusText(reading)}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Temp:</span> {reading.temp}°C
                        </div>
                        <div>
                          <span className="text-muted-foreground">Humidity:</span> {reading.humidity}%
                        </div>
                        <div>
                          <span className="text-muted-foreground">Smoke:</span> {reading.smoke} ppm
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active Sessions */}
          {activeSessions.length > 0 && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-red-600" />
                  Active Fire Alert Sessions ({activeSessions.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activeSessions.map(session => (
                    <div key={session.id} className="p-3 border rounded-lg bg-red-50">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold">Device: {session.deviceId}</h3>
                        <span className="text-sm text-red-600 font-semibold">ACTIVE</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Started:</span> {formatTimestamp(session.startTime)}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Duration:</span> {formatDuration(session.startTime, session.endTime)}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Max Temp:</span> {session.maxTemp.toFixed(1)}°C
                        </div>
                        <div>
                          <span className="text-muted-foreground">Max Smoke:</span> {session.maxSmoke} ppm
                        </div>
                      </div>
                      <div className="mt-2 text-sm">
                        <span className="text-muted-foreground">Readings:</span> {session.readings.length} records
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Auto-refresh info */}
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Data refreshes every 10 seconds
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Last updated: {lastUpdate.toLocaleTimeString()}
                </div>
              </div>
            </CardContent>
          </Card>

          {!selectedSensorId && (
            <Card className="glass-card">
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Select a sensor to start monitoring</p>
                  <p>Choose from the dropdown above to view real-time data</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default LiveMonitoring;
