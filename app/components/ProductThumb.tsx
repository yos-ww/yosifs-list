"use client";

import { useState } from "react";

/** Small square product photo. Missing or broken photos show a plain empty square, never an icon. */
export default function ProductThumb({ src, className = "size-9" }: { src?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <span aria-hidden className={`${className} shrink-0 rounded-sm border border-neutral-800`} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny remote store photos; no optimisation needed
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${className} shrink-0 rounded-sm bg-white object-cover`}
    />
  );
}
