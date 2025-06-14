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

// Enhanced mock functions with better error handling
const mockInvoke = async (command: string, args?: any) => {
  console.log(`🎭 Mock Tauri invoke: ${command}`, args);
  
  // Add delay to simulate real network calls
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  switch (command) {
    case 'connect_to_lsl_stream':
      console.log('🔗 Mock connecting to stream:', args);
      
      // Handle both string and object args
      const streamName = typeof args === 'string' ? args : args?.stream_name || args;
      
      if (streamName === '123' || streamName.includes('Unicorn') || streamName.includes('unicorn')) {
        const result = {
          name: streamName,
          channel_count: 17,
          sample_rate: 250.0,
          is_connected: true,
          metadata: "Type: EEG | Source: UnicornHybridBlack_12345 | Channels: 17 | Rate: 250.0 Hz | Manufacturer: g.tec medical engineering GmbH | Model: Unicorn Hybrid Black",
          stream_type: "EEG",
          source_id: "UnicornHybridBlack_12345",
          channel_names: ["Fz", "C3", "Cz", "C4", "Pz", "PO7", "Oz", "PO8", "ACC_X", "ACC_Y", "ACC_Z", "GYR_X", "GYR_Y", "GYR_Z", "Battery", "Counter", "Validation"],
          manufacturer: "g.tec medical engineering GmbH",
          device_model: "Unicorn Hybrid Black"
        };
        console.log('✅ Mock connection successful:', result);
        return result;
      } else if (streamName.includes('OpenBCI') || streamName.includes('openbci')) {
        const result = {
          name: streamName,
          channel_count: 16,
          sample_rate: 250.0,
          is_connected: true,
          metadata: "Type: EEG | Source: OpenBCI_Cyton_67890 | Channels: 16 | Rate: 250.0 Hz | Manufacturer: OpenBCI | Model: Cyton Board",
          stream_type: "EEG",
          source_id: "OpenBCI_Cyton_67890",
          channel_names: ["Fp1", "Fp2", "F7", "F3", "F4", "F8", "C3", "Cz", "C4", "T7", "T8", "P7", "P3", "Pz", "P4", "P8"],
          manufacturer: "OpenBCI",
          device_model: "Cyton Board"
        };
        console.log('✅ Mock connection successful:', result);
        return result;
      } else {
        const error = `No LSL stream found with name: '${streamName}'. Please check that your EEG device is connected and streaming data via LSL.`;
        console.log('❌ Mock connection failed:', error);
        throw new Error(error);
      }
      
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

// Enhanced invoke function with better error handling
const invoke = async (command: string, args?: any) => {
  try {
    if (isTauri && window.__TAURI__?.invoke) {
      console.log('🦀 Using real Tauri invoke:', command, args);
      return await window.__TAURI__.invoke(command, args);
    } else {
      console.log('🎭 Using mock invoke:', command, args);
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
    console.log('🔧 Environment:', isTauri ? 'Tauri Desktop' : 'Web Browser');
    console.log('📱 Current view:', currentView);
    console.log('🌊 Stream name:', streamName);
    console.log('🔌 Connection status:', connectionStatus);
    console.log('📊 Stream info:', streamInfo);
    
    // Test basic functionality
    console.log('🧪 Testing basic state...');
    console.log('- currentView is set:', currentView !== undefined);
    console.log('- streamName is set:', streamName !== undefined && streamName !== '');
    console.log('- Component should render config view');
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
      const result = await invoke('connect_to_lsl_stream', streamName.trim());
      
      console.log('✅ LSL Connection successful:', result);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 relative overflow-hidden">
      {/* Simplified floating elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-32 h-32 rounded-full bg-blue-200 opacity-20 animate-pulse"></div>
        <div className="absolute top-40 right-32 w-24 h-24 rounded-full bg-purple-200 opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute bottom-32 left-1/3 w-40 h-40 rounded-full bg-indigo-200 opacity-20 animate-pulse" style={{ animationDelay: '4s' }}></div>
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header Section */}
        <div className="flex-shrink-0 px-6 pt-8">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-white p-4 rounded-2xl mr-4 shadow-lg border border-gray-200">
              <Brain className="w-12 h-12 text-blue-600" />
            </div>
            <div className="text-center">
              <h1 className="text-5xl font-bold text-gray-800 mb-2">
                Tamara
              </h1>
              <p className="text-gray-600 text-lg font-semibold">Advanced Neural Interface Suite</p>
            </div>
          </div>
          
          {/* Environment Status */}
          <div className="flex justify-center mb-6">
            <div className="bg-white px-4 py-2 rounded-full flex items-center shadow-md border border-gray-200">
              <div className={`w-3 h-3 rounded-full mr-3 ${isTauri ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`}></div>
              <span className="text-gray-800 font-bold text-sm tracking-wide">
                {isTauri ? 'DESKTOP APPLICATION' : 'WEB DEMO MODE'}
              </span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center px-6 py-8">
          <div className="w-full max-w-2xl">
            <div className="bg-white rounded-3xl p-8 shadow-2xl border border-gray-200">
              <div className="text-center mb-8">
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4 rounded-2xl w-fit mx-auto mb-4 shadow-lg">
                  <Wifi className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-gray-800 mb-3">
                  Neural Interface Connection
                </h2>
                <p className="text-lg text-gray-600 leading-relaxed">
                  Connect to your EEG device via LSL stream for real-time neural monitoring
                </p>
              </div>

              {/* Stream Name Input */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-800 mb-3">
                  LSL Stream Name
                </label>
                <input
                  type="text"
                  value={streamName}
                  onChange={(e) => setStreamName(e.target.value)}
                  placeholder="Enter stream name (e.g., '123', 'UnicornHybridBlack')"
                  className="w-full px-5 py-4 text-base rounded-2xl border-2 border-gray-300 bg-white text-gray-800 placeholder-gray-500 focus:border-blue-500 focus:outline-none transition-all duration-300 font-medium shadow-sm"
                  disabled={connectionStatus === 'connecting'}
                />
                <p className="text-sm text-gray-600 mt-2 font-medium">
                  💡 Common names: "123" (Unicorn default), "UnicornHybridBlack", "OpenBCI"
                </p>
              </div>

              {/* Connection Status */}
              {connectionStatus !== 'idle' && (
                <div className="mb-6">
                  <div className={`bg-gray-50 rounded-2xl p-4 border-l-4 shadow-sm ${
                    connectionStatus === 'connecting' ? 'border-yellow-400' :
                    connectionStatus === 'connected' ? 'border-green-400' :
                    'border-red-400'
                  }`}>
                    <div className="flex items-center gap-4">
                      {connectionStatus === 'connecting' && (
                        <>
                          <Search className="w-5 h-5 text-yellow-500 animate-spin" />
                          <div>
                            <p className="font-bold text-gray-800 text-base">Scanning neural networks...</p>
                            <p className="text-sm text-gray-600">Searching for: "{streamName}"</p>
                          </div>
                        </>
                      )}
                      
                      {connectionStatus === 'connected' && (
                        <>
                          <CheckCircle className="w-5 h-5 text-green-500" />
                          <div>
                            <p className="font-bold text-gray-800 text-base">Neural interface established!</p>
                            <p className="text-sm text-gray-600">Initializing real-time monitoring...</p>
                          </div>
                        </>
                      )}
                      
                      {connectionStatus === 'error' && (
                        <>
                          <AlertCircle className="w-5 h-5 text-red-500" />
                          <div>
                            <p className="font-bold text-gray-800 text-base">Connection failed</p>
                            <p className="text-sm text-gray-600">{errorMessage}</p>
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
                  className={`bg-gradient-to-r from-blue-500 to-purple-600 text-white px-10 py-4 text-lg font-bold rounded-2xl flex items-center mx-auto transition-all duration-500 shadow-lg border-2 border-transparent ${
                    connectionStatus === 'connecting' ? 'opacity-75 cursor-not-allowed' : 'hover:scale-105 hover:shadow-xl'
                  }`}
                >
                  {connectionStatus === 'connecting' ? (
                    <>
                      <Search className="w-5 h-5 mr-3 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Wifi className="w-5 h-5 mr-3" />
                      Connect Neural Interface
                    </>
                  )}
                </button>
              </div>

              {/* Help Section */}
              <div className="bg-gray-50 rounded-2xl p-6 shadow-sm border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-4 text-base">Neural Interface Setup Guide</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-600">
                  <div>
                    <h4 className="font-bold text-gray-800 mb-2">Unicorn Hybrid Black:</h4>
                    <ul className="space-y-1 leading-relaxed">
                      <li>• Device powered and streaming</li>
                      <li>• Default stream name: "123"</li>
                      <li>• LSL application active</li>
                      <li>• 8 EEG + 9 sensor channels</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 mb-2">Troubleshooting:</h4>
                    <ul className="space-y-1 leading-relaxed">
                      <li>• Verify LSL stream is broadcasting</li>
                      <li>• Check network connectivity</li>
                      <li>• Try alternative stream names</li>
                      <li>• Restart EEG software if needed</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 text-center pb-6">
          <p className="text-gray-500 text-sm font-medium">Tamara • Professional Neurofeedback Technology</p>
        </div>
      </div>
    </div>
  );
}

export default App;