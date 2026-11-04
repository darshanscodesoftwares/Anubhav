export function Lotus({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 40" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
      <path d="M32 3c5.5 6 5.5 18 0 27-5.5-9-5.5-21 0-27z" />
      <path d="M32 30c-1.5-8-7.5-14.5-16-16 0 9.5 7 16 16 16z" />
      <path d="M32 30c1.5-8 7.5-14.5 16-16 0 9.5-7 16-16 16z" />
      <path d="M31 31C25 26 14 24 5 26c5 6 15 8 26 5z" />
      <path d="M33 31c6-5 17-7 26-5-5 6-15 8-26 5z" />
    </svg>
  );
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`flex flex-col items-center leading-none ${className}`}>
      <Lotus className="mb-1.5 h-7 w-11 text-gold md:h-8 md:w-12" />
      <span className="font-serif text-[1.55rem] font-medium tracking-[0.16em] md:text-[1.75rem]">ANUBHAV</span>
      <span className="mt-1.5 text-[0.56rem] font-medium tracking-[0.3em] md:text-[0.6rem]">CLOTHING ATELIER</span>
    </span>
  );
}
