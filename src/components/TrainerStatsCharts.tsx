'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  Area,
  AreaChart,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { DollarSign, Users, Calendar, TrendingUp } from 'lucide-react';
import { format, subWeeks, eachWeekOfInterval, endOfWeek, subMonths, eachMonthOfInterval, endOfMonth } from 'date-fns';
import { SessionPackage, ClientSession, TrainerClient } from '@/types';

interface TrainerStatsChartsProps {
  sessionPackages: SessionPackage[];
  sessions: ClientSession[];
  clients: TrainerClient[];
}

export function TrainerStatsCharts({ sessionPackages, sessions, clients }: TrainerStatsChartsProps) {
  // Calculate weekly earnings data (last 8 weeks)
  const weeklyEarningsData = useMemo(() => {
    const weeks = eachWeekOfInterval({
      start: subWeeks(new Date(), 7),
      end: new Date(),
    });

    return weeks.map(weekStart => {
      const weekEnd = endOfWeek(weekStart);
      const weekSessions = sessions.filter(s => {
        const date = new Date(s.date);
        return date >= weekStart && date <= weekEnd && s.status === 'completed';
      });

      // Calculate earnings based on sessions and package prices
      let earnings = 0;
      weekSessions.forEach(session => {
        // Find the package for this client
        const pkg = sessionPackages.find(p => p.clientId === session.clientId && p.status === 'active');
        if (pkg) {
          earnings += pkg.pricePerSession || 0;
        }
      });

      return {
        week: format(weekStart, 'MMM d'),
        sessions: weekSessions.length,
        earnings: Math.round(earnings),
      };
    });
  }, [sessions, sessionPackages]);

  // Calculate monthly earnings data (last 6 months)
  const monthlyEarningsData = useMemo(() => {
    const months = eachMonthOfInterval({
      start: subMonths(new Date(), 5),
      end: new Date(),
    });

    return months.map(monthStart => {
      const monthEnd = endOfMonth(monthStart);
      const monthSessions = sessions.filter(s => {
        const date = new Date(s.date);
        return date >= monthStart && date <= monthEnd && s.status === 'completed';
      });

      // Calculate earnings based on sessions and package prices
      let earnings = 0;
      monthSessions.forEach(session => {
        const pkg = sessionPackages.find(p => p.clientId === session.clientId);
        if (pkg) {
          earnings += pkg.pricePerSession || 0;
        }
      });

      return {
        month: format(monthStart, 'MMM'),
        sessions: monthSessions.length,
        earnings: Math.round(earnings),
      };
    });
  }, [sessions, sessionPackages]);

  // Client breakdown by earnings
  const clientEarningsData = useMemo(() => {
    const clientEarnings: { name: string; earnings: number; sessions: number; color: string }[] = [];
    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

    clients.forEach((client, idx) => {
      const pkg = sessionPackages.find(p => p.clientId === client.clientId);
      if (pkg) {
        const paidAmount = (pkg.paidSessions || 0) * (pkg.pricePerSession || 0);
        if (paidAmount > 0) {
          const clientName = client.client?.displayName || client.client?.username || `Client ${idx + 1}`;
          clientEarnings.push({
            name: clientName,
            earnings: Math.round(paidAmount),
            sessions: pkg.usedSessions || 0,
            color: colors[idx % colors.length],
          });
        }
      }
    });

    return clientEarnings.sort((a, b) => b.earnings - a.earnings).slice(0, 6);
  }, [clients, sessionPackages]);

  // Payment status breakdown
  const paymentStatusData = useMemo(() => {
    let totalPaid = 0;
    let totalOutstanding = 0;

    sessionPackages.forEach(pkg => {
      const paid = (pkg.paidSessions || 0) * (pkg.pricePerSession || 0);
      const outstanding = Math.max(0, (pkg.usedSessions || 0) - (pkg.paidSessions || 0)) * (pkg.pricePerSession || 0);
      totalPaid += paid;
      totalOutstanding += outstanding;
    });

    return [
      { name: 'Paid', value: Math.round(totalPaid), color: '#10b981' },
      { name: 'Outstanding', value: Math.round(totalOutstanding), color: '#f59e0b' },
    ].filter(d => d.value > 0);
  }, [sessionPackages]);

  // Summary stats
  const stats = useMemo(() => {
    const totalSessions = sessionPackages.reduce((sum, p) => sum + (p.usedSessions || 0), 0);
    const totalPaidSessions = sessionPackages.reduce((sum, p) => sum + (p.paidSessions || 0), 0);
    const totalEarnings = sessionPackages.reduce((sum, p) => 
      sum + ((p.paidSessions || 0) * (p.pricePerSession || 0)), 0);
    const totalOutstanding = sessionPackages.reduce((sum, p) => {
      const unpaid = Math.max(0, (p.usedSessions || 0) - (p.paidSessions || 0));
      return sum + (unpaid * (p.pricePerSession || 0));
    }, 0);
    const activeClients = clients.filter(c => c.status === 'active').length;

    return {
      totalSessions,
      totalPaidSessions,
      totalEarnings: Math.round(totalEarnings),
      totalOutstanding: Math.round(totalOutstanding),
      activeClients,
      avgPerSession: totalPaidSessions > 0 ? Math.round(totalEarnings / totalPaidSessions) : 0,
    };
  }, [sessionPackages, clients]);

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-4 text-center">
            <DollarSign className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">${stats.totalEarnings}</p>
            <p className="text-xs text-gray-400">Total Earned</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-4 text-center">
            <Calendar className="w-6 h-6 text-blue-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{stats.totalSessions}</p>
            <p className="text-xs text-gray-400">Total Sessions</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-4 text-center">
            <Users className="w-6 h-6 text-purple-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{stats.activeClients}</p>
            <p className="text-xs text-gray-400">Active Clients</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-6 h-6 text-amber-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">${stats.avgPerSession}</p>
            <p className="text-xs text-gray-400">Avg/Session</p>
          </CardContent>
        </Card>
      </div>

      {/* Outstanding Warning */}
      {stats.totalOutstanding > 0 && (
        <Card className="bg-amber-900/20 border-amber-500/50">
          <CardContent className="p-4 flex justify-between items-center">
            <div>
              <p className="text-amber-400 font-medium">Outstanding Payments</p>
              <p className="text-xs text-amber-300/70">
                {stats.totalSessions - stats.totalPaidSessions} sessions unpaid
              </p>
            </div>
            <p className="text-2xl font-bold text-amber-400">${stats.totalOutstanding}</p>
          </CardContent>
        </Card>
      )}

      {/* Weekly Earnings Chart */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-white flex items-center gap-2 text-base">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            Weekly Earnings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyEarningsData}>
                <defs>
                  <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="week" 
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  axisLine={{ stroke: '#374151' }}
                />
                <YAxis 
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  axisLine={{ stroke: '#374151' }}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#fff' }}
                  formatter={(value: number) => [`$${value}`, 'Earnings']}
                />
                <Area 
                  type="monotone" 
                  dataKey="earnings" 
                  stroke="#10b981" 
                  fill="url(#earningsGradient)" 
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Sessions per Week Chart */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-white flex items-center gap-2 text-base">
            <Calendar className="w-4 h-4 text-blue-400" />
            Sessions per Week
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyEarningsData}>
                <XAxis 
                  dataKey="week" 
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  axisLine={{ stroke: '#374151' }}
                />
                <YAxis 
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  axisLine={{ stroke: '#374151' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#fff' }}
                />
                <Bar dataKey="sessions" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Client Earnings Breakdown */}
      {clientEarningsData.length > 0 && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <Users className="w-4 h-4 text-purple-400" />
              Earnings by Client
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {clientEarningsData.map((client, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: client.color }}
                  />
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-white">{client.name}</span>
                      <span className="text-sm font-bold text-emerald-400">${client.earnings}</span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full mt-1 overflow-hidden">
                      <div 
                        className="h-full rounded-full" 
                        style={{ 
                          backgroundColor: client.color,
                          width: `${Math.min(100, (client.earnings / (clientEarningsData[0]?.earnings || 1)) * 100)}%` 
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{client.sessions} sessions</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Status Pie Chart */}
      {paymentStatusData.length > 0 && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              Payment Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center gap-6">
              <div className="h-32 w-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={50}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {paymentStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1f2937', 
                        border: '1px solid #374151',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [`$${value}`]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {paymentStatusData.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-gray-400">{item.name}:</span>
                    <span className="text-sm font-bold text-white">${item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
