'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { use } from 'react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { DimensionBreakdown } from '@/components/trajectory/DimensionBreakdown';
import { useListTriageEventsQuery } from '@/managers/apiManager';
import { API_BASE_URL } from '@/lib/constants';

export default function TriageEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, isLoading, error } = useListTriageEventsQuery();
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (error) toast.error('Could not load this triage event.');
  }, [error]);

  const event = data?.data.find((e) => e.id === id);

  if (isLoading) return <TriageSkeleton />;
  if (!event) return <NotFound />;

  const sigmas =
    event.baselineStddev > 0
      ? (event.observedValue - event.baselineMean) / event.baselineStddev
      : 0;
  const compositeLabel = event.composite === 'phq9' ? 'PHQ-9 (depression)' : 'GAD-7 (anxiety)';

  // Locate the triggering check-in inside the trajectory snapshot so we can
  // surface its per-dimension biomarkers. Use the previous point as the
  // comparison baseline for delta arrows.
  const triggeringIndex = event.trajectory.findIndex(
    (p) => p.checkinId === event.triggeringCheckinId,
  );
  const triggeringPoint =
    triggeringIndex >= 0 ? event.trajectory[triggeringIndex] : null;
  const previousPoint =
    triggeringIndex > 0 ? event.trajectory[triggeringIndex - 1] : null;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      // The /packet endpoint is JWT-cookie protected — `credentials: 'include'`
      // is required so the browser actually sends the session cookie alongside
      // the request. Without it we get a silent 401 here.
      const res = await fetch(
        `${API_BASE_URL}/api/v1/triage-events/${id}/packet`,
        { credentials: 'include' },
      );
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}${body ? ` — ${body}` : ''}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `olando-packet-${format(new Date(event.triggeredAt), 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Triage packet downloaded.');
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown error';
      toast.error(`Could not download the packet — ${detail}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <Link
        href="/trajectory"
        className="cursor-pointer mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to trajectory
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-status-divergence/30 bg-status-divergence-soft px-3 py-1 text-xs font-medium text-status-divergence">
          <span className="h-1.5 w-1.5 rounded-full bg-status-divergence" />
          Divergence detected
        </span>

        <h1 className="mt-4 font-serif text-3xl text-foreground sm:text-4xl">
          A change worth bringing to your GP
        </h1>
        <p className="mt-3 max-w-xl text-base text-muted-foreground">
          {event.triggerReason}
        </p>
      </motion.div>

      <Card className="mt-8 border-border/70 bg-card/70 shadow-sm">
        <CardContent className="px-6 py-6 sm:px-8">
          <h2 className="font-serif text-lg text-foreground">What moved</h2>
          <Separator className="my-4 bg-border/70" />
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            <Stat label="Composite" value={compositeLabel} />
            <Stat
              label="Triggered"
              value={format(new Date(event.triggeredAt), 'd MMM yyyy, HH:mm')}
            />
            <Stat
              label="Observed (7-day avg)"
              value={event.observedValue.toFixed(3)}
              mono
            />
            <Stat
              label="Personal baseline"
              value={`${event.baselineMean.toFixed(3)} ± ${event.baselineStddev.toFixed(3)}`}
              mono
            />
            <Stat
              label="Above baseline"
              value={`${sigmas >= 0 ? '+' : ''}${sigmas.toFixed(2)} σ`}
              mono
              accent
            />
            <Stat
              label="Threshold"
              value="2.00 σ"
              mono
            />
            <Stat
              label="Check-ins in baseline"
              value={`${event.trajectory.length}`}
              mono
            />
            <Stat
              label="Triggering check-in"
              value={event.triggeringCheckinId.slice(0, 8)}
              mono
            />
          </dl>
        </CardContent>
      </Card>

      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-lg text-foreground">
            Per-dimension breakdown
          </h2>
          <span className="text-xs text-muted-foreground">
            Triggering check-in
            {previousPoint && (
              <span className="text-muted-foreground/70">
                {' '}
                · vs previous
              </span>
            )}
          </span>
        </div>
        <DimensionBreakdown
          biomarkers={triggeringPoint?.biomarkers ?? null}
          comparison={previousPoint?.biomarkers ?? null}
        />
      </section>

      <Card className="mt-6 border-border/70 bg-card/70 shadow-sm">
        <CardContent className="flex flex-col items-start gap-5 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-start gap-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-serif text-lg text-foreground">
                One-page triage packet
              </h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                A clinician-readable PDF: your trajectory, biomarker shifts, and
                this event&apos;s context. Bring it to your GP.
              </p>
            </div>
          </div>
          <Button
            onClick={handleDownload}
            disabled={downloading}
            size="lg"
            className="cursor-pointer h-11 px-5 text-[15px]"
          >
            {downloading ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="mr-1 h-4 w-4" />
                Download packet
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <section className="mt-10">
        <h2 className="font-serif text-lg text-foreground">What happens next</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            Bring the packet to your next GP appointment, or send it ahead so
            they have it on their desk before you sit down.
          </p>
          <p>
            Ask where you sit on the waiting list and whether this trajectory
            changes anything. The packet is a starting point for that conversation.
          </p>
          <p>
            Keep checking in. The strongest version of this packet is one that
            shows weeks of data, not days.
          </p>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd
        className={`mt-1 text-sm ${mono ? 'font-mono tabular-nums' : ''} ${
          accent ? 'text-status-divergence font-semibold' : 'text-foreground'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function TriageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-10">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-56 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}

function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-6 py-20 text-center">
      <h1 className="font-serif text-2xl text-foreground">
        Triage event not found
      </h1>
      <p className="text-sm text-muted-foreground">
        This event may have been cleared. Open your trajectory to see the
        latest.
      </p>
      <Button asChild size="sm" className="cursor-pointer">
        <Link href="/trajectory">Open trajectory</Link>
      </Button>
    </div>
  );
}
