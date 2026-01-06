import { useState, useEffect } from 'react';
import { useAuth } from '@/shared/contexts/AuthContext';
import { useProfile } from '@/shared/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { useNavigate } from 'react-router-dom';
import { X, Zap, Check } from 'lucide-react';
import { toast } from "@/shared/components/ui/sonner";

const Profil = () => {
  const { user } = useAuth();
  const { profile, loading, refreshProfile } = useProfile();
  const navigate = useNavigate();
  const EMOJI_OPTIONS = ["😈","🙈","👩🏻‍⚕️","👨🏼‍⚕️","👻","🤡","👩🏻‍🦰","🧕","🥷"] as const;
  
  // Cache-first profile to avoid full-page loader flash
  type CachedProfile = {
    pseudo?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    emoji?: string;
    created_at?: string;
    updated_at?: string;
  } | null;
  const [cachedProfile, setCachedProfile] = useState<CachedProfile>(() => {
    const ttlMs = 30 * 24 * 60 * 60 * 1000; // 30 days
    const cache = typeof StorageManager?.getProfileDisplayCache === 'function'
      ? StorageManager.getProfileDisplayCache()
      : null;
    if (cache && typeof StorageManager?.isCacheValid === 'function' && StorageManager.isCacheValid(cache, ttlMs)) {
      return cache.data as CachedProfile;
    }
    return null;
  });
  
  const [formData, setFormData] = useState({
    pseudo: '',
    first_name: '',
    last_name: '',
    phone: '',
    emoji: '' as string | undefined,
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUpdatingEmoji, setIsUpdatingEmoji] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  // Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  
  // --- NEW: State for managing subscription button loading ---
  const [isManagingSubscription, setIsManagingSubscription] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        pseudo: (profile as any).pseudo || '',
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        phone: (profile as any).phone || '',
        emoji: (profile as any).emoji || '',
      });
      // Persist fresh profile to display-only cache (do not override main profile cache used by app logic)
      if (typeof StorageManager?.setProfileDisplayCache === 'function') {
        StorageManager.setProfileDisplayCache({
          pseudo: (profile as any).pseudo || '',
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          phone: (profile as any).phone || '',
          emoji: (profile as any).emoji || '',
          created_at: (profile as any).created_at || undefined,
          updated_at: (profile as any).updated_at || undefined,
        });
      }
    } else if (cachedProfile) {
      setFormData({
        pseudo: cachedProfile.pseudo || '',
        first_name: cachedProfile.first_name || '',
        last_name: cachedProfile.last_name || '',
        phone: cachedProfile.phone || '',
        emoji: cachedProfile.emoji || '',
      });
    }
  }, [profile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) {
      toast.error("Erreur d'authentification. Veuillez vous reconnecter.");
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          pseudo: formData.pseudo.trim(),
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          phone: formData.phone.trim(),
          emoji: formData.emoji ? formData.emoji : null,
        })
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }
      // Write-through to Supabase Auth metadata while preserving existing keys (including phone)
      try {
        const currentMeta = (user?.user_metadata as Record<string, any>) || {};
        const phoneTrimmed = formData.phone.trim();
        const nextMeta: Record<string, any> = {
          ...currentMeta,
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
        };
        if (phoneTrimmed) {
          nextMeta.phone = phoneTrimmed;
        }
        await supabase.auth.updateUser({ data: nextMeta });
      } catch (metaErr) {
        console.warn('Auth metadata update warning:', metaErr);
      }
      
      toast.success('Profil mis à jour.');
      await refreshProfile();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Une erreur est survenue.';
      toast.error(`Erreur lors de la mise à jour du profil: ${message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const formatJoinDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return 'Date invalide';
    }
  };

  const handleSelectEmoji = async (emoji: string | '') => {
    if (!user) {
      toast.error("Erreur d'authentification. Veuillez vous reconnecter.");
      return;
    }
    // If clicking the already selected emoji, allow clearing to fallback
    const nextEmoji = emoji || '';
    setIsUpdatingEmoji(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ emoji: nextEmoji ? nextEmoji : null })
        .eq('user_id', user.id);
      if (error) throw error;

      setFormData(prev => ({ ...prev, emoji: nextEmoji }));

      const cache = StorageManager.getProfileDisplayCache();
      const data = { ...(cache?.data || {}), emoji: nextEmoji };
      StorageManager.setProfileDisplayCache(data);

      await refreshProfile();
      toast.success(nextEmoji ? 'Photo de profil mise à jour.' : 'Photo de profil réinitialisée.');
      setShowEmojiPicker(false);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Impossible de mettre à jour la photo de profil.';
      toast.error(errorMessage);
    } finally {
      setIsUpdatingEmoji(false);
    }
  };
  
  const validateNewPassword = (pwd: string): string | null => {
    if (!pwd) return 'Le nouveau mot de passe est requis';
    if (pwd.length < 6) return 'Le mot de passe doit contenir au moins 6 caractères';
    return null;
  };

  const handleUpdatePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user?.email) {
      toast.error("Impossible d'identifier l'utilisateur. Réessayez plus tard.");
      return;
    }

    if (!currentPassword) {
      toast.error('Le mot de passe actuel est requis');
      return;
    }
    const pwdErr = validateNewPassword(newPassword);
    if (pwdErr) {
      toast.error(pwdErr);
      return;
    }
    if (newPassword === currentPassword) {
      toast.error('Le nouveau mot de passe doit être différent de l’actuel');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      // Re-authenticate to verify current password
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (reauthError) {
        toast.error('Mot de passe actuel incorrect');
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        toast.error(updateError.message);
        return;
      }

      toast.success('Mot de passe mis à jour.');
      setCurrentPassword('');
      setNewPassword('');
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Une erreur est survenue lors de la mise à jour.';
      toast.error(errorMessage);
    } finally {
      setIsUpdatingPassword(false);
    }
  };
  
  if (loading && !cachedProfile) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          </div>
        </div>
      </Layout>
    );
  }
  
  const initials = `${formData.first_name?.[0] || ''}${formData.last_name?.[0] || ''}`.toUpperCase();

  const freePlanLimitations = [
    "Stations en illimité",
    "+10 nouvelles stations / semaine",
    "Classement hebdomadaire dynamique",
    "Classement par station",
    "Évaluation IA complète",
    "Accès prioritaire au support",
    "Accès anticipé aux nouvelles fonctionnalités",
  ];

  const display = profile || cachedProfile || {};
  const displayEmoji: string = (display as any)?.emoji || formData.emoji || '';
  const isPremiumUser = Boolean((profile as any)?.premium);

  // --- UPDATED: Invoke Edge Function with return_url and redirect ---
  const handleManageSubscription = async () => {
    setIsManagingSubscription(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-portal', {
        body: JSON.stringify({
          return_url: window.location.href,
        }),
      });

      if (error) throw error;
      const url = (data as any)?.url as string | undefined;
      if (!url) {
        throw new Error("Lien de gestion indisponible. Réessayez plus tard ou contactez le support.");
      }

      window.location.href = url;
    } catch (error) {
      console.error('Error redirecting to customer portal:', error);
      const message = error instanceof Error ? error.message : "Une erreur est survenue.";
      toast.error(`Impossible d'accéder au portail de gestion : ${message}`);
    } finally {
      setIsManagingSubscription(false);
    }
  };

  return (
    <Layout>
      <div className="bg-gray-50 min-h-screen">
        <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8 space-y-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900">
              {`${(display as any).first_name || ''} ${(display as any).last_name || ''}`}
            </h1>
            <p className="text-gray-500 mt-1">
              Membre depuis le {formatJoinDate((display as any).created_at)}
            </p>
          </div>

          {/* Identity Form Card */}
          <form onSubmit={handleSubmit} className="bg-white p-8 shadow-sm rounded-lg border border-gray-200">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-2xl font-semibold text-gray-800">Identité</h2>
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center mb-2">
                {displayEmoji ? (
                  <span className="text-5xl" role="img" aria-label="photo de profil">{displayEmoji}</span>
                ) : (
                  <span className="text-3xl font-semibold text-gray-600">{initials}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowEmojiPicker(v => !v)}
                className="text-xs text-accent hover:underline disabled:opacity-50"
                disabled={isUpdatingEmoji}
              >
                {showEmojiPicker ? 'Fermer' : (displayEmoji ? 'Changer' : 'Ajouter un emoji')}
              </button>
            </div>
          </div>

          {showEmojiPicker && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">Choisis un emoji pour ton avatar.</p>
                <button
                  type="button"
                  className="text-xs text-gray-500 hover:text-gray-700"
                  onClick={() => handleSelectEmoji('')}
                  disabled={isUpdatingEmoji}
                >
                  {displayEmoji ? 'Retirer l\'emoji' : 'Aucun emoji'}
                </button>
              </div>
              <div className="grid grid-cols-9 gap-2">
                {EMOJI_OPTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => handleSelectEmoji(e)}
                    disabled={isUpdatingEmoji}
                    className={`h-10 w-full flex items-center justify-center rounded-md border transition-colors ${formData.emoji === e ? 'border-accent bg-[#03BB26]/10' : 'border-gray-300 hover:bg-gray-50'}`}
                    aria-pressed={formData.emoji === e}
                    aria-label={`Choisir ${e}`}
                  >
                    <span className="text-2xl" aria-hidden>
                      {e}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              {/* Pseudo */}
              <div className="md:col-span-2">
                <label htmlFor="pseudo" className="block text-sm font-bold text-gray-700">
                  Pseudo
                </label>
                <input
                  type="text"
                  name="pseudo"
                  id="pseudo"
                  value={formData.pseudo}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
                />
              </div>

              {/* Prénom */}
              <div>
                <label htmlFor="first_name" className="block text-sm font-bold text-gray-700">
                  Prénom <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="first_name"
                  id="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
                />
              </div>
              
              {/* Nom */}
              <div>
                <label htmlFor="last_name" className="block text-sm font-bold text-gray-700">
                  Nom <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="last_name"
                  id="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
                />
              </div>
              
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-bold text-gray-700">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  id="email"
                  value={user?.email || ''}
                  disabled
                  className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md shadow-sm sm:text-sm cursor-not-allowed"
                />
              </div>

              {/* Téléphone */}
              <div>
                <label htmlFor="phone" className="block text-sm font-bold text-gray-700">
                  Téléphone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  id="phone"
                  value={formData.phone}
                  disabled
                  className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md shadow-sm sm:text-sm cursor-not-allowed"
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button
                type="submit"
                disabled={isUpdating}
                className="inline-flex justify-center py-2 px-6 border border-accent shadow-sm text-sm font-medium rounded-full text-accent bg-white hover:bg-[#03BB26]/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50 disabled:cursor-wait"
              >
                {isUpdating ? 'Mise à jour en cours...' : 'Mettre à jour mes informations'}
              </button>
            </div>
          </form>

          {/* Sécurité Card */}
          <form onSubmit={handleUpdatePassword} className="bg-white p-8 shadow-sm rounded-lg border border-gray-200">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">Sécurité</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <label htmlFor="current_password" className="block text-sm font-bold text-gray-700">
                  Mot de passe actuel <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  name="current_password"
                  id="current_password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="new_password" className="block text-sm font-bold text-gray-700">
                  Nouveau mot de passe <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  name="new_password"
                  id="new_password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  required
                  className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">Minimum 6 caractères.</p>
              </div>
              
            </div>
            <div className="mt-8 flex justify-end">
              <button
                type="submit"
                disabled={isUpdatingPassword}
                className="inline-flex justify-center py-2 px-6 border border-accent shadow-sm text-sm font-medium rounded-full text-accent bg-white hover:bg-[#03BB26]/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50 disabled:cursor-wait"
              >
                {isUpdatingPassword ? 'Mise à jour...' : 'Mettre à jour mon mot de passe'}
              </button>
            </div>
          </form>

          {/* Subscription Card */}
          <div className="bg-white p-8 shadow-sm rounded-lg border border-gray-200">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Abonnement</h2>
            {isPremiumUser ? (
              <>
                <p className="text-gray-600 mb-6">
                  Abonnement actuel : <span className="font-bold text-gray-800">Premium</span>
                </p>
                <ul className="space-y-3 mb-8">
                  {freePlanLimitations.map((item, index) => (
                    <li key={index} className="flex items-center text-gray-700">
                      <Check size={18} className="text-green-600 mr-3 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="flex justify-end">
                  {/* --- UPDATED BUTTON with loading and disabled states --- */}
                  <button
                    onClick={handleManageSubscription}
                    disabled={isManagingSubscription}
                    className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-full text-white bg-accent hover:bg-[#03BB26]/85 disabled:opacity-50 disabled:cursor-wait"
                  >
                    {isManagingSubscription ? 'Chargement...' : (
                      <>
                        <span className="inline-flex items-center bg-white/20 text-white text-xs font-semibold mr-3 px-2.5 py-0.5 rounded-full">
                          <Zap size={14} className="mr-1" />
                          Premium
                        </span>
                        Gérer mon abonnement
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-gray-600 mb-6">
                  Abonnement actuel : <span className="font-bold text-gray-800">Gratuit</span>
                </p>
                <ul className="space-y-3 mb-8">
                  {freePlanLimitations.map((item, index) => (
                    <li key={index} className="flex items-center text-gray-500">
                      <X size={18} className="text-red-500 mr-3 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="flex justify-end">
                  <button
                    onClick={() => navigate('/pricing')}
                    className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-full text-white bg-accent hover:bg-[#03BB26]/85"
                  >
                    <span className="inline-flex items-center bg-white/20 text-white text-xs font-semibold mr-3 px-2.5 py-0.5 rounded-full">
                      <Zap size={14} className="mr-1" />
                      Premium
                    </span>
                    Je m’abonne à top ECOS Premium
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Support / Contact Card */}
          <div className="bg-white p-8 shadow-sm rounded-lg border border-gray-200">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Une question ?</h2>
            <div className="flex justify-end">
              <a
                href="mailto:support@top-ecos.com"
                className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-full text-white bg-accent hover:bg-[#03BB26]/85"
              >
                Écris-nous ici
              </a>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Profil;
