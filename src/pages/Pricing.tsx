import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button-premium';
import { ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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
            '5 stations évaluées / semaine',
            '20 stations disponibles',
            'Évaluation IA partielle'
        ],
        isPremium: false,
        isHighlighted: false,
    },
    {
        title: 'Mensuel',
        price: '25€',
        priceSuffix: '/ mois',
        subtitle: 'pour t\'entraîner à ton rythme.',
        features: [
            'Stations en illimité',
            '+5 nouvelles stations classées / semaine',
            'Classement hebdomadaire dynamique',
            'Classement par station',
            'Évaluation IA complète',
            'Accès prioritaire au support'
        ],
        ctaText: 'Je m\'abonne',
        stripeLink: 'https://buy.stripe.com/test_6oUdRa6Yh85Zg4qcOw57W03',
        priceId: VITE_STRIPE_MONTHLY_PRICE_ID,
        mode: 'subscription',
        isPremium: true,
        isHighlighted: false,
    },
    {
        title: 'Saison ECOS 2026',
        price: '17€',
        priceSuffix: '/ mois*',
        subtitle: 'pour une préparation complète jusqu\'aux ECOS 2026',
        footnote: '*paiement unique',
        features: [
            'Stations en illimité',
            '+5 nouvelles stations classées / semaine',
            'Classement hebdomadaire dynamique',
            'Classement par station',
            'Évaluation IA complète',
            'Accès prioritaire au support',
            'Accès anticipé aux nouvelles fonctionnalités'
        ],
        ctaText: 'Je m\'entraîne non-stop !',
        stripeLink: 'https://buy.stripe.com/test_14A5kE6Yhcmff0m29S57W04',
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

            console.log('DEBUG: Session found! User:', sessionData.session.user?.email);
            console.log('DEBUG: Proceeding to invoke Edge Function.');

            const { data, error } = await supabase.functions.invoke('create-checkout-session', {
                body: { priceId, mode },
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
                <div className="py-24 px-4 max-w-6xl mx-auto">
                    <div className="flex flex-col text-center w-full mb-16">
                        <h1 className="font-bold text-3xl lg:text-4xl tracking-tight text-text max-w-2xl mx-auto">
                            Ne perds plus de temps à te demander comment préparer tes ECOS.
                        </h1>
                    </div>

                    {/* Align pricing cards to the top across breakpoints */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_400px] gap-6 lg:gap-8 items-start lg:items-start">
                        {pricingTiers.map((plan) => (
                            <div 
                                key={plan.title} 
                                // PHOENIX: Removed h-full to let content define the height. Added a transition for a smoother hover effect.
                                className={`relative flex flex-col bg-white p-8 rounded-2xl border transition-all duration-300 ${plan.isHighlighted 
                                    ? 'border-2 border-[var(--accent)] shadow-lg transform will-change-transform hover:scale-[1.02] hover:shadow-xl z-10 hover:z-20' 
                                    : (plan.title === 'Gratuit' ? 'border-[#E0E0E0]' : 'border-gray-200')}`}
                            >
                                {/* Removed "Le plus populaire" badge rendering */}
                                
                                {/* Premium image removed from UI */}
                                
                                {/* Align title/price/subtitle/footnote across cards */}
                                <div className="min-h-[140px] md:min-h-[154px] flex flex-col justify-start">
                                    <h3 className={`text-2xl font-semibold ${plan.title === 'Gratuit' ? 'text-[#707070]' : (plan.isHighlighted ? 'text-[var(--accent)]' : 'text-text')}`}>{plan.title}</h3>
                                    <div className="flex items-baseline gap-1 my-4">
                                        <p className={`text-5xl font-extrabold ${plan.title === 'Gratuit' ? 'text-[#707070]' : (plan.isHighlighted ? 'text-[var(--accent)]' : 'text-text')}`}>{plan.price}</p>
                                        {plan.priceSuffix && (
                                            <p className={`${plan.title === 'Gratuit' ? 'text-[#707070]' : (plan.isHighlighted ? 'text-[var(--accent)]' : 'text-gray-500')}`}>{plan.priceSuffix}</p>
                                        )}
                                    </div>
                                    <p className={`${plan.title === 'Gratuit' ? 'text-[#707070]' : 'text-gray-600'} h-5`}>{plan.subtitle}</p>
                                    {plan.footnote && <p className={`text-xs mt-8 ${plan.title === 'Gratuit' ? 'text-[#707070]' : 'text-gray-500'}`}>{plan.footnote}</p>}
                                </div>
                                
                                {/* Spacer preserved without visible divider */}
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
                                            variant={plan.title === 'Mensuel' ? 'secondary' : 'primary'}
                                            size={plan.title === 'Mensuel' ? 'sm' : 'lg'}
                                            className={`w-full sm:w-auto sm:px-6 lg:min-w-[240px] xl:min-w-[260px] max-w-full whitespace-normal text-center
                                                ${plan.title === 'Mensuel'
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
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </Layout>
    );
};

export default Pricing;
