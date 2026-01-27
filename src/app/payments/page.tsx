'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useTrainerStore } from '@/lib/store';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  DollarSign, 
  Calendar, 
  TrendingUp, 
  CheckCircle2,
  Clock,
  Users,
  ChevronRight,
  Filter
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isToday, isThisWeek, isThisMonth, parseISO } from 'date-fns';

export default function PaymentsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { sessions, payments, clients, sessionPackages } = useTrainerStore();
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('today');

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('apex-users') || '[]');
    setAllUsers(stored);
  }, []);

  // Get paid sessions for different time periods
  const paidSessions = useMemo(() => {
    return sessions.filter(s => s.trainerId === user?.id && s.paid && s.status === 'completed');
  }, [sessions, user?.id]);

  const todaysPaidSessions = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return paidSessions.filter(s => s.date === today);
  }, [paidSessions]);

  const thisWeeksPaidSessions = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);
    return paidSessions.filter(s => {
      const sessionDate = parseISO(s.date);
      return sessionDate >= weekStart && sessionDate <= weekEnd;
    });
  }, [paidSessions]);

  const thisMonthsPaidSessions = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    return paidSessions.filter(s => {
      const sessionDate = parseISO(s.date);
      return sessionDate >= monthStart && sessionDate <= monthEnd;
    });
  }, [paidSessions]);

  // Calculate earnings
  const calculateEarnings = (sessionList: typeof paidSessions) => {
    let total = 0;
    sessionList.forEach(session => {
      const pkg = sessionPackages.find(p => p.clientId === session.clientId);
      if (pkg?.pricePerSession) {
        total += pkg.pricePerSession;
      }
    });
    return total;
  };

  const todaysEarnings = calculateEarnings(todaysPaidSessions);
  const thisWeeksEarnings = calculateEarnings(thisWeeksPaidSessions);
  const thisMonthsEarnings = calculateEarnings(thisMonthsPaidSessions);

  // Get client info helper
  const getClientInfo = (clientId: string) => {
    const clientUser = allUsers.find(u => u.id === clientId);
    return {
      name: clientUser?.displayName || clientUser?.username || 'Client',
      photo: clientUser?.profilePhoto,
    };
  };

  // Get session price
  const getSessionPrice = (clientId: string) => {
    const pkg = sessionPackages.find(p => p.clientId === clientId);
    return pkg?.pricePerSession || 0;
  };

  const renderSessionList = (sessionList: typeof paidSessions, emptyMessage: string) => {
    if (sessionList.length === 0) {
      return (
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="py-8 text-center">
            <DollarSign className="w-10 h-10 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-400">{emptyMessage}</p>
          </CardContent>
        </Card>
      );
    }

    // Group by date
    const groupedByDate: Record<string, typeof sessionList> = {};
    sessionList.forEach(session => {
      const dateKey = session.date;
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = [];
      }
      groupedByDate[dateKey].push(session);
    });

    return (
      <div className="space-y-4">
        {Object.entries(groupedByDate)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, dateSessions]) => {
            const dateTotal = calculateEarnings(dateSessions);
            const displayDate = isToday(parseISO(date)) 
              ? 'Today' 
              : format(parseISO(date), 'EEEE, MMM d');
            
            return (
              <div key={date}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-400">{displayDate}</h3>
                  <Badge className="bg-emerald-500/20 text-emerald-400">
                    ${dateTotal.toFixed(0)}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {dateSessions.map(session => {
                    const clientInfo = getClientInfo(session.clientId);
                    const price = getSessionPrice(session.clientId);
                    
                    return (
                      <Card 
                        key={session.id} 
                        className="bg-gray-900 border-gray-800 hover:border-emerald-500/50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/clients/${session.clientId}`)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar className="w-10 h-10">
                                <AvatarImage src={clientInfo.photo} />
                                <AvatarFallback className="bg-gray-800 text-white">
                                  {clientInfo.name[0]?.toUpperCase() || '?'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-white">{clientInfo.name}</p>
                                <p className="text-xs text-gray-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {session.startTime} - {session.endTime}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <p className="font-bold text-emerald-400">${price}</p>
                                <div className="flex items-center gap-1 text-xs text-emerald-400">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Paid
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-gray-500" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
      </div>
    );
  };

  if (!isAuthenticated || !user) return null;

  return (
    <MainLayout>
      <PageHeader 
        title="Payment History" 
        subtitle="Track your earnings from completed sessions"
      />

      <div className="px-4 pb-24">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">Today</p>
              <p className="text-xl font-bold text-emerald-400">${todaysEarnings}</p>
              <p className="text-xs text-gray-500">{todaysPaidSessions.length} sessions</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">This Week</p>
              <p className="text-xl font-bold text-blue-400">${thisWeeksEarnings}</p>
              <p className="text-xs text-gray-500">{thisWeeksPaidSessions.length} sessions</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">This Month</p>
              <p className="text-xl font-bold text-purple-400">${thisMonthsEarnings}</p>
              <p className="text-xs text-gray-500">{thisMonthsPaidSessions.length} sessions</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different views */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-gray-900 mb-4">
            <TabsTrigger value="today" className="data-[state=active]:bg-emerald-500">
              Today
            </TabsTrigger>
            <TabsTrigger value="week" className="data-[state=active]:bg-emerald-500">
              This Week
            </TabsTrigger>
            <TabsTrigger value="month" className="data-[state=active]:bg-emerald-500">
              This Month
            </TabsTrigger>
          </TabsList>

          <TabsContent value="today">
            {renderSessionList(todaysPaidSessions, "No paid sessions today")}
          </TabsContent>

          <TabsContent value="week">
            {renderSessionList(thisWeeksPaidSessions, "No paid sessions this week")}
          </TabsContent>

          <TabsContent value="month">
            {renderSessionList(thisMonthsPaidSessions, "No paid sessions this month")}
          </TabsContent>
        </Tabs>

        {/* Quick Stats */}
        <Card className="bg-gray-900 border-gray-800 mt-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Total Paid Sessions</span>
                <span className="font-bold text-white">{paidSessions.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Unpaid Sessions</span>
                <span className="font-bold text-amber-400">
                  {sessions.filter(s => s.trainerId === user?.id && !s.paid && s.status === 'completed').length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Avg Per Session</span>
                <span className="font-bold text-emerald-400">
                  ${paidSessions.length > 0 ? (calculateEarnings(paidSessions) / paidSessions.length).toFixed(0) : 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
