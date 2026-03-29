import { useEffect, useState } from 'react';
import { useAuth } from '@/shared/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { AlertCircle, Stethoscope } from 'lucide-react';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { StorageManager } from '@/shared/lib/storage';

// ─────────────────────────────────────────────────────────
// Error translation — every known error gets a unique French message
// ─────────────────────────────────────────────────────────
const translateAuthError = (message?: string | null): string => {
  const m = (message || '').toLowerCase();
  if (!m) return 'Une erreur est survenue. Réessaie.';

  // ── Sign in ──
  if (m.includes('invalid login credentials'))
    return 'Email ou mot de passe incorrect.';
  if (m.includes('email not confirmed'))
    return 'Ton adresse e‑mail n\'a pas encore été confirmée.';
  if (m.includes('invalid email or password'))
    return 'Email ou mot de passe incorrect.';

  // ── Sign up — duplicates ──
  if (m.includes('user already registered') || m.includes('user already exists'))
    return 'Un compte existe déjà avec cet e‑mail.';
  if (m.includes('phone already used'))
    return 'Ce numéro de téléphone est déjà associé à un compte.';
  if (m.includes('phone or email already used'))
    return 'Ce numéro de téléphone ou cet e‑mail est déjà utilisé.';

  // ── Sign up — validation ──
  if (m.includes('invalid email'))
    return 'Adresse e‑mail invalide.';
  if (m.includes('password should be at least 6 characters') || m.includes('password too short'))
    return 'Le mot de passe doit contenir au moins 6 caractères.';
  if (m.includes('email or password is required'))
    return 'Email et mot de passe sont requis.';
  if (m.includes('missing phone number'))
    return 'Le numéro de téléphone est requis.';

  // ── SMS / verify-code ──
  if (m.includes('code incorrect'))
    return 'Code incorrect. Vérifie le SMS et réessaie.';
  if (m.includes('invalid code'))
    return 'Le code doit contenir exactement 6 chiffres.';
  if (m.includes('unable to create user'))
    return 'Impossible de créer le compte. Réessaie.';

  // ── Server / config ──
  if (m.includes('missing server configuration'))
    return 'Erreur de configuration du serveur. Contacte le support.';
  if (m.includes('invalid content type'))
    return 'Erreur technique (format de requête). Contacte le support.';

  // ── Rate limiting ──
  if (m.includes('rate limit') || m.includes('too many requests'))
    return 'Trop de tentatives. Réessaie dans quelques minutes.';

  // ── Session ──
  if (m.includes('refresh token not found') || m.includes('session expired'))
    return 'Session expirée. Merci de te reconnecter.';

  // ── Network ──
  if (m.includes('failed to fetch') || m.includes('network'))
    return 'Problème de connexion internet. Vérifie ton réseau.';

  // ── Catch-all for the generic Edge Function error ──
  if (m.includes('edge function returned a non-2xx'))
    return 'Le serveur a rencontré un problème. Réessaie.';

  // ── Default ──
  return 'Une erreur est survenue. Réessaie.';
};

// ─────────────────────────────────────────────────────────
// Helper to call Edge Functions and extract the REAL error
// supabase.functions.invoke returns a generic message on non-2xx;
// the actual error is buried in error.context (the raw Response).
// ─────────────────────────────────────────────────────────
async function invokeEdge(
  functionName: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke(functionName, { body });

  if (error) {
    let realMessage = error.message;

    // Try to read the actual JSON body from the Response stored in error.context
    try {
      if ('context' in error && error.context instanceof Response) {
        const parsed = await error.context.json();
        if (parsed?.error) realMessage = parsed.error;
      }
    } catch {
      // context wasn't readable — fall through
    }

    // Some versions of supabase-js still populate data alongside error
    if (data?.error && typeof data.error === 'string') {
      realMessage = data.error;
    }

    throw new Error(realMessage);
  }

  // Edge function returned 2xx but with { ok: false, error: "..." }
  if (data && data.ok === false && data.error) {
    throw new Error(data.error);
  }

  return data;
}

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState('+33');
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [authStep, setAuthStep] = useState<'signin' | 'forgot' | 'reset'>('signin');
  const [signupStep, setSignupStep] = useState<'form' | 'code'>('form');
  const [verificationCode, setVerificationCode] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [pendingAuth, setPendingAuth] = useState<
    { mode: 'signup'; email: string; password: string; firstName: string; lastName: string; phone?: string } | null
  >(null);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Get the page they tried to visit before login
  const from = location.state?.from?.pathname || '/';

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const { error } = await signIn(email, password);
    if (error) {
      setError(translateAuthError(error.message));
    } else {
      navigate(from, { replace: true });
    }
    setIsLoading(false);
  };

  // Handle password reset email request
  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData(e.currentTarget);
    const email = (formData.get('email') as string)?.trim();
    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      setIsLoading(false);
      return;
    }

    try {
      const redirectTo = `${window.location.origin}/auth`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) {
        // Deliberately avoid leaking whether the email exists
        console.warn('Password reset request error:', error.message);
      }
      setSuccess("Si un compte existe pour cet email, un lien de réinitialisation vient d'être envoyé.");
      setAuthStep('signin');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.warn('Password reset request failed:', errorMessage);
      setSuccess("Si un compte existe pour cet email, un lien de réinitialisation vient d'être envoyé.");
      setAuthStep('signin');
    } finally {
      setIsLoading(false);
    }
  };

  const validateEmail = (email: string): string | null => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) return 'L\'email est requis';
    if (!emailRegex.test(email)) return 'Veuillez entrer une adresse email valide';
    return null;
  };

  const validatePhone = (phone: string): string | null => {
    if (!phone || !phone.trim()) return "Le numéro de téléphone est requis";
    const phoneRegex = /^[0-9\s]{8,15}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
      return 'Le numéro de téléphone doit contenir entre 8 et 15 chiffres';
    }
    return null;
  };

  const validatePassword = (password: string): string | null => {
    if (!password) return 'Le mot de passe est requis';
    if (password.length < 6) return 'Le mot de passe doit contenir au moins 6 caractères';
    return null;
  };

  // Handle updating the password after the recovery link
  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData(e.currentTarget);
    const newPassword = formData.get('newPassword') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    const pwdError = validatePassword(newPassword);
    if (pwdError) {
      setError(pwdError);
      setIsLoading(false);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setError(translateAuthError(error.message));
        return;
      }
      setSuccess('Votre mot de passe a été mis à jour.');
      // User is already authenticated via the recovery link, navigate inside the app
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : null;
      setError(translateAuthError(errorMessage) || 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setValidationErrors({});

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const phoneNumber = formData.get('phoneNumber') as string;

    // Validate inputs
    const errors: {[key: string]: string} = {};
    
    const emailError = validateEmail(email);
    if (emailError) errors.email = emailError;
    
    const phoneError = validatePhone(phoneNumber);
    if (phoneError) errors.phone = phoneError;
    
    const passwordError = validatePassword(password);
    if (passwordError) errors.password = passwordError;

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setIsLoading(false);
      return;
    }

    const fullPhone = phoneNumber ? `${countryCode}${phoneNumber}` : undefined;

    try {
      await invokeEdge('send-sms', { phone: fullPhone });

      // Save details for later and move to code step
      setPendingAuth({ mode: 'signup', email, password, firstName, lastName, phone: fullPhone });
      setSignupStep('code');
      setSuccess('Un code à 6 chiffres vient d\'être envoyé par SMS.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      setError(translateAuthError(msg));
    } finally {
      setIsLoading(false);
    }
  };

  const resendCode = async () => {
    if (!pendingAuth) return;
    try {
      setResendLoading(true);
      await invokeEdge('send-sms', { phone: pendingAuth.phone });
      setSuccess('Code renvoyé.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      setError(translateAuthError(msg));
    } finally {
      setResendLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!pendingAuth) return;
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { email, password, firstName, lastName, phone } = pendingAuth;
      await invokeEdge('verify-code', {
        code: verificationCode,
        email,
        password,
        firstName,
        lastName,
        phone,
      });

      // Then sign in with the provided credentials
      const { error: signInError } = await signIn(email, password);
      if (signInError) throw signInError;

      navigate(from, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      setError(translateAuthError(msg));
    } finally {
      setIsLoading(false);
    }
  };

  // Detect password recovery state from URL or auth events
  useEffect(() => {
    const hash = window.location.hash || '';
    const params = new URLSearchParams(hash.replace('#', ''));
    const searchParams = new URLSearchParams(window.location.search || '');
    const type = params.get('type') || searchParams.get('type');
    const access_token = params.get('access_token') || searchParams.get('access_token');
    const refresh_token = params.get('refresh_token') || searchParams.get('refresh_token');

    // If recovery params present, set the session and show reset form
    if (type === 'recovery' && access_token && refresh_token) {
      supabase.auth.setSession({ access_token, refresh_token }).then(() => {
        setActiveTab('signin');
        setAuthStep('reset');
        // Clean the URL hash to avoid confusing later
        history.replaceState(null, '', window.location.pathname + window.location.search);
      });
    }

    // Also honor a persisted flag (set by AuthProvider) in case
    // the library consumed the URL hash before this effect ran.
    const flagged = StorageManager.getPasswordRecoveryFlag();
    if (flagged === '1') {
      setActiveTab('signin');
      setAuthStep('reset');
      StorageManager.removePasswordRecoveryFlag();
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setActiveTab('signin');
        setAuthStep('reset');
      }
    });
    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // Back navigation removed per request

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-4">
          {/* Place Topecos logo at top-left corner */}
          <div className="hidden sm:block fixed top-5 left-5 sm:top-6 sm:left-6 -translate-y-[5vh] z-50">
          <img
            src="/topecos-nocase.png"
            alt="top ecos logo"
            className="h-36 w-36 object-contain rounded-full transform origin-top-left scale-[0.7] sm:scale-100"
            />
          </div>

          <p className="text-black text-xl font-bold">
            {activeTab === 'signin' ? 'Heureux de te voir !' : 'Inscris-toi gratuitement'}
          </p>
          </div>

        {/* Auth Card */}
        <Card>
          <CardHeader>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'signin' | 'signup')} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger 
                  value="signin"
                  className="data-[state=active]:!text-accent data-[state=active]:!bg-[#03BB25]/30"
                >
                  Connexion
                </TabsTrigger>
                <TabsTrigger 
                  value="signup"
                  className="data-[state=active]:!text-accent data-[state=active]:!bg-[#03BB25]/30"
                >
                  Inscription
                </TabsTrigger>
              </TabsList>

              {/* Alerts */}
              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="mt-4 border-green-200 bg-green-50">
                  <AlertCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">{success}</AlertDescription>
                </Alert>
              )}

              {/* Sign In / Forgot / Reset Tab */}
              <TabsContent value="signin" className="space-y-4">
                {authStep === 'signin' && (
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email" className="text-black">Email</Label>
                      <Input
                        id="signin-email"
                        name="email"
                        type="email"
                        placeholder="mardi.mai@top-ecos.com"
                        className="placeholder:text-[#707070]"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="signin-password" className="text-black">Mot de passe</Label>
                        <button
                          type="button"
                          className="text-xs underline text-muted-foreground hover:text-muted-foreground"
                          onClick={() => setAuthStep('forgot')}
                        >
                          Mot de passe oublié ?
                        </button>
                      </div>
                      <Input
                        id="signin-password"
                        name="password"
                        type="password"
                        placeholder="mot de passe"
                        className="placeholder:text-[#707070]"
                        required
                      />
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="w-full" 
                      style={{ backgroundColor: '#03BB26' }}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Connexion...' : <strong>C'est parti !</strong>}
                    </Button>
                  </form>
                )}

                {authStep === 'forgot' && (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="forgot-email" className="text-black">Ton email</Label>
                      <Input
                        id="forgot-email"
                        name="email"
                        type="email"
                        placeholder="mardi.mai@top-ecos.com"
                        className="placeholder:text-[#707070]"
                        required
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        className="text-xs underline text-muted-foreground hover:text-muted-foreground"
                        onClick={() => setAuthStep('signin')}
                      >
                        Retour à la connexion
                      </button>
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full" 
                      style={{ backgroundColor: '#03BB26' }}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Envoi...' : <strong>Envoyer le lien</strong>}
                    </Button>
                  </form>
                )}

                {authStep === 'reset' && (
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-password" className="text-black">Nouveau mot de passe</Label>
                      <Input
                        id="new-password"
                        name="newPassword"
                        type="password"
                        minLength={6}
                        className="placeholder:text-[#707070]"
                        required
                      />
                      <p className="text-xs text-muted-foreground">Minimum 6 caractères</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password" className="text-black">Confirmer le mot de passe</Label>
                      <Input
                        id="confirm-password"
                        name="confirmPassword"
                        type="password"
                        minLength={6}
                        className="placeholder:text-[#707070]"
                        required
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full" 
                      style={{ backgroundColor: '#03BB26' }}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Mise à jour...' : <strong>Mettre à jour le mot de passe</strong>}
                    </Button>
                  </form>
                )}

                {/* No code step for sign in */}
              </TabsContent>

              {/* Sign Up Tab */}
              <TabsContent value="signup" className="space-y-4">
                {signupStep === 'form' && (
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-firstname" className="text-black">Prénom <span className="text-red-600">*</span></Label>
                      <Input
                        id="signup-firstname"
                        name="firstName"
                        type="text"
                        placeholder="Mardi"
                        className="placeholder:text-[#707070]"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="signup-lastname" className="text-black">Nom <span className="text-red-600">*</span></Label>
                      <Input
                        id="signup-lastname"
                        name="lastName"
                        type="text"
                        placeholder="Mai"
                        className="placeholder:text-[#707070]"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-black">Email <span className="text-red-600">*</span></Label>
                    <Input
                      id="signup-email"
                      name="email"
                      type="email"
                      placeholder="mardi.mai@top-ecos.com"
                      required
                      className={`placeholder:text-[#707070] ${validationErrors.email ? 'border-red-500' : ''}`}
                    />
                    {validationErrors.email && (
                      <p className="text-xs text-red-600">{validationErrors.email}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-phone" className="text-black">Téléphone <span className="text-red-600">*</span></Label>
                    <div className="flex gap-2">
                      <Select value={countryCode} onValueChange={setCountryCode}>
                        <SelectTrigger className="w-[120px] text-[#707070]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="+33">🇫🇷 +33</SelectItem>
                          <SelectItem value="+590">🇬🇵 +590</SelectItem>
                          <SelectItem value="+596">🇲🇶 +596</SelectItem>
                          <SelectItem value="+262">🇷🇪 +262</SelectItem>
                          <SelectItem value="+594">🇬🇫 +594</SelectItem>
                          <SelectItem value="+32">🇧🇪 +32</SelectItem>
                          <SelectItem value="+41">🇨🇭 +41</SelectItem>
                          <SelectItem value="+1">🇺🇸 +1</SelectItem>
                          <SelectItem value="+44">🇬🇧 +44</SelectItem>
                          <SelectItem value="+49">🇩🇪 +49</SelectItem>
                          <SelectItem value="+39">🇮🇹 +39</SelectItem>
                          <SelectItem value="+34">🇪🇸 +34</SelectItem>
                          <SelectItem value="+351">🇵🇹 +351</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        id="signup-phone"
                        name="phoneNumber"
                        type="tel"
                        placeholder="6 12 34 56 78"
                        required
                        className={`flex-1 placeholder:text-[#707070] ${validationErrors.phone ? 'border-red-500' : ''}`}
                      />
                    </div>
                    {validationErrors.phone && (
                      <p className="text-xs text-red-600">{validationErrors.phone}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-black">Mot de passe <span className="text-red-600">*</span></Label>
                    <Input
                      id="signup-password"
                      name="password"
                      type="password"
                      placeholder="mot de passe"
                      minLength={6}
                      required
                      className={`placeholder:text-[#707070] ${validationErrors.password ? 'border-red-500' : ''}`}
                    />
                    {validationErrors.password && (
                      <p className="text-xs text-red-600">{validationErrors.password}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Minimum 6 caractères
                    </p>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full" 
                    style={{ backgroundColor: '#03BB26' }}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Envoi du code...' : <strong>Inscription</strong>}
                  </Button>
                </form>
                )}

                {signupStep === 'code' && (
                  <form onSubmit={handleVerifyCode} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-code" className="text-black">Code de vérification</Label>
                      <Input
                        id="signup-code"
                        name="code"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        placeholder="••••••"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="placeholder:text-[#707070]"
                        required
                      />
                      <p className="text-xs text-muted-foreground">Entre le code à 6 chiffres reçu par SMS</p>
                    </div>

                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={resendCode}
                        disabled={resendLoading}
                        className="text-xs underline text-muted-foreground hover:text-muted-foreground"
                      >
                        {resendLoading ? 'Renvoi...' : 'Renvoyer le code SMS'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSignupStep('form'); setPendingAuth(null); setVerificationCode(''); setSuccess(null); }}
                        className="text-xs underline text-muted-foreground hover:text-muted-foreground"
                      >
                        Modifier mes infos
                      </button>
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full" 
                      style={{ backgroundColor: '#03BB26' }}
                      disabled={isLoading || verificationCode.length !== 6}
                    >
                      {isLoading ? 'Vérification...' : <strong>Valider</strong>}
                    </Button>
                  </form>
                )}

                <div className="text-xs text-muted-foreground text-center">
                  En t'inscrivant, tu acceptes nos{' '}
                  <a
                    href="https://top-ecos.com/legal"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    conditions d'utilisation et notre politique de confidentialité
                  </a>{'.'}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
