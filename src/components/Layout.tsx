import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { useProfile } from '@/shared/hooks/useProfile';
import TrialExpiredPaywall from './TrialExpiredPaywall';

interface LayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, showSidebar = true }) => {
  const { profile, loading: profileLoading } = useProfile();
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    // Wait for profile to load
    if (profileLoading || !profile) return;

    // Only show if:
    // 1. User is NOT premium
    // 2. Trial existed and has expired
    // 3. User has NOT already clicked the CTA
    const isPremium = Boolean(profile.premium);
    const trialEndsAt = profile.trial_ends_at;
    const trialExpired = trialEndsAt && new Date(trialEndsAt) <= new Date();
    const ctaAlreadyClicked = Boolean(profile.paywall_cta_clicked);

    if (!isPremium && trialExpired && !ctaAlreadyClicked) {
      setShowPaywall(true);
    }
  }, [profile, profileLoading]);

  return (
    <div className="min-h-screen bg-surface-alt">
      {showSidebar && <Sidebar />}
      
      <main 
        className={showSidebar ? "md:ml-60 transition-[margin] duration-200 ease-linear" : ""}
      >
        <div className="min-h-screen">
          {children}
        </div>
      </main>

      {/* Post-trial paywall popup */}
      {showPaywall && (
        <TrialExpiredPaywall onDismissed={() => setShowPaywall(false)} />
      )}
    </div>
  );
};
