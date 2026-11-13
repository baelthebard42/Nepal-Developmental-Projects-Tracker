"use client";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

const KEY = "npm-tour-seen";

/** Guided tour (plan §5.3 #1): runs on first visit, reopened from the Tour button. */
export function Tour() {
  const t = useTranslations("tour");

  useEffect(() => {
    const visible = (sel: string) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      return !!el && el.offsetParent !== null;
    };
    const start = () => {
      const steps: DriveStep[] = [
        { popover: { title: t("s1t"), description: t("s1") } },
        { element: "#counters", popover: { title: t("s2t"), description: t("s2"), side: "right" } },
        { element: "#breakdown", popover: { title: t("s3t"), description: t("s3"), side: "right" } },
        { element: "#map-stage", popover: { title: t("s4t"), description: t("s4"), side: "left", align: "center" } },
        { element: "[data-ring-partner]", popover: { title: t("s5t"), description: t("s5"), side: "bottom" } },
        { element: visible("#filter-button") ? "#filter-button" : "#search", popover: { title: t("s6t"), description: t("s6"), side: "left" } },
        { element: "#projects-toggle", popover: { title: t("s7t"), description: t("s7"), side: "bottom" } },
        { element: "#share-button", popover: { title: t("s8t"), description: t("s8"), side: "bottom", align: "end" } },
      ].filter((s) => !s.element || document.querySelector(s.element as string)) as DriveStep[];
      driver({
        showProgress: true,
        steps,
        nextBtnText: t("next"),
        prevBtnText: t("prev"),
        doneBtnText: t("done"),
        overlayColor: "#0b141b",
        overlayOpacity: 0.6,
        stagePadding: 6,
        stageRadius: 10,
      }).drive();
      try {
        localStorage.setItem(KEY, "1");
      } catch {}
    };
    window.addEventListener("start-tour", start);
    let seen = true;
    try {
      seen = !!localStorage.getItem(KEY);
    } catch {}
    const auto = !seen && !navigator.webdriver ? setTimeout(start, 1600) : undefined;
    return () => {
      window.removeEventListener("start-tour", start);
      clearTimeout(auto);
    };
  }, [t]);

  return null;
}
