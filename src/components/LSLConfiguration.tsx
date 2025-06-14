import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Search, Settings, Zap, Database, CheckCircle, AlertCircle } from 'lucide-react';

interface LSLStreamInfo {
  name: string;
  channel_count: number;
  sample_rate: number;
  is_connected: boolean;
}

interface LSLConfigurationProps {
  onConfigChange: (config: { stream_name: string; use_real_data: boolean }) => void;
  isConnected: boolean;
  currentStreamName: string;
}

// Check if we're running in Tauri environment
const isTauri = typeof window !== 'undefined' && window.__TAURI_IPC__;

// Mock functions for web environment
const mockInvoke = async (command: string, args?: any) => {
  console.log(`Mock Tauri invoke: ${command}`, args);
  
  switch (command) {
    case 'get_available_lsl_streams':
      return [
        { name: '123', channel_count: 8, sample_rate: 250.0, is_connected: false },
        { name: 'UnicornHybridBlack', channel_count: 8, sample_rate: 250.0, is_connected: false },
        { name: 'TestStream', channel_count: 16, sample_rate: 500.0, is_connected: false }
      ];
    case 'configure_lsl':
      return { 
        name: args.stream_name, 
        channel_count: 8, 
        sample_rate: 250.0, 
        is_connected: args.use_real_data 
      };
    default:
      return { success: false, message: `Unknown command: ${command}` };
  }
};

const invoke = isTauri ? (window as any).__TAURI__.invoke : mockInvoke;

const LSLConfiguration: React.FC<LSLConfigurationProps> = ({ 
  onConfigChange, 
  isConnected, 
  currentStreamName 
}) => {
  const [availableStreams, setAvailableStreams] = useState<LSLStreamInfo[]>([]);
  const [selectedStream, setSelectedStream] = useState(currentStreamName);
  const [useRealData, setUseRealData] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [customStreamName, setCustomStreamName] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');

  const scanForStreams = async () => {
    setIsScanning(true);
    try {
      const streams = await invoke('get_available_lsl_streams');
      setAvailableStreams(streams as LSLStreamInfo[]);
    } catch (error) {
      console.error('Failed to scan for streams:', error);
      setAvailableStreams([]);
    } finally {
      setIsScanning(false);
    }
  };

  const handleConnect = async () => {
    const streamName = showCustomInput ? customStreamName : selectedStream;
    if (!streamName && useRealData) return;

    setConnectionStatus('connecting');
    
    try {
      const config = {
        stream_name: streamName,
        use_real_data: useRealData
      };
      
      const result = await invoke('configure_lsl', config);
      console.log('LSL Configuration result:', result);
      
      onConfigChange(config);
      setConnectionStatus(useRealData ? 'connected' : 'idle');
    } catch (error) {
      console.error('Failed to configure LSL:', error);
      setConnectionStatus('error');
    }
  };

  useEffect(() => {
    if (useRealData) {
      scanForStreams();
    }
  }, [useRealData]);

  return (
    <div className="premium-card p-8 mb-8">
      <div className="flex items-center mb-6">
        <div className="zen-accent-gradient p-3 rounded-full mr-4">
          <Settings className="w-6 h-6 text-[#0B3142]" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-[#0B3142] mb-1">Data Source Configuration</h2>
          <p className="text-[#0B3142]/60">Choose between simulated or real EEG data</p>
        </div>
      </div>

      {/* Data Source Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div 
          className={`zen-glass rounded-2xl p-6 cursor-pointer transition-all duration-300 border-2 ${
            !useRealData 
              ? 'border-[#F4D1AE] meditation-glow' 
              : 'border-transparent hover:border-[#0B3142]/20'
          }`}
          onClick={() => setUseRealData(false)}
        >
          <div className="flex items-center mb-4">
            <div className={`p-3 rounded-full mr-4 ${!useRealData ? 'zen-accent-gradient' : 'bg-[#0B3142]/10'}`}>
              <Zap className={`w-6 h-6 ${!useRealData ? 'text-[#0B3142]' : 'text-[#0B3142]/50'}`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#0B3142]">Simulated Data</h3>
              <p className="text-sm text-[#0B3142]/60">Perfect for testing and demonstration</p>
            </div>
          </div>
          <div className="space-y-2 text-sm text-[#0B3142]/70">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span>8 channels, 250 Hz sampling</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span>Realistic meditation patterns</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span>No hardware required</span>
            </div>
          </div>
        </div>

        <div 
          className={`zen-glass rounded-2xl p-6 cursor-pointer transition-all duration-300 border-2 ${
            useRealData 
              ? 'border-[#F4D1AE] meditation-glow' 
              : 'border-transparent hover:border-[#0B3142]/20'
          }`}
          onClick={() => setUseRealData(true)}
        >
          <div className="flex items-center mb-4">
            <div className={`p-3 rounded-full mr-4 ${useRealData ? 'zen-accent-gradient' : 'bg-[#0B3142]/10'}`}>
              <Database className={`w-6 h-6 ${useRealData ? 'text-[#0B3142]' : 'text-[#0B3142]/50'}`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#0B3142]">Real EEG Data</h3>
              <p className="text-sm text-[#0B3142]/60">Connect to your EEG device via LSL</p>
            </div>
          </div>
          <div className="space-y-2 text-sm text-[#0B3142]/70">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span>Live brainwave data</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span>Hybrid Unicorn Black support</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span>LSL protocol integration</span>
            </div>
          </div>
        </div>
      </div>

      {/* LSL Stream Configuration */}
      {useRealData && (
        <div className="zen-glass rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[#0B3142]">LSL Stream Selection</h3>
            <button
              onClick={scanForStreams}
              disabled={isScanning}
              className="zen-button px-4 py-2 text-sm flex items-center"
            >
              <Search className={`w-4 h-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
              {isScanning ? 'Scanning...' : 'Scan Streams'}
            </button>
          </div>

          {/* Stream Selection */}
          <div className="space-y-4">
            {availableStreams.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-[#0B3142] mb-2">
                  Available Streams
                </label>
                <div className="grid gap-2">
                  {availableStreams.map((stream, index) => (
                    <div
                      key={index}
                      className={`zen-glass rounded-xl p-4 cursor-pointer transition-all duration-300 border ${
                        selectedStream === stream.name && !showCustomInput
                          ? 'border-[#F4D1AE] bg-[#F4D1AE]/10'
                          : 'border-transparent hover:border-[#0B3142]/20'
                      }`}
                      onClick={() => {
                        setSelectedStream(stream.name);
                        setShowCustomInput(false);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${
                            stream.name === '123' || stream.name.includes('Unicorn') 
                              ? 'bg-emerald-500' 
                              : 'bg-amber-500'
                          }`} />
                          <div>
                            <span className="font-medium text-[#0B3142]">{stream.name}</span>
                            <div className="text-xs text-[#0B3142]/60">
                              {stream.channel_count} channels • {stream.sample_rate} Hz
                            </div>
                          </div>
                        </div>
                        {selectedStream === stream.name && !showCustomInput && (
                          <CheckCircle className="w-5 h-5 text-emerald-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Stream Name */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="custom-stream"
                  checked={showCustomInput}
                  onChange={(e) => setShowCustomInput(e.target.checked)}
                  className="rounded border-[#0B3142]/20"
                />
                <label htmlFor="custom-stream" className="text-sm font-medium text-[#0B3142]">
                  Use custom stream name
                </label>
              </div>
              
              {showCustomInput && (
                <input
                  type="text"
                  value={customStreamName}
                  onChange={(e) => setCustomStreamName(e.target.value)}
                  placeholder="Enter LSL stream name (e.g., '123', 'UnicornHybridBlack')"
                  className="w-full px-4 py-3 rounded-xl border border-[#0B3142]/20 bg-[#F4EDEA] text-[#0B3142] placeholder-[#0B3142]/50 focus:border-[#F4D1AE] focus:outline-none transition-colors"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-4 h-4 rounded-full ${
            connectionStatus === 'connected' ? 'bg-emerald-500' :
            connectionStatus === 'connecting' ? 'bg-amber-500 pulse-gentle' :
            connectionStatus === 'error' ? 'bg-rose-500' :
            'bg-gray-400'
          }`} />
          <span className="text-sm font-medium text-[#0B3142]">
            {connectionStatus === 'connected' ? 'Connected to EEG stream' :
             connectionStatus === 'connecting' ? 'Connecting...' :
             connectionStatus === 'error' ? 'Connection failed' :
             useRealData ? 'Ready to connect' : 'Using simulated data'}
          </span>
        </div>

        <button
          onClick={handleConnect}
          disabled={connectionStatus === 'connecting' || (useRealData && !selectedStream && !customStreamName)}
          className="zen-button-accent px-6 py-3 flex items-center"
        >
          {useRealData ? (
            <>
              <Wifi className="w-4 h-4 mr-2" />
              Connect to LSL
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 mr-2" />
              Use Simulation
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default LSLConfiguration;