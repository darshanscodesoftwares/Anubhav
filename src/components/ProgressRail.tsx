interface Props {
  count: number;
  active: number;
  onSelect: (i: number) => void;
  labels: string[];
}

export function ProgressRail({ count, active, onSelect, labels }: Props) {
  return (
    <div className="js-rail absolute right-5 top-1/2 z-20 -translate-y-1/2 md:right-[3.6vw]">
      <div className="relative flex flex-col items-center gap-[30px]">
        <span className="absolute left-1/2 top-2 h-[calc(100%+44px)] w-px -translate-x-1/2 bg-ink/35" aria-hidden />
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            aria-label={`Go to ${labels[i]}`}
            aria-current={i === active}
            className="group relative grid h-[22px] w-[22px] place-items-center"
          >
            <span
              className={`absolute inset-0 rounded-full border transition-all duration-500 ease-silk ${i === active ? 'scale-100 border-ink/70 bg-blush/30' : 'scale-[0.72] border-ink/45 bg-blush/60 group-hover:scale-90'}`}
            />
            <span className={`relative h-[13px] w-[13px] rounded-full bg-white shadow-sm transition-all duration-500 ease-silk ${i === active ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`} />
          </button>
        ))}
      </div>
    </div>
  );
}
