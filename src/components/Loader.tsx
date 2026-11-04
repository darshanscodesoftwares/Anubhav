import { Lotus } from './Logo';

export function Loader({ done }: { done: boolean }) {
  return (
    <div
      className={`fixed inset-0 z-50 grid place-items-center bg-blush transition-[opacity,visibility] duration-1000 ease-silk ${done ? 'invisible opacity-0' : 'visible opacity-100'}`}
      aria-hidden={done}
    >
      <div className="flex flex-col items-center gap-5 text-ink">
        <Lotus className="h-12 w-20 animate-pulse text-gold" />
        <span className="font-serif text-3xl tracking-[0.3em]">ANUBHAV</span>
        <span className="h-px w-28 overflow-hidden bg-ink/15">
          <span className="block h-full w-1/2 animate-[loader_1.4s_ease-in-out_infinite] bg-gold" />
        </span>
      </div>
      <style>{`@keyframes loader { 0% { transform: translateX(-100%) } 100% { transform: translateX(200%) } }`}</style>
    </div>
  );
}
