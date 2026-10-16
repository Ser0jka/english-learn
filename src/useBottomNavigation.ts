import { useEffect, useRef } from "react";

export function useBottomNavigation(hidden: boolean) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (hidden) return;
    const navigation = ref.current;
    if (!navigation) return;
    const viewport = window.visualViewport;
    let frame = 0;
    let correction = 0;
    const update = () => {
      const bounds = navigation.getBoundingClientRect();
      if (!bounds.height || Math.abs((viewport?.scale ?? 1) - 1) > 0.01) {
        navigation.style.removeProperty("--bottom-nav-correction");
        correction = 0;
        return;
      }
      const height = viewport?.height ?? window.innerHeight;
      // Ignore elastic overscroll; pageTop/scrollY are document coordinates.
      const maximumOffset = Math.max(
        0,
        document.documentElement.clientHeight - height,
      );
      const offset = Math.max(
        0,
        Math.min(viewport?.offsetTop ?? 0, maximumOffset),
      );
      // Subtract our previous translation so scroll events cannot accumulate drift.
      const nativeBottom = bounds.bottom - correction;
      const next = Math.round((height + offset - nativeBottom) * 100) / 100;
      if (Math.abs(next - correction) > 0.1) {
        correction = next;
        navigation.style.setProperty("--bottom-nav-correction", `${next}px`);
      }
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    schedule();
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("pageshow", schedule);
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(navigation);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("pageshow", schedule);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
      navigation.style.removeProperty("--bottom-nav-correction");
    };
  }, [hidden]);
  return ref;
}
