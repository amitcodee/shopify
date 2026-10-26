'use client';

import type { PreviewMessage } from '@repo/contracts';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Runs only inside the admin theme editor's preview frame. Talks to the editor with
 * postMessage (checked against the admin origin): re-renders when the draft changes, scrolls
 * to and highlights the section being edited, and reports which section was clicked.
 */
export function EditorBridge({ adminOrigin }: { adminOrigin: string }) {
  const router = useRouter();

  useEffect(() => {
    if (window.parent === window) return;
    const send = (message: PreviewMessage) => window.parent.postMessage(message, adminOrigin);

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== adminOrigin) return;
      const data = event.data as PreviewMessage | null;
      if (!data || data.source !== 'cp-editor') return;
      if (data.type === 'refresh') router.refresh();
      if (data.type === 'select') {
        document.querySelectorAll('[data-section-active]').forEach((el) => {
          el.removeAttribute('data-section-active');
        });
        const el = document.querySelector(`[data-section="${CSS.escape(data.section)}"]`);
        if (el) {
          el.setAttribute('data-section-active', '');
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };
    const onClick = (event: MouseEvent) => {
      const el = (event.target as Element | null)?.closest('[data-section]');
      const section = el?.getAttribute('data-section');
      if (section) send({ source: 'cp-preview', type: 'section', section });
    };

    window.addEventListener('message', onMessage);
    document.addEventListener('click', onClick, true);
    document.body.setAttribute('data-editor-preview', '');
    send({ source: 'cp-preview', type: 'ready' });
    return () => {
      window.removeEventListener('message', onMessage);
      document.removeEventListener('click', onClick, true);
    };
  }, [adminOrigin, router]);

  return (
    <style>{`
      body[data-editor-preview] [data-section] { position: relative; }
      body[data-editor-preview] [data-section]:hover { outline: 2px dashed rgb(48 94 255 / 0.55); outline-offset: -2px; }
      body[data-editor-preview] [data-section-active] { outline: 2px solid #305eff !important; outline-offset: -2px; }
    `}</style>
  );
}
