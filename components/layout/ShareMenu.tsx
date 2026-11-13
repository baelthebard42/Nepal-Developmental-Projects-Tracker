"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { DropdownMenu } from "radix-ui";
import { Check, ImageDown, Link2, Share2 } from "lucide-react";

export function ShareMenu() {
  const t = useTranslations();
  const path = usePathname();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      window.prompt(t("share.copy"), window.location.href);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const item = "flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-panel-2";
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        id="share-button"
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-muted outline-none hover:text-text focus-visible:ring-2 focus-visible:ring-teal"
        aria-label={t("nav.share")}
      >
        {copied ? <Check className="size-4 text-teal" /> : <Share2 className="size-4" />}
        <span className="hidden md:inline">{copied ? t("share.copied") : t("nav.share")}</span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 min-w-60 rounded-xl border border-line bg-panel p-1.5 text-text shadow-2xl">
          <DropdownMenu.Item className={item} onSelect={copy}>
            <Link2 className="size-4 text-teal" /> {t("share.copy")}
          </DropdownMenu.Item>
          {path === "/" && (
            <DropdownMenu.Item className={item} onSelect={() => window.dispatchEvent(new Event("export-png"))}>
              <ImageDown className="size-4 text-teal" /> {t("share.png")}
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
