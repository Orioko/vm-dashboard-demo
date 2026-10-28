import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base = (props: IconProps): IconProps => ({
  width: 14,
  height: 14,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
  ...props,
});

export const ChevronIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M6 4l4 4-4 4" />
  </svg>
);

export const ClusterIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="2" y="2.5" width="12" height="4" rx="0.5" />
    <rect x="2" y="9.5" width="12" height="4" rx="0.5" />
    <path d="M4.5 4.5h1M4.5 11.5h1" />
  </svg>
);

export const NodeIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="2.5" y="3" width="11" height="10" rx="0.5" />
    <path d="M2.5 8h11M5 5.5h1M5 10.5h1" />
  </svg>
);

export const AllVmsIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="2" y="2" width="5" height="5" rx="0.5" />
    <rect x="9" y="2" width="5" height="5" rx="0.5" />
    <rect x="2" y="9" width="5" height="5" rx="0.5" />
    <rect x="9" y="9" width="5" height="5" rx="0.5" />
  </svg>
);

export const AlertIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M8 2.2L14.2 13H1.8L8 2.2z" fill="currentColor" stroke="none" />
    <path d="M8 6.5v3" stroke="var(--icon-contrast)" />
    <circle cx="8" cy="11.3" r="0.6" fill="var(--icon-contrast)" stroke="none" />
  </svg>
);

export const PlayIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M5 3.2l8 4.8-8 4.8z" fill="currentColor" stroke="none" />
  </svg>
);

export const StopIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <rect x="3.5" y="3.5" width="9" height="9" rx="0.5" fill="currentColor" stroke="none" />
  </svg>
);

export const PauseIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M5 3.5v9M11 3.5v9" strokeWidth={2.5} strokeLinecap="butt" />
  </svg>
);

export const RestartIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M13 8a5 5 0 1 1-1.5-3.6" />
    <path d="M12 1.8v2.8H9.2" />
  </svg>
);

export const ErrorIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="8" cy="8" r="6.2" fill="currentColor" stroke="none" />
    <path d="M8 4.8v3.6" stroke="var(--icon-contrast)" />
    <circle cx="8" cy="11" r="0.6" fill="var(--icon-contrast)" stroke="none" />
  </svg>
);

export const CheckIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <circle cx="8" cy="8" r="6.2" fill="currentColor" stroke="none" />
    <path d="M5.3 8.2l1.8 1.8 3.6-3.8" stroke="var(--icon-contrast)" />
  </svg>
);

export const SpinnerIcon = (props: IconProps) => (
  <svg {...base(props)} className={`spin ${props.className ?? ''}`}>
    <circle cx="8" cy="8" r="5.5" opacity="0.25" />
    <path d="M8 2.5a5.5 5.5 0 0 1 5.5 5.5" />
  </svg>
);

export const PowerIcon = (props: IconProps) => (
  <svg {...base(props)}>
    <path d="M8 2v5.5" />
    <path d="M4.6 4.4a5 5 0 1 0 6.8 0" />
  </svg>
);
