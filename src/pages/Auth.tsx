import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Stethoscope } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';

// Map common Supabase auth error messages to French user-friendly text
const translateAuthError = (message?: string | null): string => {
  const m = (message || '').toLowerCase();
  if (!m) return 'Une erreur est survenue. Réessaie.';

  // Credentials / login
  if (m.includes('invalid login credentials')) return 'Identifiants de connexion invalides.';
  if (m.includes('email not confirmed')) return 'Veuillez confirmer votre adresse e‑mail avant de vous connecter.';
  if (m.includes('invalid email or password')) return 'Email ou mot de passe incorrect.';

  // Sign up / existing user
  if (m.includes('user already registered') || m.includes('user already exists')) {
    return 'Un compte existe déjà avec cet e‑mail.';
  }

  // Validation
  if (m.includes('invalid email')) return 'Adresse e‑mail invalide.';
  if (m.includes('password should be at least 6 characters') || m.includes('password too short')) {
    return 'Le mot de passe doit contenir au moins 6 caractères.';
  }
  if (m.includes('email or password is required')) return 'Email et mot de passe sont requis.';

  // Rate limiting / throttling
  if (m.includes('rate limit') || m.includes('too many requests')) {
    return 'Trop de tentatives. Réessaie plus tard.';
  }

  // Session / token
  if (m.includes('refresh token not found') || m.includes('session expired')) {
    return 'Session expirée. Merci de te reconnecter.';
  }

  // Network
  if (m.includes('failed to fetch') || m.includes('network')) {
    return 'Problème réseau. Vérifie ta connexion internet.';
  }

  // Default fallback
  return 'Une erreur est survenue. ' + (message || 'Réessaie.');
};

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
  const { signIn, signUp } = useAuth();
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
    } catch (err: any) {
      console.warn('Password reset request failed:', err?.message);
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
    if (!phone) return null; // Phone is optional
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
    } catch (err: any) {
      setError(translateAuthError(err?.message) || 'Une erreur est survenue');
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
      // Step 1: Ask server to send code (fake SMS)
      const { error: fnError } = await supabase.functions.invoke('send-sms', {
        body: { phone: fullPhone },
      });
      if (fnError) throw fnError;

      // Save details for later and move to code step
      setPendingAuth({ mode: 'signup', email, password, firstName, lastName, phone: fullPhone });
      setSignupStep('code');
      setSuccess('Un code à 6 chiffres vient d\'être envoyé par sms.');
    } catch (err: any) {
      setError(translateAuthError(err?.message) || 'Impossible d\'envoyer le code');
    } finally {
      setIsLoading(false);
    }
  };

  const resendCode = async () => {
    if (!pendingAuth) return;
    try {
      setResendLoading(true);
      const { error } = await supabase.functions.invoke('send-sms', {
        body: { phone: pendingAuth.phone },
      });
      if (error) throw error;
      setSuccess('Code renvoyé.');
    } catch (err: any) {
      setError(translateAuthError(err?.message) || 'Impossible de renvoyer le code');
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
      // Verify the 6-digit code (signup only)
      const { email, password, firstName, lastName, phone } = pendingAuth;
      const { error: verifyError } = await supabase.functions.invoke('verify-code', {
        body: { code: verificationCode, phone },
      });
      if (verifyError) throw verifyError;

      const { error } = await signUp(email, password, firstName, lastName, phone);
      if (error) throw error;

      // Ensure we have the user ID to upsert into profiles
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (userId) {
        await supabase.from('profiles').upsert(
          {
            user_id: userId,
            first_name: firstName,
            last_name: lastName,
            phone: phone,
            email: email,
          },
          { onConflict: 'user_id' as any }
        );
      }
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(translateAuthError(err?.message) || 'Code invalide');
    } finally {
      setIsLoading(false);
    }
  };

  // Detect password recovery state from URL or auth events
  useEffect(() => {
    const hash = window.location.hash || '';
    const params = new URLSearchParams(hash.replace('#', ''));
    const type = params.get('type');
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');

    // If recovery params present, set the session and show reset form
    if (type === 'recovery' && access_token && refresh_token) {
      supabase.auth.setSession({ access_token, refresh_token }).then(() => {
        setActiveTab('signin');
        setAuthStep('reset');
        // Clean the URL hash to avoid confusing later
        history.replaceState(null, '', window.location.pathname + window.location.search);
      });
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
          <div className="absolute -top-4 sm:-top-5 lg:-top-6 left-4">
            <img
              src="/topecos-nocase.png"
              alt="Topecos logo"
              className="h-36 w-36 object-contain rounded-full"
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
                  Je m'inscris
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
                      <Label htmlFor="signin-email">Email</Label>
                      <Input
                        id="signin-email"
                        name="email"
                        type="email"
                        placeholder="votre.email@exemple.com"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="signin-password">Mot de passe</Label>
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
                      <Label htmlFor="forgot-email">Ton email</Label>
                      <Input
                        id="forgot-email"
                        name="email"
                        type="email"
                        placeholder="votre.email@exemple.com"
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
                      <Label htmlFor="new-password">Nouveau mot de passe</Label>
                      <Input
                        id="new-password"
                        name="newPassword"
                        type="password"
                        minLength={6}
                        required
                      />
                      <p className="text-xs text-muted-foreground">Minimum 6 caractères</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                      <Input
                        id="confirm-password"
                        name="confirmPassword"
                        type="password"
                        minLength={6}
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
                      <Label htmlFor="signup-firstname">Prénom</Label>
                      <Input
                        id="signup-firstname"
                        name="firstName"
                        type="text"
                        placeholder="Jean"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="signup-lastname">Nom</Label>
                      <Input
                        id="signup-lastname"
                        name="lastName"
                        type="text"
                        placeholder="Dupont"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      name="email"
                      type="email"
                      placeholder="votre.email@exemple.com"
                      required
                      className={validationErrors.email ? 'border-red-500' : ''}
                    />
                    {validationErrors.email && (
                      <p className="text-xs text-red-600">{validationErrors.email}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-phone">Téléphone</Label>
                    <div className="flex gap-2">
                      <Select value={countryCode} onValueChange={setCountryCode}>
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="+33">🇫🇷 +33</SelectItem>
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
                        className={`flex-1 ${validationErrors.phone ? 'border-red-500' : ''}`}
                      />
                    </div>
                    {validationErrors.phone && (
                      <p className="text-xs text-red-600">{validationErrors.phone}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Mot de passe</Label>
                    <Input
                      id="signup-password"
                      name="password"
                      type="password"
                      minLength={6}
                      required
                      className={validationErrors.password ? 'border-red-500' : ''}
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
                      <Label htmlFor="signup-code">Code de vérification</Label>
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
                        required
                      />
                      <p className="text-xs text-muted-foreground">Entre le code à 6 chiffres</p>
                    </div>

                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={resendCode}
                        disabled={resendLoading}
                        className="text-xs underline text-muted-foreground hover:text-muted-foreground"
                      >
                        {resendLoading ? 'Renvoi...' : 'Renvoyer le code'}
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
                  En t’inscrivant, tu acceptes nos{' '}
                  <a
                    href="https://top-ecos.com/legal"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    conditions d’utilisation
                  </a>{' '}et notre{' '}
                  <a
                    href="https://top-ecos.com/legal"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    politique de confidentialité
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
