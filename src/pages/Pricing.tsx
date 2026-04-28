import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/shared/contexts/AuthContext';
import { useProfile } from '@/shared/hooks/useProfile';
import { Button } from '@/shared/components/ui/button-premium';
import { ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type PricingPlan = {
    title: string;
    price: string;
    subtitle: string;
    features: string[];
    isPremium: boolean;
    isHighlighted: boolean;
    priceSuffix?: string;
    footnote?: string;
    ctaText?: string;
    stripeLink?: string;
    priceId?: string;
    mode?: 'payment' | 'subscription';
};

const VITE_STRIPE_MONTHLY_PRICE_ID = import.meta.env.VITE_STRIPE_MONTHLY_PRICE_ID as string | undefined;
const VITE_STRIPE_SEASON_PRICE_ID = import.meta.env.VITE_STRIPE_SEASON_PRICE_ID as string | undefined;

const pricingTiers: PricingPlan[] = [
    {
        title: 'Gratuit',
        price: '0€',
        subtitle: 'pour découvrir top ECOS.',
        features: [
            '5 stations jouables / semaine',
            '15 stations disponibles',
            'Évaluation IA partielle'
        ],
        isPremium: false,
        isHighlighted: false,
    },
    {
        title: 'Premium - Mensuel',
        price: '25€',
        priceSuffix: '/ mois',
        subtitle: 'pour t\'entraîner à ton rythme.',
        features: [
            'Stations en illimité',
            '+15 nouvelles stations / semaine',
            'Mode ECOS Blanc',
            'Évaluation IA complète',
            'Rappels de cours personnalisés',
            'Classement hebdomadaire dynamique',
            'Accès prioritaire au support'
        ],
        ctaText: 'Je m\'abonne',
        stripeLink: 'https://buy.stripe.com/6oUdRa6Yh85Zg4qcOw57W03',
        priceId: VITE_STRIPE_MONTHLY_PRICE_ID,
        mode: 'subscription',
        isPremium: true,
        isHighlighted: false,
    },
    {
        title: 'Premium - Saison ECOS 2026',
        price: '17€',
        priceSuffix: '/ mois*',
        subtitle: 'pour une préparation complète jusqu\'aux ECOS 2026',
        footnote: '*paiement unique, premium activé jusqu\'au 4 juin 2026',
        features: [
            'Stations en illimité',
            '+15 nouvelles stations / semaine',
            'Mode ECOS Blanc',
            'Évaluation IA complète',
            'Rappels de cours personnalisés',
            'Classement hebdomadaire dynamique',
            'Accès prioritaire au support',
            'Accès anticipé aux nouvelles fonctionnalités'
        ],
        ctaText: 'Je m\'entraîne non-stop !',
        stripeLink: 'https://buy.stripe.com/14A5kE6Yhcmff0m29S57W04',
        priceId: VITE_STRIPE_SEASON_PRICE_ID,
        mode: 'payment',
        isPremium: true,
        isHighlighted: true,
    },
];

const CheckIcon = ({ className = 'text-[var(--accent)]' }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-5 h-5 ${className} shrink-0`}>
        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
    </svg>
);


const Pricing = () => {
    const { user } = useAuth();
    const { profile, refreshProfile } = useProfile();
    const [isActivatingTrial, setIsActivatingTrial] = useState(false);

    // Trial status computation
    const trialEndsAt = profile?.trial_ends_at;
    const isPremiumUser = Boolean(profile?.premium);
    const isTrialActive = trialEndsAt && new Date(trialEndsAt) > new Date();
    const isTrialExpired = trialEndsAt && new Date(trialEndsAt) <= new Date();
    const canActivateTrial = !isPremiumUser && !trialEndsAt;

    // Format trial end date for display
    const formatTrialEndDate = (dateString: string): string => {
        return new Date(dateString).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit'
        });
    };

    // Trial activation handler
    const handleActivateTrial = async () => {
        setIsActivatingTrial(true);
        try {
            const { error } = await supabase.functions.invoke('activate-trial');
            if (error) throw error;
            toast.success('Essai Premium activé pour 7 jours !');
            await refreshProfile();
        } catch (error) {
            console.error('Error activating trial:', error);
            toast.error("Impossible d'activer l'essai gratuit");
        } finally {
            setIsActivatingTrial(false);
        }
    };

    const initiateCheckout = async (priceId?: string, mode?: 'payment' | 'subscription') => {
        console.log('--- initiateCheckout called ---');

        if (!priceId || !mode) {
            console.error('Configuration Error: priceId or mode is missing.');
            alert('Une erreur de configuration est survenue.');
            return;
        }

        try {
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) {
                console.error('Error getting session:', sessionError);
                alert(`Erreur d\'authentification: ${sessionError.message}`);
                return;
            }
            if (!sessionData.session) {
                console.error('DEBUG: supabase.auth.getSession() returned NULL session.');
                console.log('Full session data:', sessionData);
                alert('Votre session a expiré ou est invalide. Veuillez vous reconnecter et réessayer.');
                return;
            }

            // 2. 👇 ADD THIS: Capture the Rewardful ID
            let clientReferenceId = undefined;
            if (window.Rewardful && window.Rewardful.referral) {
                console.log('✅ Rewardful referral detected:', window.Rewardful.referral);
                clientReferenceId = window.Rewardful.referral;
            } else {
                console.log('ℹ️ No Rewardful referral detected (direct traffic).');
            }

            console.log('DEBUG: Session found! User:', sessionData.session.user?.email);
            console.log('DEBUG: Proceeding to invoke Edge Function.');

            const { data, error } = await supabase.functions.invoke('create-checkout-session', {
                // 3. 👇 PASS IT HERE inside the body
                body: { 
                    priceId, 
                    mode, 
                    client_reference_id: clientReferenceId 
                },
            });

            if (error) throw new Error(error.message);
            const url = (data as any)?.url as string | undefined;
            if (!url) throw new Error('Could not retrieve the checkout URL.');
            window.location.href = url;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Une erreur est survenue.';
            console.error('Error in checkout process:', error);
            alert(`Une erreur est survenue: ${message}`);
        }
    };

    return (
        <Layout>
            <section id="pricing" className="bg-gray-50/50">
                <div className="pt-8 pb-20 px-4 max-w-6xl mx-auto">
                    <div className="flex flex-col text-center w-full mb-8">
                        <h1 className="font-bold text-2xl lg:text-3xl tracking-tight text-text max-w-2xl mx-auto">
                            300+ stations pour être prêt le jour J
                        </h1>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_400px] gap-6 lg:gap-8 items-start lg:items-start">
                        {pricingTiers.map((plan) => (
                            <div 
                                key={plan.title} 
                                className={`relative flex flex-col bg-white p-8 rounded-2xl border transition-all duration-300 ${plan.isHighlighted 
                                    ? 'border-2 border-[var(--accent)] shadow-lg transform will-change-transform hover:scale-[1.02] hover:shadow-xl z-10 hover:z-20' 
                                    : (plan.title === 'Gratuit' ? 'border-[#E0E0E0]' : 'border-gray-200')}`}
                            >
                                <div className="min-h-[140px] md:min-h-[154px] flex flex-col justify-start">
                                    <h3 className={`text-2xl font-semibold ${plan.title === 'Gratuit' ? 'text-[#707070]' : (plan.isHighlighted ? 'text-[var(--accent)]' : 'text-text')}`}>{plan.title}</h3>
                                    <div className="flex items-baseline gap-1 my-4">
                                        <p className={`text-5xl font-bold ${plan.title === 'Gratuit' ? 'text-[#707070]' : (plan.isHighlighted ? 'text-[var(--accent)]' : 'text-text')}`}>{plan.price}</p>
                                        {plan.priceSuffix && (
                                            <p className={`${plan.title === 'Gratuit' ? 'text-[#707070]' : (plan.isHighlighted ? 'text-[var(--accent)]' : 'text-gray-500')}`}>{plan.priceSuffix}</p>
                                        )}
                                    </div>
                                    <p className={`${plan.title === 'Gratuit' ? 'text-[#707070]' : 'text-gray-600'} h-5`}>{plan.subtitle}</p>
                                    {plan.footnote && <p className={`text-xs mt-8 ${plan.title === 'Gratuit' ? 'text-[#707070]' : 'text-gray-500'}`}>{plan.footnote}</p>}
                                </div>
                                
                                <div className="mt-3 mb-4" aria-hidden />
                                
                                <ul className="space-y-3 leading-relaxed text-base flex-1">
                                    {plan.features.map((feature, i) => (
                                        <li key={i} className="flex items-start gap-3">
                                            <CheckIcon className={plan.title === 'Gratuit' ? 'text-[#707070]' : 'text-[var(--accent)]'} />
                                            <span className={`${plan.title === 'Gratuit' ? 'text-[#707070]' : 'text-text'}`}>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                                
                                {plan.ctaText && (
                                    <div className="mt-8 flex justify-center w-full">
                                        <Button
                                            variant={plan.title === 'Premium - Mensuel' ? 'secondary' : 'primary'}
                                            size={plan.title === 'Premium - Mensuel' ? 'sm' : 'lg'}
                                            className={`w-full sm:w-auto sm:px-6 lg:min-w-[240px] xl:min-w-[260px] max-w-full whitespace-normal text-center
                                                ${plan.title === 'Premium - Mensuel'
                                                    ? 'bg-white text-text border border-[var(--border)] hover:bg-[var(--accent)] hover:text-white hover:border-[var(--accent)]'
                                                    : 'text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] border border-[var(--accent)]'
                                                }`}
                                            onClick={() => initiateCheckout(plan.priceId, plan.mode)}
                                        >
                                            <span className="font-bold text-sm sm:text-base leading-tight break-words">{plan.ctaText}</span>
                                            <ChevronRight size={18} className="ml-2" />
                                        </Button>
                                    </div>
                                )}
                                
                                {plan.title === 'Premium - Mensuel' && (
                                    <div className="mt-3 w-full flex justify-center">
                                        {isTrialExpired ? (
                                            <button 
                                                disabled 
                                                className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-full text-gray-500 bg-gray-100 cursor-not-allowed"
                                            >
                                                Essai gratuit terminé le {formatTrialEndDate(trialEndsAt!)}
                                            </button>
                                        ) : isTrialActive ? (
                                            <button 
                                                disabled 
                                                className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-full text-gray-500 bg-gray-100 cursor-not-allowed"
                                            >
                                                Essai gratuit en cours
                                            </button>
                                        ) : canActivateTrial ? (
                                            <button 
                                                onClick={handleActivateTrial} 
                                                disabled={isActivatingTrial}
                                                className="inline-flex items-center justify-center px-4 py-2 border border-gray-400 text-sm font-medium rounded-full text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-wait"
                                            >
                                                {isActivatingTrial ? 'Activation...' : 'Essai gratuit de 7 jours'}
                                            </button>
                                        ) : null}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </Layout>
    );
};

export default Pricing;
