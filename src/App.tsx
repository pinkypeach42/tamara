import React, { useState, useEffect } from 'react';
import { Brain, Wifi, Search, AlertCircle, CheckCircle } from 'lucide-react';
import StreamVisualization from './components/StreamVisualization';
import './App.css';

// Enhanced Tauri detection with better debugging
const isTauri = (() => {
  try {
    const hasTauri = typeof window !== 'undefined' && 
                     window.__TAURI__ !== undefined;
    console.log('🔍 Tauri Detection:', {
      windowExists: typeof window !== 'undefined',
      hasTauriObject: window.__TAURI__ !== undefined,
      isTauri: hasTauri,
      userAgent: navigator.userAgent
    });
    return hasTauri;
  } catch (error) {
    console.log('❌ Tauri detection error:', error);
    return false;
  }
})();

interface LSLStreamInfo {
  name: string;
  channel_count: number;
  sample_rate: number;
  is_connected: boolean;
  metadata: string;
  stream_type?: string;
  source_id?: string;
  channel_names?: string[];
  manufacturer?: string;
  device_model?: string;
}

// Mock functions for web environment
const mockInvoke = async (command: string, args?: any) => {
  console.log(`🎭 Mock Tauri invoke: ${command}`, args);
  
  // Add delay to simulate real network calls
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  switch (command) {
    case 'connect_to_lsl_stream':
      console.log('❌ Mock connection - No real LSL data available');
      throw new Error('No Data stream available');
      
    case 'start_eeg_processing':
      console.log('🚀 Mock starting EEG processing');
      return { success: true };
      
    case 'get_meditation_quote':
      return "The mind is everything. What you think you become. - Buddha";
      
    default:
      console.log('❓ Unknown mock command:', command);
      return { success: false, message: `Unknown command: ${command}` };
  }
};

// Enhanced invoke function that prioritizes REAL Tauri calls
const invoke = async (command: string, args?: any) => {
  try {
    if (isTauri && window.__TAURI__?.invoke) {
      console.log('🦀 Using REAL Tauri invoke for REAL LSL data:', command, args);
      return await window.__TAURI__.invoke(command, args);
    } else {
      console.log('⚠️ Using mock invoke (no real LSL available):', command, args);
      return await mockInvoke(command, args);
    }
  } catch (error) {
    console.error('💥 Invoke error:', error);
    throw error;
  }
};

function App() {
  const [currentView, setCurrentView] = useState<'config' | 'visualization'>('config');
  const [streamName, setStreamName] = useState('123');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [streamInfo, setStreamInfo] = useState<LSLStreamInfo | null>(null);

  // Enhanced debug logging
  useEffect(() => {
    console.log('🚀 Tamara App initialized');
    console.log('🔧 Environment:', isTauri ? 'Tauri Desktop (REAL LSL CAPABLE)' : 'Web Browser (SIMULATED DATA ONLY)');
    console.log('📱 Current view:', currentView);
    console.log('🌊 Stream name:', streamName);
    console.log('🔌 Connection status:', connectionStatus);
    console.log('📊 Stream info:', streamInfo);
    
    if (!isTauri) {
      console.log('⚠️ WARNING: Running in web browser - only simulated data available');
      console.log('💡 To get REAL LSL data, run: npm run tauri:dev');
    }
  }, [currentView, streamName, connectionStatus, streamInfo]);

  const handleConnectToLSL = async () => {
    console.log('🔗 Starting LSL connection process...');
    
    if (!streamName.trim()) {
      console.log('❌ No stream name provided');
      setErrorMessage('Please enter a stream name');
      return;
    }

    setConnectionStatus('connecting');
    setErrorMessage('');

    try {
      console.log(`🔍 Attempting to connect to LSL stream: '${streamName}'`);
      console.log(`🔧 Environment: ${isTauri ? 'REAL Tauri (can get real LSL data)' : 'Web browser (no real LSL available)'}`);
      
      const result = await invoke('connect_to_lsl_stream', streamName.trim());
      
      console.log('✅ LSL Connection result:', result);
      setStreamInfo(result as LSLStreamInfo);
      setConnectionStatus('connected');
      
      // Start EEG processing
      console.log('🚀 Starting EEG processing...');
      await invoke('start_eeg_processing');
      
      // Navigate to visualization
      console.log('📱 Switching to visualization view...');
      setCurrentView('visualization');
      
    } catch (error) {
      console.error('❌ LSL Connection failed:', error);
      setConnectionStatus('error');
      setErrorMessage(error as string);
    }
  };

  const handleBackToConfig = () => {
    console.log('🔙 Returning to configuration view...');
    setCurrentView('config');
    setConnectionStatus('idle');
    setStreamInfo(null);
    setErrorMessage('');
  };

  // Debug render decision
  console.log('🎨 Render decision:', {
    currentView,
    hasStreamInfo: !!streamInfo,
    shouldShowVisualization: currentView === 'visualization' && streamInfo
  });

  // Render visualization view
  if (currentView === 'visualization' && streamInfo) {
    console.log('🎯 Rendering StreamVisualization component');
    return (
      <StreamVisualization 
        streamInfo={streamInfo} 
        onBack={handleBackToConfig}
      />
    );
  }

  // Render configuration view
  console.log('🎯 Rendering configuration view');
  return (
    <div className="min-h-screen zen-gradient gradient-shift relative overflow-hidden">
      {/* Beautiful floating orbs with subtle movement */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-32 h-32 rounded-full bg-gradient-to-r from-[#F4D1AE]/20 to-[#0B3142]/10 floating-animation"></div>
        <div className="absolute top-40 right-32 w-24 h-24 rounded-full bg-gradient-to-r from-[#0B3142]/10 to-[#F4D1AE]/20 floating-animation" style={{ animationDelay: '3s' }}></div>
        <div className="absolute bottom-32 left-1/3 w-40 h-40 rounded-full bg-gradient-to-r from-[#F4D1AE]/15 to-[#0B3142]/5 floating-animation" style={{ animationDelay: '6s' }}></div>
        <div className="absolute top-1/2 right-1/4 w-28 h-28 rounded-full bg-gradient-to-r from-[#0B3142]/8 to-[#F4D1AE]/12 floating-animation" style={{ animationDelay: '9s' }}></div>
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header Section */}
        <div className="flex-shrink-0 px-6 pt-8">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl mr-4 shadow-lg border border-[#0B3142]/10">
              <Brain className="w-12 h-12 text-[#0B3142]" />
            </div>
            <div className="text-center">
              <h1 className="text-5xl font-bold bg-gradient-to-r from-[#0B3142] to-[#8B4513] bg-clip-text text-transparent mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
                Tamara
              </h1>
              <p className="text-[#0B3142]/70 text-lg font-semibold">Advanced Neural Interface Suite</p>
            </div>
          </div>
          
          {/* Environment Status */}
          <div className="flex justify-center mb-6">
            <div className="bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full flex items-center shadow-md border border-[#0B3142]/10">
              <div className={`w-3 h-3 rounded-full mr-3 ${isTauri ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`}></div>
              <span className="text-[#0B3142] font-bold text-sm tracking-wide">
                {isTauri ? 'DESKTOP APPLICATION - REAL LSL CAPABLE' : 'WEB DEMO MODE - SIMULATED DATA ONLY'}
              </span>
            </div>
          </div>

          {/* LSL Data Warning for Web Mode */}
          {!isTauri && (
            <div className="flex justify-center mb-6">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 max-w-2xl">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div>
                    <p className="text-amber-800 font-semibold text-sm">
                      ⚠️ Web Demo Mode: Only simulated data available
                    </p>
                    <p className="text-amber-700 text-xs mt-1">
                      For REAL LSL data from your EEG device, run: <code className="bg-amber-100 px-1 rounded">npm run tauri:dev</code>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center px-6 py-8">
          <div className="w-full max-w-2xl">
            <div className="premium-card p-8">
              <div className="text-center mb-8">
                <div className="zen-accent-gradient p-4 rounded-2xl w-fit mx-auto mb-4 shadow-lg">
                  <Wifi className="w-8 h-8 text-[#0B3142]" />
                </div>
                <h2 className="text-3xl font-bold text-[#0B3142] mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>
                  Neural Interface Connection
                </h2>
                <p className="text-lg text-[#0B3142]/70 leading-relaxed">
                  {isTauri 
                    ? 'Connect to your EEG device via LSL stream for real-time neural monitoring'
                    : 'Experience simulated neural data visualization (real EEG device required for live data)'
                  }
                </p>
              </div>

              {/* Stream Name Input */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-[#0B3142] mb-3">
                  LSL Stream Name
                </label>
                <input
                  type="text"
                  value={streamName}
                  onChange={(e) => setStreamName(e.target.value)}
                  placeholder="Enter stream name (e.g., '123', 'UnicornHybridBlack')"
                  className="w-full px-5 py-4 text-base rounded-2xl border-2 border-[#0B3142]/20 bg-white text-[#0B3142] placeholder-[#0B3142]/50 focus:border-[#F4D1AE] focus:outline-none transition-all duration-300 font-medium shadow-sm"
                  disabled={connectionStatus === 'connecting'}
                />
                <p className="text-sm text-[#0B3142]/60 mt-2 font-medium">
                  💡 Common names: "123" (Unicorn default), "UnicornHybridBlack", "OpenBCI"
                </p>
              </div>

              {/* Connection Status */}
              {connectionStatus !== 'idle' && (
                <div className="mb-6">
                  <div className={`bg-white/70 backdrop-blur-sm rounded-2xl p-4 border-l-4 shadow-sm ${
                    connectionStatus === 'connecting' ? 'border-amber-400' :
                    connectionStatus === 'connected' ? 'border-emerald-400' :
                    'border-rose-400'
                  }`}>
                    <div className="flex items-center gap-4">
                      {connectionStatus === 'connecting' && (
                        <>
                          <Search className="w-5 h-5 text-amber-500 animate-spin" />
                          <div>
                            <p className="font-bold text-[#0B3142] text-base">
                              {isTauri ? 'Scanning for real LSL streams...' : 'Initializing simulated data...'}
                            </p>
                            <p className="text-sm text-[#0B3142]/70">Searching for: "{streamName}"</p>
                          </div>
                        </>
                      )}
                      
                      {connectionStatus === 'connected' && (
                        <>
                          <CheckCircle className="w-5 h-5 text-emerald-500" />
                          <div>
                            <p className="font-bold text-[#0B3142] text-base">
                              Successfully connected!
                            </p>
                            <p className="text-sm text-[#0B3142]/70">
                              Data stream is active
                            </p>
                          </div>
                        </>
                      )}
                      
                      {connectionStatus === 'error' && (
                        <>
                          <AlertCircle className="w-5 h-5 text-rose-500" />
                          <div>
                            <p className="font-bold text-[#0B3142] text-base">No Data stream available</p>
                            <p className="text-sm text-[#0B3142]/70 mt-1">
                              Please check your EEG device connection and LSL streaming
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Connect Button */}
              <div className="text-center mb-6">
                <button
                  onClick={handleConnectToLSL}
                  disabled={connectionStatus === 'connecting' || !streamName.trim()}
                  className={`zen-button-accent px-10 py-4 text-lg font-bold rounded-2xl flex items-center mx-auto transition-all duration-500 shadow-lg border-2 border-[#0B3142]/10 ${
                    connectionStatus === 'connecting' ? 'opacity-75 cursor-not-allowed' : 'hover:scale-105 hover:shadow-xl'
                  }`}
                >
                  {connectionStatus === 'connecting' ? (
                    <>
                      <Search className="w-5 h-5 mr-3 animate-spin" />
                      {isTauri ? 'Connecting to Real LSL...' : 'Initializing Simulation...'}
                    </>
                  ) : (
                    <>
                      <Wifi className="w-5 h-5 mr-3" />
                      {isTauri ? 'Connect to Real LSL Stream' : 'Start Neural Simulation'}
                    </>
                  )}
                </button>
              </div>

              {/* Help Section */}
              <div className="zen-glass rounded-2xl p-6 shadow-sm border border-[#0B3142]/10">
                <h3 className="font-bold text-[#0B3142] mb-4 text-base">Neural Interface Setup Guide</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-[#0B3142]/70">
                  <div>
                    <h4 className="font-bold text-[#0B3142] mb-2">
                      {isTauri ? 'Real EEG Device Setup:' : 'Simulation Features:'}
                    </h4>
                    <ul className="space-y-1 leading-relaxed">
                      {isTauri ? (
                        <>
                          <li>• EEG device powered and streaming</li>
                          <li>• LSL application broadcasting data</li>
                          <li>• Network connectivity established</li>
                          <li>• Real-time neural monitoring</li>
                        </>
                      ) : (
                        <>
                          <li>• Realistic EEG signal simulation</li>
                          <li>• Multiple frequency bands</li>
                          <li>• Meditation state patterns</li>
                          <li>• Real-time visualization</li>
                        </>
                      )}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-bold text-[#0B3142] mb-2">
                      {isTauri ? 'Troubleshooting:' : 'Getting Real Data:'}
                    </h4>
                    <ul className="space-y-1 leading-relaxed">
                      {isTauri ? (
                        <>
                          <li>• Verify LSL stream is broadcasting</li>
                          <li>• Check device connectivity</li>
                          <li>• Try alternative stream names</li>
                          <li>• Restart EEG software if needed</li>
                        </>
                      ) : (
                        <>
                          <li>• Install Tauri desktop app</li>
                          <li>• Connect real EEG device</li>
                          <li>• Run: npm run tauri:dev</li>
                          <li>• Configure LSL streaming</li>
                        </>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 text-center pb-6">
          <p className="text-[#0B3142]/40 text-sm font-medium">Tamara • Professional Neurofeedback Technology</p>
        </div>
      </div>
    </div>
  );
}

export default App;