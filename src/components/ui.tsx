import React from "react";
export function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (<div className="rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 p-4">{title ? <div className="font-semibold mb-3">{title}</div> : null}{children}</div>);
}
export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }) {
  const { variant = "primary", className = "", ...rest } = props;
  const base = "rounded-xl px-4 py-2 text-sm font-medium transition active:scale-[0.99]";
  const styles = variant === "primary" ? "bg-zinc-900 text-white hover:bg-zinc-800" : "bg-transparent hover:bg-zinc-100 text-zinc-900";
  return <button className={`${base} ${styles} ${className}`} {...rest} />;
}
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return (<input className={`w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/20 ${className}`} {...rest} />);
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", ...rest } = props;
  return (<select className={`w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/20 ${className}`} {...rest} />);
}
export function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-medium text-zinc-700 mb-1">{children}</div>;
}
