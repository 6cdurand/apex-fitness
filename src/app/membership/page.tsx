'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/lib/store';
import { 
  Crown, 
  Zap, 
  Users, 
  BarChart3, 
  Trophy, 
  MessageSquare, 
  Calendar,
  Dumbbell,
  Check,
  ChevronRight,
  Sparkles,
  Building2,
  UserPlus
} from 'lucide-react';

interface PlanFeature {
  text: string;
  included: boolean;
}

interface MembershipPlan {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  features: PlanFeature[];
  popular?: boolean;
  current?: boolean;
}

export default function MembershipPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const plans: MembershipPlan[] = [
    {
      id: 'base',
      name: 'Base',
      price: 'Free',
      period: 'forever',
      description: 'Essential workout tracking',
      icon: <Dumbbell className="w-6 h-6" />,
      color: 'text-slate-400',
      bgColor: 'bg-slate-800',
      current: true,
      features: [
        { text: 'Unlimited workout logging', included: true },
        { text: 'Exercise library access', included: true },
        { text: 'Personal best tracking', included: true },
        { text: 'Basic strength rating', included: true },
        { text: 'Workout templates', included: true },
        { text: 'Progress insights', included: false },
        { text: 'Community features', included: false },
        { text: 'Trainer tools', included: false },
      ],
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '$9.99',
      period: '/month',
      description: 'Advanced progress & community',
      icon: <Zap className="w-6 h-6" />,
      color: 'text-sky-400',
      bgColor: 'bg-sky-500/20',
      popular: true,
      features: [
        { text: 'Everything in Base', included: true },
        { text: 'Detailed progress analytics', included: true },
        { text: 'Strength tier insights', included: true },
        { text: 'Exercise recommendations', included: true },
        { text: 'Community feed access', included: true },
        { text: 'Achievement badges', included: true },
        { text: 'Export workout data', included: true },
        { text: 'Trainer tools', included: false },
      ],
    },
    {
      id: 'trainer',
      name: 'Trainer',
      price: '$29.99',
      period: '/month',
      description: 'Business tools for trainers',
      icon: <Crown className="w-6 h-6" />,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/20',
      features: [
        { text: 'Everything in Pro', included: true },
        { text: 'Client management', included: true },
        { text: 'Assign workout programs', included: true },
        { text: 'Track client progress', included: true },
        { text: 'In-app messaging', included: true },
        { text: 'Scheduling & bookings', included: true },
        { text: 'Revenue analytics', included: true },
        { text: 'Priority support', included: true },
      ],
    },
  ];

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId);
    // In a real app, this would navigate to a checkout flow
  };

  return (
    <MainLayout>
      <PageHeader 
        title="Membership" 
        subtitle="Unlock your full potential"
        showBack
      />
      
      <div className="px-4 py-6 space-y-6 -mt-4">
        {/* Hero Section */}
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-orange-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-sky-500/20">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Choose Your Plan</h2>
          <p className="text-slate-400 text-sm max-w-xs mx-auto">
            From casual gym-goers to professional trainers, we've got you covered
          </p>
        </div>

        {/* Plans */}
        <div className="space-y-4">
          {plans.map((plan) => (
            <Card 
              key={plan.id}
              className={`relative overflow-hidden transition-all ${
                plan.popular 
                  ? 'bg-slate-900 border-sky-500/50 shadow-lg shadow-sky-500/10' 
                  : 'bg-slate-900/90 border-slate-800'
              } ${selectedPlan === plan.id ? 'ring-2 ring-sky-500' : ''}`}
            >
              {plan.popular && (
                <div className="absolute top-0 right-0">
                  <Badge className="rounded-none rounded-bl-lg bg-sky-500 text-white border-0 px-3 py-1">
                    Most Popular
                  </Badge>
                </div>
              )}
              {plan.current && (
                <div className="absolute top-0 right-0">
                  <Badge className="rounded-none rounded-bl-lg bg-slate-700 text-slate-300 border-0 px-3 py-1">
                    Current Plan
                  </Badge>
                </div>
              )}
              
              <CardContent className="p-5">
                <div className="flex items-start gap-4 mb-4">
                  <div className={`w-12 h-12 rounded-xl ${plan.bgColor} flex items-center justify-center ${plan.color}`}>
                    {plan.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                    <p className="text-sm text-slate-400">{plan.description}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${plan.color}`}>{plan.price}</p>
                    <p className="text-xs text-slate-500">{plan.period}</p>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Check className={`w-4 h-4 ${feature.included ? 'text-emerald-400' : 'text-slate-700'}`} />
                      <span className={feature.included ? 'text-slate-300 text-sm' : 'text-slate-600 text-sm'}>
                        {feature.text}
                      </span>
                    </div>
                  ))}
                </div>

                {!plan.current && (
                  <Button 
                    className={`w-full ${
                      plan.popular 
                        ? 'bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white' 
                        : plan.id === 'trainer'
                          ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                    onClick={() => handleSelectPlan(plan.id)}
                  >
                    {plan.id === 'trainer' ? 'Start Free Trial' : 'Upgrade Now'}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
                {plan.current && (
                  <div className="text-center py-2">
                    <span className="text-sm text-slate-500">Your current plan</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Trainer CTA */}
        <Card className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 border-orange-500/30">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-orange-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-white">Are you a trainer?</h3>
                <p className="text-sm text-slate-400">
                  Grow your business with our professional tools
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-orange-400" />
            </div>
          </CardContent>
        </Card>

        {/* FAQ Teaser */}
        <div className="text-center py-4">
          <p className="text-slate-500 text-sm">
            Questions? <button className="text-sky-400 hover:underline">View FAQ</button>
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
