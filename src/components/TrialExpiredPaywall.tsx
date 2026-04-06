import React, { useState, useEffect } from 'react';
import { X, ChevronRight, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/shared/contexts/AuthContext';

interface TrialExpiredPaywallProps {
  onDismissed: () => void;
}

const TrialExpiredPaywall: React.FC<TrialExpiredPaywallProps> = ({ onDismissed }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);

  // Animate in on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleCtaClick = async () => {
    // Mark as clicked in DB so it never reappears
    if (user?.id) {
      try {
        await supabase
          .from('profiles')
          .update({ paywall_cta_clicked: true })
          .eq('user_id', user.id);
      } catch (e) {
        console.error('Error updating paywall_cta_clicked:', e);
      }
    }
    onDismissed();
    navigate('/pricing');
  };

  const handleClose = () => {
    // Close for this session only — will reappear on next page load
    // because paywall_cta_clicked stays false in DB
    setIsVisible(false);
    setTimeout(onDismissed, 200);
  };

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-200 ${
        isVisible ? 'bg-black/50 backdrop-blur-sm' : 'bg-black/0'
      }`}
    >
      <div
        className={`relative w-full max-w-[420px] bg-white rounded-2xl shadow-2xl overflow-hidden transition-all duration-200 ${
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors z-10"
          aria-label="Fermer"
        >
          <X className="h-4 w-4 text-gray-500" />
        </button>

        {/* Content */}
        <div className="p-8 pt-10 text-center">
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-[#03BB26]/10 flex items-center justify-center mx-auto mb-5">
            <Zap className="h-7 w-7 text-[#03BB26]" />
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Ton essai Premium est terminé 🥲
          </h2>

          {/* Paragraph 1 — Features */}
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            Profite d'un accès illimité à +250 stations, du mode ECOS blanc, du classement hebdomadaire et l'évaluation IA complète en t'abonnant à top ECOS Premium.
          </p>

          {/* CTA */}
          <button
            onClick={handleCtaClick}
            className="w-full h-12 rounded-xl bg-[#03BB26] text-white font-semibold text-sm
              hover:bg-[#02a522] active:scale-[0.98] transition-all shadow-md shadow-[#03BB26]/20
              flex items-center justify-center gap-2"
          >
            <span>Je m'abonne à top ECOS Premium</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrialExpiredPaywall;
