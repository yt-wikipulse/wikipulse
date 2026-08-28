type PluralForms = {
  one: string;
  few: string;
  many: string;
};

const pluralRules = new Intl.PluralRules("ru-RU");
const numberFormat = new Intl.NumberFormat("ru-RU");

const EDIT_FORMS: PluralForms = {
  one: "правка",
  few: "правки",
  many: "правок",
};

export function plural(count: number, forms: PluralForms): string {
  const rule = pluralRules.select(count);

  if (rule === "one") {
    return forms.one;
  }

  if (rule === "few") {
    return forms.few;
  }

  return forms.many;
}

export function pluralizeEdits(count: number): string {
  return plural(count, EDIT_FORMS);
}

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}
