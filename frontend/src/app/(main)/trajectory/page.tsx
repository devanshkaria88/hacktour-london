'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import { ArrowRight, Mic } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BiomarkersPanel } from '@/components/trajectory/BiomarkersPanel';
import { SelfReportPanel } from '@/components/trajectory/SelfReportPanel';
import { StatusPanel } from '@/components/trajectory/StatusPanel';
import {
  useGetBaselineQuery,
  useGetTrajectoryQuery,
  useListTriageEventsQuery,
} from '@/managers/apiManager';
import { useAppSelector } from '@/store/store';

export default function TrajectoryPage() {
  const user = useAppSelector((s) => s.auth.user);
  // refetchOnMountOrArgChange forces a fresh fetch every time we navigate
  // here — important because the agent worker posts new check-ins behind
  // RTK Query's back, so the cache doesn't auto-invalidate.
  const trajectoryQ = useGetTrajectoryQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });
  const baselineQ = useGetBaselineQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });
  const triageQ = useListTriageEventsQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });

  useEffect(() => {
    if (trajectoryQ.error) toast.error('Could not load your trajectory.');
    if (baselineQ.error) toast.error('Could not load your baseline.');
    if (triageQ.error) toast.error('Could not load triage events.');
  }, [trajectoryQ.error, baselineQ.error, triageQ.error]);

  const points = trajectoryQ.data?.data ?? [];
  const baseline = baselineQ.data;
  const triageEvents = triageQ.data?.data ?? [];

  const lastPoint = points[points.length - 1];
  const activeEvent = useMemo(() => {
    if (!triageEvents.length || !lastPoint) return null;
    if (!lastPoint.triggeredDivergence) return null;
    return (
      triageEvents.find((e) => e.triggeringCheckinId === lastPoint.checkinId) ??
      triageEvents[0] ??
      null
    );
  }, [triageEvents, lastPoint]);

  const isLoading =
    trajectoryQ.isLoading || baselineQ.isLoading || triageQ.isLoading;

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <header className="mb-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Trajectory for {user?.displayName ?? 'you'}
        </p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-3xl text-foreground sm:text-4xl">
              Your daily picture
            </h1>
            {lastPoint && (
              <p className="mt-2 text-sm text-muted-foreground">
                Last check-in{' '}
                <span className="text-foreground">
                  {formatDistanceToNow(new Date(lastPoint.recordedAt), {
                    addSuffix: true,
                  })}
                </span>{' '}
                <span className="text-muted-foreground/60">
                  · {format(new Date(lastPoint.recordedAt), 'd MMM, HH:mm')}
                </span>
              </p>
            )}
          </div>
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <Button
              asChild
              size="lg"
              className="cursor-pointer h-11 px-6 text-[14px] shadow-sm"
            >
              <Link href="/record">
                <Mic className="mr-1 h-4 w-4" />
                Record today&apos;s check-in
              </Link>
            </Button>
          </motion.div>
        </div>
      </header>

      <Card className="border-border/70 bg-card/70 shadow-sm">
        <CardContent className="px-4 py-6 sm:px-6">
          {isLoading ? (
            <ChartSkeleton />
          ) : (
            <BiomarkersPanel points={points} baseline={baseline} />
          )}
        </CardContent>
      </Card>

      <div className="mt-6">
        {isLoading ? (
          <Skeleton className="h-32 w-full rounded-2xl" />
        ) : (
          <StatusPanel baseline={baseline} activeEvent={activeEvent} />
        )}
      </div>

      <div className="mt-6">
        <SelfReportPanel />
      </div>

      {!isLoading && triageEvents.length > 0 && (
        <PastEvents events={triageEvents.filter((e) => e.id !== activeEvent?.id)} />
      )}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-[300px] w-full rounded-lg" />
      <div className="flex gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

function PastEvents({
  events,
}: {
  events: { id: string; triggeredAt: string; composite: 'phq9' | 'gad7' }[];
}) {
  if (events.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="font-serif text-lg text-foreground">Past divergence events</h2>
      <ul className="mt-3 divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70 bg-card">
        {events.map((e) => (
          <li key={e.id}>
            <Link
              href={`/triage/${e.id}`}
              className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-sm transition-colors hover:bg-accent/50"
            >
              <span className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-status-divergence" />
                <span className="text-foreground">
                  {e.composite === 'phq9' ? 'PHQ-9' : 'GAD-7'} divergence
                </span>
                <span className="text-muted-foreground">
                  {format(new Date(e.triggeredAt), 'd MMM yyyy, HH:mm')}
                </span>
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
