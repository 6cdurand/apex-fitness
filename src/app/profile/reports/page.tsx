'use client';

import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Construction } from 'lucide-react';

export default function ReportsPage() {
  return (
    <MainLayout>
      <PageHeader title="Weekly Reports" subtitle="Your training week in detail" showBack />
      <div className="px-4 py-6">
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-8 text-center">
            <Construction className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-900 mb-1">Full reports coming soon</h3>
            <p className="text-sm text-gray-500">
              Weekly summaries, trends, PR cadence, and trainer insights are being built. Auto-generated reports already started for your future history.
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
