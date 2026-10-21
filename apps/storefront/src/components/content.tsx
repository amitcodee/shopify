import { paragraphs, type ResolvedLink } from '@repo/contracts';
import Link from 'next/link';

/** Renders merchant plain text as paragraphs (line breaks kept). Never interpreted as HTML. */
export function PlainText({ body }: { body: string }) {
  return (
    <div className="max-w-3xl space-y-4 leading-relaxed text-zinc-700">
      {paragraphs(body).map((p, i) => (
        <p key={i} className="whitespace-pre-line">
          {p}
        </p>
      ))}
    </div>
  );
}

/** A resolved menu link; external links open without passing the opener or referrer. */
export function MenuLink({ link, className }: { link: ResolvedLink; className?: string }) {
  return link.external ? (
    <a href={link.href} className={className} rel="noopener noreferrer">
      {link.title}
    </a>
  ) : (
    <Link href={link.href} className={className}>
      {link.title}
    </Link>
  );
}
