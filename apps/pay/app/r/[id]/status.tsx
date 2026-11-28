'use client';

import { useEffect, useState } from 'react';

import { statusCopy } from '../../../lib/funding.ts';

export function StatusLine({ id, initial }: { id: string; initial: string }) {
  const [status, setStatus] = useState(initial);

  useEffect(() => {
    const timer = setInterval(() => {
      void fetch(`/api/ramp-status?id=${encodeURIComponent(id)}`)
        .then((res) => res.json())
        .then((body: { status?: string }) => {
          if (typeof body.status === 'string') setStatus(body.status);
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [id]);

  return <p data-testid="ramp-status">{statusCopy(status)}</p>;
}
