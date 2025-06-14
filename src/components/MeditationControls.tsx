import React from 'react';
import { Heart, Zap, Moon, Sun, Sparkles, Target, TrendingUp } from 'lucide-react';

interface MeditationControlsProps {
  isRecording: boolean;
}

const MeditationControls: React.FC<MeditationControlsProps> = ({ isRecording }) => {
  return (
    <div>
      <div className="flex items-center mb-8">
        <div className="zen-accent-gradient p-3 rounded-full mr-4">
          <Heart className="w-6 h-6 text-[#0B3142]" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-[#0B3142] mb-1">Meditation Insights</h2>
          <p className="text-[#0B3142]/60">Your mindfulness journey</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Session Stats */}
        <div className="zen-glass rounded-2xl p-6 text-center zen-shadow">
          <div className="zen-accent-gradient p-3 rounded-full w-fit mx-auto mb-3">
            <Zap className="h-6 w-6 text-[#0B3142]" />
          </div>
          <p className="text-3xl font-bold text-[#0B3142] mb-1">87%</p>
          <p className="text-sm text-[#0B3142]/60">Alpha Dominance</p>
        </div>
        
        <div className="zen-glass rounded-2xl p-6 text-center zen-shadow">
          <div className="zen-accent-gradient p-3 rounded-full w-fit mx-auto mb-3">
            <Moon className="h-6 w-6 text-[#0B3142]" />
          </div>
          <p className="text-3xl font-bold text-[#0B3142] mb-1">73%</p>
          <p className="text-sm text-[#0B3142]/60">Theta Waves</p>
        </div>

        <div className="zen-glass rounded-2xl p-6 text-center zen-shadow">
          <div className="zen-accent-gradient p-3 rounded-full w-fit mx-auto mb-3">
            <Target className="h-6 w-6 text-[#0B3142]" />
          </div>
          <p className="text-3xl font-bold text-[#0B3142] mb-1">92%</p>
          <p className="text-sm text-[#0B3142]/60">Focus Score</p>
        </div>

        <div className="zen-glass rounded-2xl p-6 text-center zen-shadow">
          <div className="zen-accent-gradient p-3 rounded-full w-fit mx-auto mb-3">
            <TrendingUp className="h-6 w-6 text-[#0B3142]" />
          </div>
          <p className="text-3xl font-bold text-[#0B3142] mb-1">+15%</p>
          <p className="text-sm text-[#0B3142]/60">Improvement</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recommendations */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-[#0B3142] flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-[#F4D1AE]" />
            Personalized Guidance
          </h3>
          
          <div className="space-y-3">
            <div className="zen-glass rounded-xl p-4 border-l-4 border-emerald-400">
              <div className="flex items-start gap-3">
                <div className="bg-emerald-100 p-2 rounded-full">
                  <Moon className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-[#0B3142] mb-1">Excellent Theta Activity</p>
                  <p className="text-sm text-[#0B3142]/70">
                    Your deep meditation state is strong. Continue with slow, rhythmic breathing to maintain this peaceful awareness.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="zen-glass rounded-xl p-4 border-l-4 border-blue-400">
              <div className="flex items-start gap-3">
                <div className="bg-blue-100 p-2 rounded-full">
                  <Zap className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-[#0B3142] mb-1">Balanced Alpha Waves</p>
                  <p className="text-sm text-[#0B3142]/70">
                    Perfect for mindful awareness. Your mind is in an ideal state for meditation practice.
                  </p>
                </div>
              </div>
            </div>

            <div className="zen-glass rounded-xl p-4 border-l-4 border-amber-400">
              <div className="flex items-start gap-3">
                <div className="bg-amber-100 p-2 rounded-full">
                  <Sun className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-[#0B3142] mb-1">Gentle Focus</p>
                  <p className="text-sm text-[#0B3142]/70">
                    Try softening your attention. Let thoughts pass like clouds in the sky.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Breathing Guide */}
        <div>
          <h3 className="text-lg font-semibold text-[#0B3142] flex items-center gap-2 mb-4">
            <Heart className="h-5 w-5 text-rose-400" />
            Mindful Breathing
          </h3>
          
          {isRecording ? (
            <div className="zen-glass rounded-2xl p-8 text-center">
              <div className="relative mb-6">
                <div className="w-32 h-32 mx-auto rounded-full zen-accent-gradient flex items-center justify-center breathe-animation">
                  <div className="w-24 h-24 rounded-full bg-[#0B3142]/20 flex items-center justify-center">
                    <Heart className="w-8 h-8 text-[#0B3142]" />
                  </div>
                </div>
              </div>
              <p className="text-[#0B3142] font-medium mb-2">Follow the Rhythm</p>
              <p className="text-sm text-[#0B3142]/60">
                Inhale as the circle expands, exhale as it contracts
              </p>
              <div className="mt-4 text-xs text-[#0B3142]/50">
                4 seconds in • 4 seconds hold • 6 seconds out
              </div>
            </div>
          ) : (
            <div className="zen-glass rounded-2xl p-8 text-center">
              <div className="w-32 h-32 mx-auto rounded-full zen-accent-gradient flex items-center justify-center mb-6 opacity-50">
                <div className="w-24 h-24 rounded-full bg-[#0B3142]/20 flex items-center justify-center">
                  <Heart className="w-8 h-8 text-[#0B3142]" />
                </div>
              </div>
              <p className="text-[#0B3142]/60 font-medium mb-2">Start Your Session</p>
              <p className="text-sm text-[#0B3142]/50">
                Begin meditation to activate breathing guidance
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeditationControls;