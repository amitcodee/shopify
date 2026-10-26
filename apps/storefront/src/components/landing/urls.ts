import 'server-only';

/** Where marketing links point. Server-side env only; client components get these as props. */
export const adminUrl = process.env.ADMIN_PUBLIC_URL ?? 'http://localhost:3100';
export const signupUrl = `${adminUrl}/signup`;
export const loginUrl = `${adminUrl}/login`;
export const apiDocsUrl = `${process.env.PUBLIC_API_URL ?? 'http://localhost:4000'}/api/docs`;
/** A store the "Preview" buttons open with `?theme_preview=<template id>`. */
export const demoStoreUrl = process.env.PLATFORM_DEMO_STORE_URL ?? 'http://demo.localhost:3200';

export interface MarketingLinks {
  signupUrl: string;
  loginUrl: string;
  apiDocsUrl: string;
}

export const marketingLinks: MarketingLinks = { signupUrl, loginUrl, apiDocsUrl };
