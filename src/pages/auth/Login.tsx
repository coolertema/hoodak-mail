import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Mail, Loader2, LogIn, UserPlus, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

declare global {
    interface Window {
        hoodakTurnstileSuccess?: (token: string) => void;
        hoodakTurnstileExpired?: () => void;
        turnstile?: { reset: () => void };
    }
}

interface PublicConfig {
    signupEnabled: boolean;
    mailDomain: string;
    turnstileSiteKey?: string;
}

export default function Login() {
    const { login, checkSession } = useAuth();
    const navigate = useNavigate();
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [turnstileToken, setTurnstileToken] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [config, setConfig] = useState<PublicConfig>({ signupEnabled: true, mailDomain: 'hoodak-team.lol' });

    useEffect(() => {
        apiFetch<PublicConfig>('/api/public-config').then(setConfig).catch(() => undefined);
    }, []);

    useEffect(() => {
        window.hoodakTurnstileSuccess = (token: string) => setTurnstileToken(token);
        window.hoodakTurnstileExpired = () => setTurnstileToken('');
        if (config.turnstileSiteKey && !document.querySelector('script[data-hoodak-turnstile]')) {
            const script = document.createElement('script');
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
            script.async = true;
            script.defer = true;
            script.dataset.hoodakTurnstile = '1';
            document.head.appendChild(script);
        }
        return () => {
            delete window.hoodakTurnstileSuccess;
            delete window.hoodakTurnstileExpired;
        };
    }, [config.turnstileSiteKey]);

    const changeMode = (next: 'login' | 'register') => {
        setMode(next);
        setPassword('');
        setConfirmPassword('');
        setTurnstileToken('');
        window.turnstile?.reset();
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!username.trim() || !password) return toast.error('Заполните все поля');
        if (mode === 'register' && password !== confirmPassword) return toast.error('Пароли не совпадают');
        if (mode === 'register' && config.turnstileSiteKey && !turnstileToken) return toast.error('Подтвердите, что вы не робот');

        setIsLoading(true);
        try {
            if (mode === 'register') {
                const result = await apiFetch<{ success: boolean; address: string }>('/api/register', {
                    method: 'POST',
                    body: JSON.stringify({ username: username.trim(), password, turnstileToken })
                });
                await checkSession();
                toast.success(`Почта ${result.address} создана`);
            } else {
                await login({ username: username.trim(), password });
                toast.success('Вход выполнен');
            }
            navigate('/dashboard', { replace: true });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Не удалось выполнить операцию';
            toast.error(message);
            setTurnstileToken('');
            window.turnstile?.reset();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-10 hoodak-auth-screen">
            <Card className="w-full max-w-md hoodak-auth-card">
                <CardHeader className="space-y-2">
                    <div className="flex justify-center mb-3">
                        <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
                            <Mail className="h-8 w-8 text-primary" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl text-center">HoodakMail</CardTitle>
                    <CardDescription className="text-center">
                        {mode === 'login' ? 'Войдите в свою защищённую почту' : 'Создайте личный почтовый адрес'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {config.signupEnabled && (
                        <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 mb-5">
                            <button type="button" onClick={() => changeMode('login')} className={`hoodak-auth-tab ${mode === 'login' ? 'is-active' : ''}`}>Вход</button>
                            <button type="button" onClick={() => changeMode('register')} className={`hoodak-auth-tab ${mode === 'register' ? 'is-active' : ''}`}>Регистрация</button>
                        </div>
                    )}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium" htmlFor="hoodak-username">{mode === 'login' ? 'Логин или почта' : 'Адрес почты'}</label>
                            {mode === 'register' ? (
                                <div className="flex items-center rounded-xl border bg-background overflow-hidden hoodak-address-input">
                                    <Input id="hoodak-username" className="border-0 rounded-none focus-visible:ring-0" placeholder="yourname" value={username} onChange={e => setUsername(e.target.value.toLowerCase())} disabled={isLoading} autoComplete="username" autoFocus />
                                    <span className="pr-3 text-xs text-muted-foreground whitespace-nowrap">@{config.mailDomain}</span>
                                </div>
                            ) : (
                                <Input id="hoodak-username" placeholder={`yourname или yourname@${config.mailDomain}`} value={username} onChange={e => setUsername(e.target.value)} disabled={isLoading} autoComplete="username" autoFocus />
                            )}
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium" htmlFor="hoodak-password">Пароль</label>
                            <Input id="hoodak-password" type="password" placeholder={mode === 'register' ? 'Минимум 8 символов, буква и цифра' : 'Введите пароль'} value={password} onChange={e => setPassword(e.target.value)} disabled={isLoading} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} />
                        </div>
                        {mode === 'register' && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium" htmlFor="hoodak-confirm">Повторите пароль</label>
                                <Input id="hoodak-confirm" type="password" placeholder="Повторите пароль" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} disabled={isLoading} autoComplete="new-password" />
                            </div>
                        )}
                        {mode === 'register' && config.turnstileSiteKey && (
                            <div className="flex justify-center min-h-[65px]">
                                <div className="cf-turnstile" data-sitekey={config.turnstileSiteKey} data-theme="dark" data-callback="hoodakTurnstileSuccess" data-expired-callback="hoodakTurnstileExpired" />
                            </div>
                        )}
                        <Button className="w-full h-11" type="submit" disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : mode === 'login' ? <LogIn className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />}
                            {isLoading ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
                        </Button>
                    </form>
                    {mode === 'register' && <p className="mt-4 text-xs text-center text-muted-foreground">Создавая аккаунт, вы соглашаетесь не использовать HoodakMail для спама и незаконных действий.</p>}
                </CardContent>
                <CardFooter className="flex justify-center gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="h-4 w-4" /> Защищено Cloudflare
                </CardFooter>
            </Card>
        </div>
    );
}
