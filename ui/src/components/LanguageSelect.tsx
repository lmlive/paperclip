import { Languages } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { i18n, useTranslation } from "@/i18n";
import { localeLabels, selectableLocales } from "@/i18n/locales";

interface LanguageSelectProps {
  onAfterChange?: () => void;
  variant?: "compact" | "menu-action";
}

function isSelectableLocale(locale: string): locale is (typeof selectableLocales)[number] {
  return selectableLocales.some((selectableLocale) => selectableLocale === locale);
}

export function LanguageSelect({ onAfterChange, variant = "menu-action" }: LanguageSelectProps) {
  const { t } = useTranslation();
  const currentLocale = isSelectableLocale(i18n.language) ? i18n.language : "zh-CN";

  async function handleChange(locale: string) {
    await i18n.changeLanguage(locale);
    onAfterChange?.();
  }

  if (variant === "compact") {
    return (
      <Select value={currentLocale} onValueChange={handleChange}>
        <SelectTrigger
          size="sm"
          className="w-[8.5rem] bg-background/80 text-xs"
          aria-label={t("account.language.label", { defaultValue: "Language" })}
        >
          <Languages className="size-4" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {selectableLocales.map((locale) => (
            <SelectItem key={locale} value={locale}>
              {localeLabels[locale]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left">
      <span className="mt-0.5 rounded-lg border border-border bg-background/70 p-2 text-muted-foreground">
        <Languages className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">
          {t("account.language.label", { defaultValue: "Language" })}
        </span>
        <span className="block text-xs text-muted-foreground">
          {t("account.language.description", { defaultValue: "Choose the board interface language." })}
        </span>
        <Select value={currentLocale} onValueChange={handleChange}>
          <SelectTrigger
            className="mt-2 h-8 w-full rounded-lg text-xs"
            aria-label={t("account.language.label", { defaultValue: "Language" })}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            {selectableLocales.map((locale) => (
              <SelectItem key={locale} value={locale}>
                {localeLabels[locale]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </span>
    </div>
  );
}
