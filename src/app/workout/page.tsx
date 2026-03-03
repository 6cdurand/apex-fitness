'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Old WorkoutPage removed — all functionality lives in /today
export default function WorkoutPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/today'); }, [router]);
  return null;
}
