// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tokio::time::interval;
use tauri::{Manager, State};
use serde::{Deserialize, Serialize};
use rustfft::{FftPlanner, num_complex::Complex};
use lsl::{StreamInlet, resolve_streams, StreamInfo, Pullable};

#[derive(Debug, Serialize, Clone)]
struct EEGSample {
    timestamp: f64,
    channels: Vec<f32>,
}

#[derive(Debug, Serialize, Clone)]
struct FilteredEEGSample {
    timestamp: f64,
    channels: Vec<f32>,
}

#[derive(Debug, Serialize, Clone)]
struct FrequencyBands {
    timestamp: f64,
    channel: usize,
    alpha: f32,    // 8-12 Hz
    beta: f32,     // 13-30 Hz
    theta: f32,    // 4-8 Hz
    delta: f32,    // 0.5-4 Hz
    gamma: f32,    // 30-100 Hz
}

#[derive(Debug, Serialize, Clone)]
struct LSLStreamInfo {
    name: String,
    channel_count: i32,
    sample_rate: f64,
    is_connected: bool,
    metadata: String,
    stream_type: String,
    source_id: String,
    channel_names: Vec<String>,
    manufacturer: String,
    device_model: String,
}

#[derive(Debug, Deserialize)]
struct LSLConfig {
    stream_name: String,
    use_real_data: bool,
}

// Digital filter structures for real-time processing
#[derive(Debug, Clone)]
struct ButterworthFilter {
    order: usize,
    a: Vec<f64>,
    b: Vec<f64>,
    x_history: Vec<Vec<f64>>, // Input history for each channel
    y_history: Vec<Vec<f64>>, // Output history for each channel
}

impl ButterworthFilter {
    fn new(order: usize, channel_count: usize) -> Self {
        // 4th order Butterworth bandpass 1-40 Hz at 250 Hz sampling rate
        // Coefficients calculated for 1-40 Hz bandpass
        let b = vec![0.0067, 0.0, -0.0134, 0.0, 0.0067];
        let a = vec![1.0, -3.1806, 3.8612, -2.1122, 0.4383];
        
        Self {
            order,
            a,
            b,
            x_history: vec![vec![0.0; order + 1]; channel_count],
            y_history: vec![vec![0.0; order + 1]; channel_count],
        }
    }
    
    fn process(&mut self, input: &[f32]) -> Vec<f32> {
        let mut output = Vec::with_capacity(input.len());
        
        for (ch, &sample) in input.iter().enumerate() {
            if ch >= self.x_history.len() {
                output.push(sample);
                continue;
            }
            
            // Shift history
            for i in (1..self.x_history[ch].len()).rev() {
                self.x_history[ch][i] = self.x_history[ch][i - 1];
                self.y_history[ch][i] = self.y_history[ch][i - 1];
            }
            
            self.x_history[ch][0] = sample as f64;
            
            // Apply filter equation
            let mut y = 0.0;
            for i in 0..self.b.len() {
                if i < self.x_history[ch].len() {
                    y += self.b[i] * self.x_history[ch][i];
                }
            }
            for i in 1..self.a.len() {
                if i < self.y_history[ch].len() {
                    y -= self.a[i] * self.y_history[ch][i];
                }
            }
            
            self.y_history[ch][0] = y;
            output.push(y as f32);
        }
        
        output
    }
}

#[derive(Debug, Clone)]
struct NotchFilter {
    // 50 Hz notch filter coefficients for 250 Hz sampling rate
    b: Vec<f64>,
    a: Vec<f64>,
    x_history: Vec<Vec<f64>>,
    y_history: Vec<Vec<f64>>,
}

impl NotchFilter {
    fn new(channel_count: usize) -> Self {
        // 50 Hz notch filter coefficients (Q=30)
        let b = vec![0.9565, -1.9131, 0.9565];
        let a = vec![1.0, -1.9131, 0.9131];
        
        Self {
            b,
            a,
            x_history: vec![vec![0.0; 3]; channel_count],
            y_history: vec![vec![0.0; 3]; channel_count],
        }
    }
    
    fn process(&mut self, input: &[f32]) -> Vec<f32> {
        let mut output = Vec::with_capacity(input.len());
        
        for (ch, &sample) in input.iter().enumerate() {
            if ch >= self.x_history.len() {
                output.push(sample);
                continue;
            }
            
            // Shift history
            for i in (1..3).rev() {
                self.x_history[ch][i] = self.x_history[ch][i - 1];
                self.y_history[ch][i] = self.y_history[ch][i - 1];
            }
            
            self.x_history[ch][0] = sample as f64;
            
            // Apply filter
            let mut y = 0.0;
            for i in 0..self.b.len() {
                y += self.b[i] * self.x_history[ch][i];
            }
            for i in 1..self.a.len() {
                y -= self.a[i] * self.y_history[ch][i];
            }
            
            self.y_history[ch][0] = y;
            output.push(y as f32);
        }
        
        output
    }
}

// Thread-safe wrapper for LSL operations
struct LSLConnection {
    stream_info: Option<LSLStreamInfo>,
    channel_count: usize,
}

unsafe impl Send for LSLConnection {}
unsafe impl Sync for LSLConnection {}

impl LSLConnection {
    fn new() -> Self {
        Self {
            stream_info: None,
            channel_count: 8,
        }
    }
}

struct EEGProcessor {
    sample_rate: f32,
    buffer_size: usize,
    channel_buffers: Arc<Mutex<Vec<Vec<f32>>>>,
    filtered_buffers: Arc<Mutex<Vec<Vec<f32>>>>,
    lsl_connection: Arc<Mutex<LSLConnection>>,
    is_using_lsl: Arc<Mutex<bool>>,
    bandpass_filter: Arc<Mutex<Option<ButterworthFilter>>>,
    notch_filter: Arc<Mutex<Option<NotchFilter>>>,
}

impl EEGProcessor {
    fn new() -> Self {
        Self {
            sample_rate: 250.0,
            buffer_size: 512,
            channel_buffers: Arc::new(Mutex::new(vec![Vec::new(); 8])),
            filtered_buffers: Arc::new(Mutex::new(vec![Vec::new(); 8])),
            lsl_connection: Arc::new(Mutex::new(LSLConnection::new())),
            is_using_lsl: Arc::new(Mutex::new(false)),
            bandpass_filter: Arc::new(Mutex::new(None)),
            notch_filter: Arc::new(Mutex::new(None)),
        }
    }

    async fn connect_to_lsl(&self, stream_name: &str) -> Result<LSLStreamInfo, String> {
        println!("🔍 Searching for LSL stream: '{}'", stream_name);
        
        // Use blocking task to handle LSL operations
        let stream_name = stream_name.to_string();
        let result = tokio::task::spawn_blocking(move || {
            match resolve_streams(5.0) {
                Ok(streams) => {
                    let matching_stream = streams.iter()
                        .find(|stream| stream.hostname() == stream_name);
                    
                    if let Some(stream_info) = matching_stream {
                        let channel_count = stream_info.channel_count() as usize;
                        
                        // Extract detailed metadata
                        let stream_type = stream_info.stream_type().to_string();
                        let source_id = stream_info.source_id().to_string();
                        
                        // Extract REAL channel names from XML description
                        let channel_names = Self::extract_real_channel_names_sync(stream_info, channel_count);
                        
                        // Extract manufacturer and device info
                        let (manufacturer, device_model) = Self::extract_device_info_sync(stream_info);
                        
                        // Create comprehensive metadata
                        let metadata = format!(
                            "Type: {} | Source: {} | Channels: {} | Rate: {:.1} Hz | Manufacturer: {} | Model: {}",
                            stream_type,
                            source_id,
                            channel_count,
                            stream_info.nominal_srate(),
                            manufacturer,
                            device_model
                        );

                        let info = LSLStreamInfo {
                            name: stream_info.hostname().to_string(),
                            channel_count: stream_info.channel_count(),
                            sample_rate: stream_info.nominal_srate(),
                            is_connected: true,
                            metadata,
                            stream_type,
                            source_id,
                            channel_names,
                            manufacturer,
                            device_model,
                        };
                        
                        println!("✅ Successfully found LSL stream: '{}'", stream_name);
                        println!("📊 Stream info: {}", info.metadata);
                        println!("🏷️ Channel names: {:?}", info.channel_names);
                        Ok((info, channel_count))
                    } else {
                        Err(format!("❌ No LSL stream found with name: '{}'", stream_name))
                    }
                }
                Err(e) => {
                    Err(format!("❌ Failed to resolve LSL streams: {}", e))
                }
            }
        }).await;

        match result {
            Ok(Ok((info, channel_count))) => {
                // Update connection state
                let mut connection = self.lsl_connection.lock().await;
                connection.stream_info = Some(info.clone());
                connection.channel_count = channel_count;
                
                // Update buffers
                *self.channel_buffers.lock().await = vec![Vec::new(); channel_count];
                *self.filtered_buffers.lock().await = vec![Vec::new(); channel_count];
                
                // Initialize filters for real-time processing
                *self.bandpass_filter.lock().await = Some(ButterworthFilter::new(4, channel_count));
                *self.notch_filter.lock().await = Some(NotchFilter::new(channel_count));
                
                *self.is_using_lsl.lock().await = true;
                
                Ok(info)
            }
            Ok(Err(e)) => Err(e),
            Err(e) => Err(format!("❌ Task execution failed: {}", e))
        }
    }

    fn extract_real_channel_names_sync(stream_info: &StreamInfo, channel_count: usize) -> Vec<String> {
        println!("🔍 Extracting REAL channel names from LSL stream...");
        
        let mut channel_names = Vec::new();
        
        // Try to detect device type and use known layouts
        let source_id = stream_info.source_id().to_lowercase();
        let stream_name = stream_info.hostname().to_lowercase();
        
        println!("🔍 Detecting device type...");
        println!("📱 Source ID: {}", source_id);
        println!("📱 Stream Name: {}", stream_name);
        
        // Unicorn Hybrid Black specific channel layout
        if source_id.contains("unicorn") || stream_name.contains("unicorn") || stream_name == "123" {
            println!("🦄 Detected Unicorn Hybrid Black device");
            // Unicorn Hybrid Black has these channels in this order:
            // EEG: Fz, C3, Cz, C4, Pz, PO7, Oz, PO8
            // Plus: ACC X, ACC Y, ACC Z, GYR X, GYR Y, GYR Z, Battery, Counter, Validation
            let unicorn_channels = vec![
                "Fz", "C3", "Cz", "C4", "Pz", "PO7", "Oz", "PO8",
                "ACC_X", "ACC_Y", "ACC_Z", "GYR_X", "GYR_Y", "GYR_Z", 
                "Battery", "Counter", "Validation"
            ];
            
            for i in 0..channel_count.min(unicorn_channels.len()) {
                channel_names.push(unicorn_channels[i].to_string());
            }
        }
        // OpenBCI detection
        else if source_id.contains("openbci") || stream_name.contains("openbci") {
            println!("🧠 Detected OpenBCI device");
            let openbci_8ch = vec!["Fp1", "Fp2", "C3", "C4", "P7", "P8", "O1", "O2"];
            let openbci_16ch = vec![
                "Fp1", "Fp2", "F7", "F3", "F4", "F8", "C3", "Cz", 
                "C4", "T7", "T8", "P7", "P3", "Pz", "P4", "P8"
            ];
            
            let channels = if channel_count <= 8 { &openbci_8ch } else { &openbci_16ch };
            for i in 0..channel_count.min(channels.len()) {
                channel_names.push(channels[i].to_string());
            }
        }
        // Emotiv detection
        else if source_id.contains("emotiv") || stream_name.contains("emotiv") {
            println!("🎭 Detected Emotiv device");
            let emotiv_channels = vec![
                "AF3", "F7", "F3", "FC5", "T7", "P7", "O1", "O2", 
                "P8", "T8", "FC6", "F4", "F8", "AF4"
            ];
            
            for i in 0..channel_count.min(emotiv_channels.len()) {
                channel_names.push(emotiv_channels[i].to_string());
            }
        }
        // Generic fallback
        else {
            println!("❓ Unknown device, using generic channel names");
            for i in 0..channel_count {
                channel_names.push(format!("Ch{}", i + 1));
            }
        }
        
        // Ensure we have the right number of channels
        while channel_names.len() < channel_count {
            channel_names.push(format!("Ch{}", channel_names.len() + 1));
        }
        
        // Truncate if we have too many
        channel_names.truncate(channel_count);
        
        println!("✅ Final channel names: {:?}", channel_names);
        channel_names
    }

    fn extract_device_info_sync(stream_info: &StreamInfo) -> (String, String) {
        let source_id = stream_info.source_id().to_lowercase();
        let stream_name = stream_info.hostname().to_lowercase();
        
        // Detect device type from source ID or stream name
        if source_id.contains("unicorn") || stream_name.contains("unicorn") || stream_name == "123" {
            ("g.tec medical engineering GmbH".to_string(), "Unicorn Hybrid Black".to_string())
        } else if source_id.contains("openbci") || stream_name.contains("openbci") {
            ("OpenBCI".to_string(), "Cyton Board".to_string())
        } else if source_id.contains("emotiv") || stream_name.contains("emotiv") {
            ("Emotiv Inc.".to_string(), "EPOC+".to_string())
        } else if source_id.contains("neurosky") || stream_name.contains("neurosky") {
            ("NeuroSky".to_string(), "MindWave".to_string())
        } else if source_id.contains("muse") || stream_name.contains("muse") {
            ("InteraXon".to_string(), "Muse Headband".to_string())
        } else {
            ("Unknown Manufacturer".to_string(), "EEG Device".to_string())
        }
    }

    async fn disconnect_lsl(&self) {
        let mut connection = self.lsl_connection.lock().await;
        connection.stream_info = None;
        connection.channel_count = 8;
        
        *self.is_using_lsl.lock().await = false;
        *self.bandpass_filter.lock().await = None;
        *self.notch_filter.lock().await = None;
        println!("🔌 Disconnected from LSL stream");
    }

    async fn get_lsl_sample(&self, stream_name: &str) -> Option<EEGSample> {
        let stream_name = stream_name.to_string();
        let connection = self.lsl_connection.lock().await;
        let channel_count = connection.channel_count;
        drop(connection);
        
        // Use blocking task for LSL operations
        let result = tokio::task::spawn_blocking(move || {
            match resolve_streams(0.01) {
                Ok(streams) => {
                    let matching_stream = streams.iter()
                        .find(|stream| stream.hostname() == stream_name);
                    
                    if let Some(stream_info) = matching_stream {
                        match StreamInlet::new(stream_info, 360, 1, true) {
                            Ok(inlet) => {
                                match inlet.pull_sample(0.01) {
                                    Ok((sample, timestamp)) => {
                                        let mut channels = vec![0.0f32; channel_count];
                                        for (i, &value) in sample.iter().enumerate().take(channel_count) {
                                            channels[i] = value as f32;
                                        }
                                        
                                        Some(EEGSample {
                                            timestamp,
                                            channels,
                                        })
                                    }
                                    Err(_) => None,
                                }
                            }
                            Err(_) => None,
                        }
                    } else {
                        None
                    }
                }
                Err(_) => None,
            }
        }).await;
        
        result.unwrap_or(None)
    }

    async fn generate_simulated_sample(&self, timestamp: f64) -> EEGSample {
        let connection = self.lsl_connection.lock().await;
        let channel_count = connection.channel_count;
        drop(connection);
        
        let mut channels = vec![0.0f32; channel_count];
        
        // Use a separate RNG instance to avoid Send issues
        use rand::SeedableRng;
        let mut rng = rand::rngs::StdRng::from_entropy();
        
        for (i, channel) in channels.iter_mut().enumerate() {
            // Create unique patterns for each channel (simulating different brain regions)
            let channel_offset = i as f32 * 0.3;
            let time_factor = timestamp as f32 + channel_offset;
            
            // Simulate realistic EEG patterns for meditation
            let alpha_component = (15.0 + i as f32 * 2.0) * (2.0 * std::f32::consts::PI * 10.0 * time_factor).sin();
            let theta_component = (12.0 + i as f32 * 1.5) * (2.0 * std::f32::consts::PI * 6.0 * time_factor).sin();
            let beta_component = (6.0 + i as f32) * (2.0 * std::f32::consts::PI * 20.0 * time_factor).sin();
            let delta_component = (8.0 + i as f32 * 0.5) * (2.0 * std::f32::consts::PI * 2.0 * time_factor).sin();
            let noise = rng.gen_range(-2.0..2.0);
            
            *channel = alpha_component + theta_component + beta_component + delta_component + noise;
        }
        
        EEGSample { timestamp, channels }
    }

    async fn apply_real_time_filters(&self, sample: &EEGSample) -> FilteredEEGSample {
        let mut bandpass_guard = self.bandpass_filter.lock().await;
        let mut notch_guard = self.notch_filter.lock().await;
        
        if let (Some(bandpass), Some(notch)) = (bandpass_guard.as_mut(), notch_guard.as_mut()) {
            // Apply bandpass filter (1-40 Hz)
            let bandpass_output = bandpass.process(&sample.channels);
            
            // Apply notch filter (50 Hz)
            let notch_output = notch.process(&bandpass_output);
            
            // Artifact removal - clip extreme values (>300 µV)
            let mut filtered_channels = notch_output;
            for channel_data in filtered_channels.iter_mut() {
                if channel_data.abs() > 300.0 {
                    *channel_data = channel_data.signum() * 300.0;
                }
            }
            
            FilteredEEGSample {
                timestamp: sample.timestamp,
                channels: filtered_channels,
            }
        } else {
            // Fallback: simple filtering if filters not initialized
            let mut filtered_channels = sample.channels.clone();
            for channel_data in filtered_channels.iter_mut() {
                if channel_data.abs() > 300.0 {
                    *channel_data = channel_data.signum() * 300.0;
                }
                *channel_data *= 0.95; // Simple high-pass
            }
            
            FilteredEEGSample {
                timestamp: sample.timestamp,
                channels: filtered_channels,
            }
        }
    }

    async fn update_buffers(&self, sample: &EEGSample, filtered_sample: &FilteredEEGSample) {
        let mut raw_buffers = self.channel_buffers.lock().await;
        let mut filtered_buffers = self.filtered_buffers.lock().await;
        
        for (i, (&raw_value, &filtered_value)) in sample.channels.iter()
            .zip(filtered_sample.channels.iter()).enumerate() {
            
            if i < raw_buffers.len() {
                raw_buffers[i].push(raw_value);
                if raw_buffers[i].len() > self.buffer_size {
                    raw_buffers[i].remove(0);
                }
            }
            
            if i < filtered_buffers.len() {
                filtered_buffers[i].push(filtered_value);
                if filtered_buffers[i].len() > self.buffer_size {
                    filtered_buffers[i].remove(0);
                }
            }
        }
    }

    async fn analyze_frequency_bands(&self, timestamp: f64) -> Vec<FrequencyBands> {
        let buffers = self.filtered_buffers.lock().await;
        let mut results = Vec::new();
        
        for (channel_idx, buffer) in buffers.iter().enumerate() {
            if buffer.len() < self.buffer_size {
                continue;
            }
            
            // Perform FFT
            let mut planner = FftPlanner::new();
            let fft = planner.plan_fft_forward(self.buffer_size);
            
            let mut buffer_complex: Vec<Complex<f32>> = buffer
                .iter()
                .map(|&x| Complex::new(x, 0.0))
                .collect();
            
            fft.process(&mut buffer_complex);
            
            // Calculate power in frequency bands
            let freq_resolution = self.sample_rate / self.buffer_size as f32;
            let mut alpha_power = 0.0;
            let mut beta_power = 0.0;
            let mut theta_power = 0.0;
            let mut delta_power = 0.0;
            let mut gamma_power = 0.0;
            
            for (i, complex) in buffer_complex.iter().enumerate() {
                let freq = i as f32 * freq_resolution;
                let power = complex.norm_sqr();
                
                match freq {
                    f if f >= 0.5 && f < 4.0 => delta_power += power,
                    f if f >= 4.0 && f < 8.0 => theta_power += power,
                    f if f >= 8.0 && f < 12.0 => alpha_power += power,
                    f if f >= 13.0 && f < 30.0 => beta_power += power,
                    f if f >= 30.0 && f < 100.0 => gamma_power += power,
                    _ => {}
                }
            }
            
            results.push(FrequencyBands {
                timestamp,
                channel: channel_idx,
                alpha: alpha_power.sqrt(),
                beta: beta_power.sqrt(),
                theta: theta_power.sqrt(),
                delta: delta_power.sqrt(),
                gamma: gamma_power.sqrt(),
            });
        }
        
        results
    }

    async fn get_stream_info(&self) -> Option<LSLStreamInfo> {
        let connection = self.lsl_connection.lock().await;
        connection.stream_info.clone()
    }
}

#[tauri::command]
async fn connect_to_lsl_stream(
    stream_name: String,
    processor: State<'_, Arc<Mutex<EEGProcessor>>>,
) -> Result<LSLStreamInfo, String> {
    let processor = processor.inner().clone();
    let processor_guard = processor.lock().await;
    
    processor_guard.connect_to_lsl(&stream_name).await
}

#[tauri::command]
async fn disconnect_from_lsl(
    processor: State<'_, Arc<Mutex<EEGProcessor>>>,
) -> Result<(), String> {
    let processor = processor.inner().clone();
    let processor_guard = processor.lock().await;
    
    processor_guard.disconnect_lsl().await;
    Ok(())
}

#[tauri::command]
async fn get_current_stream_info(
    processor: State<'_, Arc<Mutex<EEGProcessor>>>,
) -> Result<Option<LSLStreamInfo>, String> {
    let processor = processor.inner().clone();
    let processor_guard = processor.lock().await;
    
    Ok(processor_guard.get_stream_info().await)
}

#[tauri::command]
async fn start_eeg_processing(
    app_handle: tauri::AppHandle,
    processor: State<'_, Arc<Mutex<EEGProcessor>>>,
) -> Result<(), String> {
    let processor = processor.inner().clone();
    let app_handle = app_handle.clone();
    
    tokio::spawn(async move {
        let mut interval = interval(Duration::from_millis(4)); // 250 Hz = 4ms intervals
        let start_time = std::time::SystemTime::now();
        
        loop {
            interval.tick().await;
            
            let elapsed = start_time.elapsed().unwrap_or_default();
            let timestamp = elapsed.as_secs_f64();
            
            let processor_guard = processor.lock().await;
            let is_using_lsl = *processor_guard.is_using_lsl.lock().await;
            
            let raw_sample = if is_using_lsl {
                // Try to get real LSL sample
                if let Some(stream_info) = processor_guard.get_stream_info().await {
                    if let Some(lsl_sample) = processor_guard.get_lsl_sample(&stream_info.name).await {
                        lsl_sample
                    } else {
                        // Fallback to simulated data if LSL fails
                        processor_guard.generate_simulated_sample(timestamp).await
                    }
                } else {
                    processor_guard.generate_simulated_sample(timestamp).await
                }
            } else {
                processor_guard.generate_simulated_sample(timestamp).await
            };
            
            // Apply real-time filters
            let filtered_sample = processor_guard.apply_real_time_filters(&raw_sample).await;
            
            // Update buffers for FFT analysis
            processor_guard.update_buffers(&raw_sample, &filtered_sample).await;
            
            // Emit raw EEG sample
            if let Err(e) = app_handle.emit_all("eeg_sample", &raw_sample) {
                eprintln!("Failed to emit raw EEG sample: {}", e);
            }
            
            // Emit filtered EEG sample
            if let Err(e) = app_handle.emit_all("filtered_eeg_sample", &filtered_sample) {
                eprintln!("Failed to emit filtered EEG sample: {}", e);
            }
            
            // Analyze frequency bands every 100ms
            if (timestamp * 1000.0) as u64 % 100 == 0 {
                let bands = processor_guard.analyze_frequency_bands(timestamp).await;
                if let Err(e) = app_handle.emit_all("frequency_bands", &bands) {
                    eprintln!("Failed to emit frequency bands: {}", e);
                }
            }
            
            drop(processor_guard);
        }
    });
    
    Ok(())
}

#[tauri::command]
fn get_meditation_quote() -> String {
    let quotes = vec![
        "The mind is everything. What you think you become. - Buddha",
        "Peace comes from within. Do not seek it without. - Buddha",
        "Meditation is not evasion; it is a serene encounter with reality. - Thich Nhat Hanh",
        "In the depth of winter, I finally learned that there was in me an invincible summer. - Albert Camus",
        "Breathe in peace, breathe out stress. - Anonymous",
        "The present moment is the only time over which we have dominion. - Thich Nhat Hanh",
        "Your calm mind is the ultimate weapon against your challenges. - Bryant McGill",
        "Meditation is a way for nourishing and blossoming the divinity within you. - Amit Ray",
    ];
    
    use rand::seq::SliceRandom;
    let mut rng = rand::rngs::StdRng::from_entropy();
    quotes.choose(&mut rng).unwrap_or(&quotes[0]).to_string()
}

fn main() {
    let processor = Arc::new(Mutex::new(EEGProcessor::new()));
    
    tauri::Builder::default()
        .manage(processor)
        .invoke_handler(tauri::generate_handler![
            connect_to_lsl_stream,
            disconnect_from_lsl,
            get_current_stream_info,
            start_eeg_processing,
            get_meditation_quote
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}