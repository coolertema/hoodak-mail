import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Mail, Users, Copy, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserList } from './UserList';
import { MailboxList } from './MailboxList';
import { TempMailGenerator } from './TempMailGenerator';

export default function Dashboard() {
    const { user } = useAuth();
    // Overview state
    const [stats, setStats] = useState({ total: 0, online: true });

    // Mailbox User state
    const isMailboxUser = user?.role === 'mailbox';
    const isAdmin = user?.role === 'admin';
    const isPersonalUser = user?.role === 'user';

    // Fetch basic stats for overview
    const fetchStats = useCallback(async () => {
        if (!user || user.role !== 'admin') return;
        try {
            // Re-using mailboxes endpoint or dedicated stats endpoint if available
            // For now, let's just use the mailboxes endpoint to get total count
            const data = await apiFetch<{ total: number }>('/api/mailboxes?limit=1');
            if (data && typeof data.total === 'number') {
                setStats(s => ({ ...s, total: data.total }));
            }
        } catch {
            console.error('Failed to fetch stats');
        }
    }, [user]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void fetchStats();
    }, [fetchStats]);

    if (isPersonalUser) {
        const address = user?.mailboxAddress || `${user?.username}@${user?.mailDomain || 'hoodak-team.lol'}`;
        const copyAddress = async () => {
            await navigator.clipboard.writeText(address);
            toast.success('Адрес скопирован');
        };
        return (
            <div className="p-6 lg:p-10 space-y-7 max-w-5xl mx-auto">
                <div>
                    <p className="text-sm text-primary font-medium mb-2">Личный кабинет</p>
                    <h1 className="text-3xl font-bold tracking-tight">Добро пожаловать, {user?.username}</h1>
                    <p className="text-muted-foreground mt-2">Ваш постоянный адрес уже готов к получению писем.</p>
                </div>
                <Card className="overflow-hidden hoodak-personal-mailbox">
                    <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <CardDescription>Ваш адрес HoodakMail</CardDescription>
                                <CardTitle className="text-xl sm:text-2xl mt-2 break-all">{address}</CardTitle>
                            </div>
                            <div className="rounded-xl border bg-primary/10 p-3"><Mail className="h-6 w-6 text-primary" /></div>
                        </div>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2">
                        <Button asChild className="h-11"><Link to={`/mailbox?mailbox=${encodeURIComponent(address)}`}><Mail className="mr-2 h-4 w-4" />Открыть входящие</Link></Button>
                        <Button variant="outline" className="h-11" onClick={copyAddress}><Copy className="mr-2 h-4 w-4" />Скопировать адрес</Button>
                    </CardContent>
                </Card>
                <div className="grid gap-4 md:grid-cols-2">
                    <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-green-500" />Приватный доступ</CardTitle><CardDescription>Другие пользователи не могут читать письма этого ящика.</CardDescription></CardHeader></Card>
                    <Card><CardHeader><CardTitle className="text-base">Как получить письмо</CardTitle><CardDescription>Укажите адрес выше при регистрации на нужном сайте. Новое письмо появится во входящих автоматически.</CardDescription></CardHeader></Card>
                </div>
            </div>
        );
    }

    if (isMailboxUser) {
        return (
            <div className="p-6 space-y-6">
                <h1 className="text-3xl font-bold">Welcome, {user?.username}</h1>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">My Inbox</CardTitle>
                            <Mail className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Check Mail</div>
                            <p className="text-xs text-muted-foreground">
                                View your received messages
                            </p>
                            <Button asChild className="mt-4 w-full">
                                <Link to="/mailbox">Go to Inbox</Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Панель управления</h1>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="overview">Обзор</TabsTrigger>
                    {isAdmin && <TabsTrigger value="mailboxes">Ящики</TabsTrigger>}
                    {isAdmin && <TabsTrigger value="users">Пользователи</TabsTrigger>}
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Всего ящиков</CardTitle>
                                <Users className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.total}</div>
                                <p className="text-xs text-muted-foreground">
                                    Active mailboxes managed
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Статус системы</CardTitle>
                                <div className="h-4 w-4 rounded-full bg-green-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">Работает</div>
                                <p className="text-xs text-muted-foreground">
                                    Cloudflare Worker active
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <TempMailGenerator />
                        <Card>
                            <CardHeader>
                                <CardTitle>Последняя активность</CardTitle>
                                <CardDescription>
                                    Overview of system activity.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-sm text-muted-foreground">
                                    System running normally. Use the tabs above to manage Mailboxes and Users.
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {isAdmin && (
                    <TabsContent value="mailboxes" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Mailbox Management</CardTitle>
                                <CardDescription>
                                    Manage all temporary mailboxes, filter by domain, and perform batch actions.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <MailboxList />
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}

                {isAdmin && (
                    <TabsContent value="users">
                        <UserList />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}
