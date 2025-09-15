// src/pages/Reports.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { LogOut, Calendar, Clock, Thermometer, Droplets, Wind, MapPin, AlertTriangle, Trash2 } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

const Reports: React.FC = () => {
  const [sessions, setSessions] = useState<FireAlertSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<FireAlertSession | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const savedSessions = JSON.parse(localStorage.getItem('fireAlertSessions') || '[]');
    setSessions(savedSessions);
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getDuration = (start: string, end: string | null) => {
    if (!end) return 'Ongoing';
    
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const durationMs = endTime - startTime;
    
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const handleMainSite = () => {
    navigate('/');
  };

  const handleDashboard = () => {
    navigate('/dashboard');
  };

  const handleLiveMonitoring = () => {
    navigate('/live-monitoring');
  };

  const getStatusColor = (reading: SensorReading) => {
    if (reading.isFire) return 'text-red-600';
    if (reading.temp > 35 || reading.smoke > 50) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getStatusText = (reading: SensorReading) => {
    if (reading.isFire) return 'FIRE DETECTED';
    if (reading.temp > 35 || reading.smoke > 50) return 'WARNING';
    return 'NORMAL';
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the card click event
    setSessionToDelete(sessionId);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (sessionToDelete) {
      const updatedSessions = sessions.filter(session => session.id !== sessionToDelete);
      setSessions(updatedSessions);
      localStorage.setItem('fireAlertSessions', JSON.stringify(updatedSessions));
      
      // If the deleted session was selected, clear the selection
      if (selectedSession && selectedSession.id === sessionToDelete) {
        setSelectedSession(null);
      }
      
      setSessionToDelete(null);
      setShowDeleteDialog(false);
    }
  };

  const cancelDelete = () => {
    setSessionToDelete(null);
    setShowDeleteDialog(false);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="h-16 glass border-b border-forest-accent/30 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="text-forest-primary" />
          <div>
            <h1 className="text-xl font-bold text-forest-primary">Fire Alert Reports</h1>
            <p className="text-sm text-muted-foreground">Historical fire alert sessions and analytics</p>
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
            onClick={handleLiveMonitoring}
          >
            Live Monitoring
          </Button>
          <Button size="sm" className="bg-forest-primary text-white hover:bg-forest-primary/90">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        {sessions.length === 0 ? (
          <Card className="glass-card p-6 rounded-lg text-center">
            <h2 className="text-2xl font-bold text-forest-primary mb-4">No Fire Alert Sessions Recorded</h2>
            <p className="text-muted-foreground">Fire alert sessions will appear here after they are detected and resolved.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Session List */}
            <div className="lg:col-span-1">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Fire Alert Sessions ({sessions.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {sessions.map(session => (
                      <Card 
                        key={session.id} 
                        className={`cursor-pointer p-4 hover:bg-forest-50 relative ${
                          selectedSession?.id === session.id ? 'bg-forest-50 border-forest-primary' : ''
                        }`}
                        onClick={() => setSelectedSession(session)}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={(e) => handleDeleteSession(session.id, e)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold">Device: {session.deviceId}</h3>
                            <p className="text-sm text-muted-foreground">
                              {new Date(session.startTime).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge 
                            className={session.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}
                          >
                            {session.status === 'completed' ? 'Completed' : 'Active'}
                          </Badge>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center">
                            <Thermometer className="w-3 h-3 mr-1 text-red-500" />
                            <span>Max: {session.maxTemp.toFixed(1)}°C</span>
                          </div>
                          <div className="flex items-center">
                            <Wind className="w-3 h-3 mr-1 text-gray-500" />
                            <span>Max: {session.maxSmoke}ppm</span>
                          </div>
                        </div>
                        <div className="mt-2 text-sm flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          Duration: {getDuration(session.startTime, session.endTime)}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Readings: {session.readings.length} records
                        </div>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Session Details */}
            <div className="lg:col-span-2">
              {selectedSession ? (
                <Card className="glass-card">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>
                      Fire Alert Details - {selectedSession.deviceId}
                    </CardTitle>
                    <Badge className={selectedSession.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                      {selectedSession.status === 'completed' ? 'Completed' : 'Active'}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div>
                        <p className="text-sm text-muted-foreground">Device ID</p>
                        <p className="text-lg font-semibold">{selectedSession.deviceId}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Duration</p>
                        <p className="text-lg font-semibold">
                          {getDuration(selectedSession.startTime, selectedSession.endTime)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Start Time</p>
                        <p className="text-lg font-semibold">{formatDate(selectedSession.startTime)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">End Time</p>
                        <p className="text-lg font-semibold">
                          {selectedSession.endTime ? formatDate(selectedSession.endTime) : 'Ongoing'}
                        </p>
                      </div>
                    </div>

                    <h3 className="text-lg font-semibold mb-4">Sensor Data Summary</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Thermometer className="w-4 h-4 text-red-500" />
                            Temperature
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold">{selectedSession.avgTemp.toFixed(1)}°C</p>
                          <p className="text-sm text-muted-foreground">
                            Min: {selectedSession.minTemp.toFixed(1)}°C | Max: {selectedSession.maxTemp.toFixed(1)}°C
                          </p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Wind className="w-4 h-4 text-gray-500" />
                            Smoke Level
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold">{selectedSession.avgSmoke.toFixed(1)} ppm</p>
                          <p className="text-sm text-muted-foreground">
                            Min: {selectedSession.minSmoke}ppm | Max: {selectedSession.maxSmoke}ppm
                          </p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Droplets className="w-4 h-4 text-blue-500" />
                            Humidity
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold">{selectedSession.avgHumidity.toFixed(1)}%</p>
                          <p className="text-sm text-muted-foreground">
                            Min: {selectedSession.minHumidity}% | Max: {selectedSession.maxHumidity}%
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    <h3 className="text-lg font-semibold mb-4">All Readings ({selectedSession.readings.length} records)</h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {selectedSession.readings.map((reading, index) => (
                        <div key={`${reading.timestamp}-${index}`} className="p-3 border rounded-lg bg-white">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-medium">
                              {new Date(reading.timestamp).toLocaleTimeString()}
                            </span>
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
              ) : (
                <Card className="glass-card p-6 rounded-lg text-center">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <h2 className="text-xl font-bold text-forest-primary mb-2">Select a Session</h2>
                  <p className="text-muted-foreground">Choose a fire alert session from the list to view details</p>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the fire alert session
                and all its associated data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={cancelDelete}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
};

export default Reports;