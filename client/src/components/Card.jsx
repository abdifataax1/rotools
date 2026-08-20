import React from 'react';

export function Card({ children, className = '' }) {
  return <div className={`glass rounded-2xl ${className}`}>{children}</div>;
}

export function PageTitle({ eyebrow, title, children }) {
  return (
    <div className="mb-6">
      {eyebrow && <p className="mb-2 text-sm font-semibold uppercase tracking-[.18em] text-neon">{eyebrow}</p>}
      <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">{title}</h1>
      {children && <p className="mt-3 max-w-3xl text-slate-300">{children}</p>}
    </div>
  );
}
